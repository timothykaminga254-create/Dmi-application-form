const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const Database = require("better-sqlite3");

const app = express();
const port = Number(process.env.PORT) || 3000;
const databasePath =
    process.env.DATABASE_PATH ||
    path.join(__dirname, "data", "applications.sqlite");
const formDirectory = path.join(__dirname, "Dmi-application form");
const allowedImageTypes = new Set([
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
]);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new Database(databasePath);
database.pragma("journal_mode = WAL");
database.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_number TEXT UNIQUE,
    submitted_at TEXT NOT NULL,
    fields_json TEXT NOT NULL,
    photo BLOB,
    photo_mime_type TEXT,
    photo_original_name TEXT
  )
`);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        fieldNameSize: 100,
        fieldSize: 16 * 1024,
        fields: 250,
        files: 1,
        parts: 251,
    },
    fileFilter(_request, file, callback) {
        if (!allowedImageTypes.has(file.mimetype)) {
            callback(new Error("Upload a JPEG, PNG, GIF, or WebP passport photo."));
            return;
        }

        callback(null, true);
    },
});

function hasValidImageSignature(buffer, mimeType) {
    if (mimeType === "image/jpeg") {
        return (
            buffer.length >= 3 &&
            buffer[0] === 0xff &&
            buffer[1] === 0xd8 &&
            buffer[2] === 0xff
        );
    }
    if (mimeType === "image/png") {
        return buffer
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    if (mimeType === "image/gif") {
        return buffer.subarray(0, 6).toString("ascii").match(/^GIF8[79]a$/) !== null;
    }
    if (mimeType === "image/webp") {
        return (
            buffer.length >= 12 &&
            buffer.toString("ascii", 0, 4) === "RIFF" &&
            buffer.toString("ascii", 8, 12) === "WEBP"
        );
    }

    return false;
}

app.disable("x-powered-by");

app.post(
    "/api/applications",
    upload.single("passport-photo"),
    (request, response, next) => {
        try {
            const fields = Object.create(null);

            for (const [name, rawValue] of Object.entries(request.body)) {
                if (name === "application-number") {
                    continue;
                }

                const values = Array.isArray(rawValue) ? rawValue : [rawValue];
                fields[name] = values.map((value) => value.trim());
                if (fields[name].length === 1) {
                    fields[name] = fields[name][0];
                }
            }

            for (const checkbox of[
                    "check-certificates",
                    "check-funding",
                    "check-payment",
                ]) {
                fields[checkbox] = fields[checkbox] === "on";
            }

            if (!fields["first-name"] || !fields.surname) {
                response.status(400).json({
                    error: "Please provide the applicant's first name and surname.",
                });
                return;
            }

            if (
                request.file &&
                !hasValidImageSignature(request.file.buffer, request.file.mimetype)
            ) {
                response.status(400).json({
                    error: "The uploaded file is not a valid supported image.",
                });
                return;
            }

            const submittedAt = new Date().toISOString();
            const insertApplication = database.prepare(`
      INSERT INTO applications (
        submitted_at,
        fields_json,
        photo,
        photo_mime_type,
        photo_original_name
      ) VALUES (?, ?, ?, ?, ?)
    `);
            const updateApplicationNumber = database.prepare(`
      UPDATE applications SET application_number = ? WHERE id = ?
    `);

            const saveApplication = database.transaction(() => {
                const result = insertApplication.run(
                    submittedAt,
                    JSON.stringify(fields),
                    request.file ? request.file.buffer : null,
                    request.file ? request.file.mimetype : null,
                    request.file ? path.basename(request.file.originalname) : null,
                );
                const applicationNumber = `DMI-${submittedAt.slice(0, 4)}-${String(
          result.lastInsertRowid,
        ).padStart(6, "0")}`;

                updateApplicationNumber.run(applicationNumber, result.lastInsertRowid);
                return applicationNumber;
            });

            response.status(201).json({ applicationNumber: saveApplication() });
        } catch (error) {
            next(error);
        }
    },
);

app.use(express.static(formDirectory));
app.use("/api", (_request, response) => {
    response.status(404).json({ error: "API endpoint not found." });
});

app.use((error, _request, response, _next) => {
    if (error instanceof multer.MulterError) {
        const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        response
            .status(status)
            .json({ error: "The submitted form or photo exceeds the allowed limits." });
        return;
    }

    if (error.message.startsWith("Upload a JPEG")) {
        response.status(400).json({ error: error.message });
        return;
    }

    console.error("Failed to save application:", error);
    response
        .status(500)
        .json({ error: "Unable to save the application. Please try again later." });
});

app.listen(port, () => {
    console.log(`DMI application form is available at http://localhost:${port}`);
});