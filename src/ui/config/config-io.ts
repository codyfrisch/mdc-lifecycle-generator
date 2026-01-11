import { validateConfig } from "../../core/config-loader.js";
import {
  getGeneratedConfigData,
  loadConfigFromStorage,
  resetConfig as resetConfigState,
  saveConfigToStorage,
  setConfig,
  setGeneratedConfigData,
} from "../config-state.js";
import {
  appConfigId,
  appConfigName,
  appConfigWebhookUrl,
  configUpload,
  copyConfigBtn,
  downloadConfigBtn,
  generatedConfig,
  resetConfigBtn,
} from "../dom-elements.js";
import { toSnakeCase } from "../helpers/formatting.js";
import { showMessage } from "../helpers/messages.js";
import { updatePricingVersions } from "../ui/dropdowns.js";
import { updateUI } from "../ui/ui-updates.js";
import {
  getEditorValue,
  initJsonEditor,
  setEditorValue,
} from "./json-editor.js";
import {
  renderPricingVersions,
  setActivePricingVersionToHighest,
} from "./pricing-versions.js";

/**
 * Debounced auto-save/load timer for config
 */
let configAutoSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Auto-save and load config with 2 second debounce
 */
function autoSaveAndLoadConfig() {
  // Clear existing timer
  if (configAutoSaveTimer) {
    clearTimeout(configAutoSaveTimer);
  }

  // Set new timer for 2 seconds
  configAutoSaveTimer = setTimeout(() => {
    try {
      const configText = getEditorValue().trim();
      if (!configText) return;

      const parsed = JSON.parse(configText);
      if (validateConfig(parsed)) {
        // Save to localStorage
        saveConfigToStorage(parsed);
        // Load into app state
        setConfig(parsed);
        setGeneratedConfigData(parsed);

        // Update UI fields
        if (appConfigId) appConfigId.value = parsed.app_id || "";
        if (appConfigName) appConfigName.value = parsed.app_name || "";
        if (appConfigWebhookUrl)
          appConfigWebhookUrl.value = parsed.webhook_url || "";

        // Update UI (preserve event form selections)
        renderPricingVersions();
        updatePricingVersions(true);
        updateUI(true);

        // Restore event form state after UI update
        setTimeout(() => {
          import("../helpers/restore-event-state.js").then(
            ({ restoreEventFormStateAfterUpdate }) => {
              restoreEventFormStateAfterUpdate();
            },
          );
        }, 50);
      }
    } catch {
      // Invalid JSON, don't save/load
    }
    configAutoSaveTimer = null;
  }, 2000);
}

/**
 * Save config immediately (for button actions)
 */
export function saveConfigImmediately() {
  // Clear any pending auto-save
  if (configAutoSaveTimer) {
    clearTimeout(configAutoSaveTimer);
    configAutoSaveTimer = null;
  }

  const generatedConfigData = getGeneratedConfigData();
  saveConfigToStorage(generatedConfigData);

  // Update global config state so dropdowns can access it
  setConfig(generatedConfigData);

  // Also update the editor if it exists
  const jsonString = JSON.stringify(generatedConfigData, null, 2);
  setEditorValue(jsonString);

  // Update dropdowns on Send Event tab (preserve selections)
  updatePricingVersions(true);
  // Restore event form state after update
  setTimeout(() => {
    import("../helpers/restore-event-state.js").then(
      ({ restoreEventFormStateAfterUpdate }) => {
        restoreEventFormStateAfterUpdate();
      },
    );
  }, 50);
}

/**
 * Update the generated config JSON editor
 */
export function updateGeneratedConfig() {
  if (!generatedConfig) {
    console.warn("generatedConfig container not found");
    return;
  }
  const generatedConfigData = getGeneratedConfigData();
  const jsonString = JSON.stringify(generatedConfigData, null, 2);
  setEditorValue(jsonString);
  // Auto-save immediately when updated from button actions
  saveConfigImmediately();
}

/**
 * Copy config to clipboard
 */
export function copyConfig() {
  const value = getEditorValue();
  navigator.clipboard
    .writeText(value)
    .then(() => {
      showMessage("Config copied to clipboard!", "success");
    })
    .catch(() => {
      showMessage("Failed to copy config", "error");
    });
}

/**
 * Download config as JSON file
 */
