/**
 * Main application entry point
 * Wires together all modules and sets up event listeners
 */

// Import DOM elements first (side-effect import to ensure DOM refs are available)
import "./dom-elements.js";

// Import config state (side-effect import)
import "./config-state.js";

// Import config modules
import { setupAppConfigListeners } from "./config/app-config.js";
import {
  initializeConfig,
  initializeEditor,
  setupConfigIOListeners,
  updateGeneratedConfig,
} from "./config/config-io.js";
import { setupPlanListeners } from "./config/plans.js";
import {
  renderPricingVersions,
  setupPricingVersionListeners,
} from "./config/pricing-versions.js";
import { clientSecret } from "./dom-elements.js";
import {
  initializeAccountData,
  setupAccountDataListeners,
} from "./ui/account-data.js";
import { setupDropdownListeners } from "./ui/dropdowns.js";
import { setupPreviewListeners } from "./ui/preview.js";
// Import UI modules
import { setupTabs } from "./ui/tabs.js";
import { updateUI } from "./ui/ui-updates.js";
// Import webhook modules
import { setupSendWebhookListener } from "./webhook/send.js";

// Wait for DOM to be fully ready before initializing
function initializeApp() {
  // Initialize all modules
  setupTabs();
  setupAppConfigListeners();
  setupPricingVersionListeners();
  setupPlanListeners();
  setupConfigIOListeners();
  setupDropdownListeners();
  setupPreviewListeners();
  setupAccountDataListeners();
  setupSendWebhookListener();

  // Initialize config from localStorage (this also updates the UI)
  initializeConfig();

  // Initialize CodeMirror editor AFTER config is loaded
  initializeEditor();

  // Always render pricing versions UI
  renderPricingVersions();

  // Ensure textarea is updated (in case no config was loaded)
  updateGeneratedConfig();

  // Initialize account data
  initializeAccountData();

  // Initialize main UI
  updateUI();

  // Restore client secret from sessionStorage (persists until window closes)
  const savedClientSecret = sessionStorage.getItem(
    "lifecycle_webhook_client_secret",
  );
  if (savedClientSecret) {
    clientSecret.value = savedClientSecret;
  }

  // Save client secret to sessionStorage on change (persists until window closes)
  clientSecret.addEventListener("input", () => {
    if (clientSecret.value) {
      sessionStorage.setItem(
        "lifecycle_webhook_client_secret",
        clientSecret.value,
      );
    } else {
      sessionStorage.removeItem("lifecycle_webhook_client_secret");
    }
  });

  // Restore event form state after UI is initialized
  // Use setTimeout to ensure all UI updates are complete
  setTimeout(() => {
    import("./helpers/restore-event-state.js").then(
      ({ restoreEventFormStateAfterUpdate }) => {
        restoreEventFormStateAfterUpdate();
      },
    );
  }, 100);
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  // DOM is already ready
  initializeApp();
}
