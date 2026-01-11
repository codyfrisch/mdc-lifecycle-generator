import { validateConfig } from "../core/config-loader.js";
import type { ConfigData } from "../types.js";

const STORAGE_KEY = "lifecycle_webhook_config";

/**
 * Global config state
 */
export let config: ConfigData | null = null;

/**
 * Set the global config
 */
export function setConfig(newConfig: ConfigData | null) {
  config = newConfig;
}

/**
 * Get the global config
 */
export function getConfig(): ConfigData | null {
  return config;
}

/**
 * Config generator state
 */
export let generatedConfigData: ConfigData = {
  app_id: "",
  app_name: "",
  webhook_url: "",
  pricing_version: {},
};

/**
 * Set the generated config data
 */
export function setGeneratedConfigData(data: ConfigData) {
  generatedConfigData = data;
}

/**
 * Get the generated config data
 */
export function getGeneratedConfigData(): ConfigData {
  return generatedConfigData;
}

/**
 * Active pricing version state (for UI)
 */
let activePricingVersionState: string | null = null;

/**
 * Set the active pricing version
 */
export function setActivePricingVersion(version: string | null): void {
  activePricingVersionState = version;
}

/**
 * Get the active pricing version
 */
export function getActivePricingVersion(): string | null {
  return activePricingVersionState;
}

/**
 * Save config to localStorage
 */
export function saveConfigToStorage(data: ConfigData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save config to localStorage:", error);
  }
}

/**
 * Load config from localStorage
 */
export function loadConfigFromStorage(): ConfigData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as ConfigData;
    if (validateConfig(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear config from localStorage and reset to defaults
 */
export function resetConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // Reset global config state
    config = null;
    // Reset generated config data to defaults
    generatedConfigData = {
      app_id: "",
      app_name: "",
      webhook_url: "",
      pricing_version: {},
    };
    // Reset active pricing version
    activePricingVersionState = null;
  } catch (error) {
    console.error("Failed to reset config:", error);
  }
}
