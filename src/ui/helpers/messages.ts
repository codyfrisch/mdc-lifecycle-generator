import { history, responseMessage } from "../dom-elements.js";

/**
 * Show a message to the user
 */
export function showMessage(message: string, type: "success" | "error") {
  responseMessage.textContent = message;
  responseMessage.className = type;
  responseMessage.style.display = "block";

  setTimeout(() => {
    responseMessage.style.display = "none";
  }, 5000);
}

/**
 * Add an event to the history
 */
export function addToHistory(
  eventType: string,
  result: { status: number; statusText: string },
) {
  const item = document.createElement("div");
  item.className = "history-item";
  item.innerHTML = `
    <div><strong>${eventType}</strong></div>
    <div class="history-time">${new Date().toLocaleString()}</div>
    <div>Status: ${result.status} ${result.statusText}</div>
  `;
  history.insertBefore(item, history.firstChild);
}