export function downloadConfig() {
  const value = getEditorValue();
  const blob = new Blob([value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  // Generate filename: app_id-app_name.json (app_name in snake_case)
  const generatedConfigData = getGeneratedConfigData();
  const appId = generatedConfigData.app_id || "app";
  const appName = generatedConfigData.app_name || "config";
  const snakeCaseName = toSnakeCase(appName);
  const filename = `${appId}-${snakeCaseName}.json`;

  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showMessage("Config downloaded!", "success");
}

/**
 * Load config from the JSON editor
 */
export function loadGeneratedConfig() {
  try {
    const configText = getEditorValue().trim();
    if (!configText) {
      showMessage("Config JSON is empty", "error");
      return;
    }

    const parsed = JSON.parse(configText);
    if (validateConfig(parsed)) {
      setConfig(parsed);
      // Update generated config data if it's valid
      setGeneratedConfigData(parsed);
      // Save to localStorage
      saveConfigToStorage(parsed);
      // Update the UI to reflect the loaded config
      if (appConfigId) appConfigId.value = parsed.app_id || "";
      if (appConfigName) appConfigName.value = parsed.app_name || "";
      if (appConfigWebhookUrl)
        appConfigWebhookUrl.value = parsed.webhook_url || "";
      renderPricingVersions();
      setActivePricingVersionToHighest(); // Default to highest on load
      updatePricingVersions(true);
      updateUI(true);
      // Restore event form state after UI update
      setTimeout(() => {
        import("../helpers/restore-event-state.js").then(
          ({ restoreEventFormStateAfterUpdate }) => {
            restoreEventFormStateAfterUpdate();
          },
        );
      }, 50);
      showMessage("Config loaded and saved successfully!", "success");
    } else {
      showMessage("Invalid config structure", "error");
    }
  } catch (error) {
    showMessage(`Error parsing config: ${error}`, "error");
  }
}

/**
 * Handle config file upload
 */
export function handleConfigUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result as string;
    if (text) {
      setEditorValue(text);
      loadGeneratedConfig();
      // loadGeneratedConfig already saves to localStorage
    }
  };
  reader.readAsText(file);
}

/**
 * Load config from localStorage on initialization
 */
export function initializeConfig() {
  const savedConfig = loadConfigFromStorage();
  if (savedConfig) {
    console.log("Loading config from localStorage", savedConfig);
    setConfig(savedConfig);
    setGeneratedConfigData(savedConfig);

    // Update UI fields
    if (appConfigId) appConfigId.value = savedConfig.app_id || "";
    if (appConfigName) appConfigName.value = savedConfig.app_name || "";
    if (appConfigWebhookUrl)
      appConfigWebhookUrl.value = savedConfig.webhook_url || "";

    // Update UI (editor will be initialized with this config in initializeEditor)
    renderPricingVersions();
    setActivePricingVersionToHighest(); // Default to highest on initial load
    updatePricingVersions(true);
    updateUI(true);
    // Restore event form state after UI update
    setTimeout(() => {
      import("../helpers/restore-event-state.js").then(
        ({ restoreEventFormStateAfterUpdate }) => {
          restoreEventFormStateAfterUpdate();
        },
      );
    }, 50);
  } else {
    console.log("No saved config found, using defaults");
    // Update UI even with defaults
    renderPricingVersions();
    updatePricingVersions(true);
    updateUI(true);
    // Restore event form state after UI update
    setTimeout(() => {
      import("../helpers/restore-event-state.js").then(
        ({ restoreEventFormStateAfterUpdate }) => {
          restoreEventFormStateAfterUpdate();
        },
      );
    }, 50);
  }
}

/**
 * Reset config to defaults
 */
export function resetConfig() {
  if (
    !confirm(
      "Are you sure you want to reset the config? This will clear all stored data and cannot be undone.",
    )
  ) {
    return;
  }

  // Clear localStorage and reset state
  resetConfigState();

  // Clear form fields
  if (appConfigId) appConfigId.value = "";
  if (appConfigName) appConfigName.value = "";
  if (appConfigWebhookUrl) appConfigWebhookUrl.value = "";

  // Clear editor
  const emptyConfig = {
    app_id: "",
    app_name: "",
    webhook_url: "",
    pricing_version: {},
  };
  const jsonString = JSON.stringify(emptyConfig, null, 2);
  setEditorValue(jsonString);

  // Update UI (no need to preserve selections on reset)
  renderPricingVersions();
  updatePricingVersions();
  updateUI();

  showMessage("Config reset successfully!", "success");
}

/**
 * Initialize the CodeMirror editor (called after config is loaded)
 */
export function initializeEditor() {
  if (!generatedConfig) {
    console.error("generatedConfig container not found");
    return;
  }

  console.log("Initializing CodeMirror editor in container:", generatedConfig);

  // Load config from localStorage first to get the initial value
  const savedConfig = loadConfigFromStorage();
  const initialData = savedConfig || getGeneratedConfigData();
  const initialValue = JSON.stringify(initialData, null, 2);

  console.log("Initial editor value length:", initialValue.length);

  try {
    initJsonEditor(generatedConfig, initialValue, () => {
      autoSaveAndLoadConfig();
    });
    console.log("CodeMirror editor initialized successfully");
  } catch (error) {
    console.error("Failed to initialize CodeMirror editor:", error);
  }
}

/**
 * Setup event listeners for config I/O
 */
export function setupConfigIOListeners() {
  if (copyConfigBtn) {
    copyConfigBtn.addEventListener("click", copyConfig);
  }

  if (downloadConfigBtn) {
    downloadConfigBtn.addEventListener("click", downloadConfig);
  }

  if (resetConfigBtn) {
    resetConfigBtn.addEventListener("click", resetConfig);
  }

  if (configUpload) {
    configUpload.addEventListener("change", handleConfigUpload);
  }
}
