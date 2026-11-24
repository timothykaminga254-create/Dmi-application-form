# DMI Application Form

The application form uses a Node.js server and SQLite database to store submitted
applicant details and the optional passport photo.

## Run locally

1. Install Node.js 20 or later.
2. From the repository directory, run `npm install`.
3. Run `npm start`.
4. Open <http://localhost:3000>.

The server creates `data/applications.sqlite` automatically. That file contains
applicant personal data and uploaded photos; it is excluded from Git. Back it up
securely and restrict access to the machine and its backups.

Set `PORT` to change the listening port. Set `DATABASE_PATH` to choose another
SQLite file location. For deployment, use a host with persistent disk storage
and HTTPS; ephemeral filesystems will not retain the database across restarts.

Submissions are created through `POST /api/applications`. The API returns the
generated application number; it does not expose a public endpoint for reading
applicant records.
