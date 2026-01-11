import { updateGeneratedConfig } from "../config/config-io.js";
import {
  accountUserConfigPanel,
  billingPeriod,
  configPanel,
  eventType,
  manageLifecyclePanel,
  planId,
  pricingVersion,
  reason,
  renewalDate,
  tabAccountUserConfig,
  tabConfig,
  tabManageLifecycle,
} from "../dom-elements.js";
import {
  type EventFormState,
  loadEventFormState,
  saveEventFormState,
} from "../helpers/event-form-state.js";
import { updatePlanOptions, updatePricingVersions } from "./dropdowns.js";

/**
 * Debounced auto-save timer for event form
 */
let eventFormAutoSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Save current event form state
 */
function saveCurrentEventFormState() {
  const state: EventFormState = {
    event_type: eventType.value || "",
    pricing_version: pricingVersion.value || "",
    plan_id: planId.value || "",
    billing_period: billingPeriod.value || "",
    renewal_date: renewalDate.value || "",
    reason: reason.value || "",
    // client_secret is NOT saved - session only
  };
  saveEventFormState(state);
}

/**
 * Auto-save event form state with 2 second debounce
 */
function autoSaveEventFormState() {
  // Clear existing timer
  if (eventFormAutoSaveTimer) {
    clearTimeout(eventFormAutoSaveTimer);
  }

  // Set new timer for 2 seconds
  eventFormAutoSaveTimer = setTimeout(() => {
    saveCurrentEventFormState();
    eventFormAutoSaveTimer = null;
  }, 2000);
}

/**
 * Restore and initialize Manage Lifecycle tab state
 */
function initializeManageLifecycleTab() {
  // Load saved state first
  const saved = loadEventFormState();

  // Update dropdowns first (they need to be populated)
  updatePricingVersions();

  // Use setTimeout to ensure dropdowns are fully updated before restoring
  setTimeout(() => {
    // Restore pricing version first if saved
    if (saved?.pricing_version) {
      pricingVersion.value = saved.pricing_version;
      // Manually trigger plan options update (change event listener will also fire)
      updatePlanOptions();
    } else {
      updatePlanOptions();
    }

    // Restore all form fields after dropdowns are updated
    if (saved) {
      eventType.value = saved.event_type || "";
      planId.value = saved.plan_id || "";
      billingPeriod.value = saved.billing_period || "";
      renewalDate.value = saved.renewal_date || "";
      reason.value = saved.reason || "";
      // client_secret is NOT restored - session only (handled in app.ts)
    }
  }, 10);
}

/**
 * Setup auto-save listeners for event form fields
 */
function setupEventFormAutoSave() {
  // Auto-save for fields that should be persisted (excluding client_secret)
  const eventFormInputs = [
    eventType,
    pricingVersion,
    planId,
    billingPeriod,
    renewalDate,
    reason,
    // client_secret is NOT included - session only
  ];

  eventFormInputs.forEach((input) => {
    input.addEventListener("input", autoSaveEventFormState);
    input.addEventListener("change", () => {
      // Save immediately on change (for selects)
      if (eventFormAutoSaveTimer) {
        clearTimeout(eventFormAutoSaveTimer);
        eventFormAutoSaveTimer = null;
      }
      saveCurrentEventFormState();
    });
  });

  // client_secret is session-only, no auto-save
}

/**
 * Setup tab switching functionality
 */
export function setupTabs() {
  // Setup auto-save for event form fields
  setupEventFormAutoSave();

  // Initialize Manage Lifecycle tab on page load (it's the default active tab)
  initializeManageLifecycleTab();

  tabConfig.addEventListener("click", () => {
    // Save event form state before switching away
    saveCurrentEventFormState();

    tabConfig.classList.add("active");
    tabAccountUserConfig.classList.remove("active");
    tabManageLifecycle.classList.remove("active");
    configPanel.style.display = "block";
    accountUserConfigPanel.style.display = "none";
    manageLifecyclePanel.style.display = "none";
    updateGeneratedConfig();
  });

  tabAccountUserConfig.addEventListener("click", () => {
    // Save event form state before switching away
    saveCurrentEventFormState();

    tabAccountUserConfig.classList.add("active");
    tabConfig.classList.remove("active");
    tabManageLifecycle.classList.remove("active");
    configPanel.style.display = "none";
    accountUserConfigPanel.style.display = "block";
    manageLifecyclePanel.style.display = "none";
  });

  tabManageLifecycle.addEventListener("click", () => {
    tabManageLifecycle.classList.add("active");
    tabConfig.classList.remove("active");
    tabAccountUserConfig.classList.remove("active");
    configPanel.style.display = "none";
    accountUserConfigPanel.style.display = "none";
    manageLifecyclePanel.style.display = "block";

    // Initialize/restore the Manage Lifecycle tab state
    initializeManageLifecycleTab();
  });
}
