import {
  getGeneratedConfigData,
  setGeneratedConfigData,
} from "../config-state.js";
import {
  appConfigId,
  appConfigName,
  appConfigWebhookUrl,
} from "../dom-elements.js";
import { updateGeneratedConfig } from "./config-io.js";

/**
 * Update app config from UI inputs
 */
export function updateAppConfigFromUI() {
  if (!appConfigId || !appConfigName || !appConfigWebhookUrl) {
    return;
  }

  const generatedConfigData = getGeneratedConfigData();
  generatedConfigData.app_id = appConfigId.value.trim();
  generatedConfigData.app_name = appConfigName.value.trim();
  generatedConfigData.webhook_url = appConfigWebhookUrl.value.trim();
  setGeneratedConfigData(generatedConfigData);

  // Update textarea to reflect changes
  updateGeneratedConfig();
}

/**
 * Setup event listeners for app config fields
 */
export function setupAppConfigListeners() {
  if (appConfigId) {
    appConfigId.addEventListener("input", updateAppConfigFromUI);
    appConfigId.addEventListener("change", updateAppConfigFromUI);
  }
  if (appConfigName) {
    appConfigName.addEventListener("input", updateAppConfigFromUI);
    appConfigName.addEventListener("change", updateAppConfigFromUI);
  }
  if (appConfigWebhookUrl) {
    appConfigWebhookUrl.addEventListener("input", updateAppConfigFromUI);
    appConfigWebhookUrl.addEventListener("change", updateAppConfigFromUI);
  }
}
