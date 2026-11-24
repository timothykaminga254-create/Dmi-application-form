const form = document.querySelector(".application-form");
const submitButton = form.querySelector('button[type="submit"]');
const statusMessage = document.createElement("p");

statusMessage.className = "form-status";
statusMessage.setAttribute("role", "status");
statusMessage.setAttribute("aria-live", "polite");
statusMessage.hidden = true;
form.querySelector(".form-actions").before(statusMessage);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  statusMessage.hidden = true;
  statusMessage.classList.remove("is-error");

  try {
    let response;
    try {
      response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
      });
    } catch {
      throw new Error(
        "Unable to connect to the application server. Start it with `npm start` and open http://localhost:3000.",
      );
    }

    const responseText = await response.text();
    let result;
    try {
      if (!responseText.trim()) {
        throw new Error("The server returned an empty response.");
      }

      result = JSON.parse(responseText);
    } catch {
      throw new Error(
        `The server returned an invalid response (HTTP ${response.status}). Start the application with \`npm start\` and open http://localhost:3000.`,
      );
    }

    if (!response.ok) {
      throw new Error(result.error || "Unable to submit the application.");
    }

    if (
      typeof result.applicationNumber !== "string" ||
      !result.applicationNumber
    ) {
      throw new Error("The server did not return an application number.");
    }

    form.elements.namedItem("application-number").value =
      result.applicationNumber;
    statusMessage.textContent = `Application submitted successfully. Your application number is ${result.applicationNumber}.`;
  } catch (error) {
    statusMessage.textContent = error.message;
    statusMessage.classList.add("is-error");
  } finally {
    statusMessage.hidden = false;
    submitButton.disabled = false;
  }
});
