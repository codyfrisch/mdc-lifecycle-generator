import type { AppConfig, ConfigData, PlanConfig } from "../types.js";

/**
 * Load configuration data from JSON string or object
 */
export function loadConfig(data: string | ConfigData): ConfigData {
  if (typeof data === "string") {
    return JSON.parse(data) as ConfigData;
  }
  return data;
}

/**
 * Get app configuration (there's only one app)
 */
export function getAppConfig(
  config: ConfigData,
  appId: string,
): AppConfig | undefined {
  // Verify the app_id matches, but return the config itself
  if (config.app_id === appId) {
    return config;
  }
  return undefined;
}

/**
 * Get plan configuration by plan_id and pricing_version
 */
export function getPlanConfig(
  config: ConfigData,
  appId: string,
  planId: string,
  pricingVersion: number | string,
): PlanConfig | undefined {
  if (config.app_id !== appId) return undefined;
  const versionKey = String(pricingVersion);
  const versionData = config.pricing_version[versionKey];
  return versionData?.plans?.[planId];
}

/**
 * Get all plans for a pricing version (excluding freePlan/trialPlan metadata)
 */
export function getPlansForVersion(
  config: ConfigData,
  appId: string,
  pricingVersion: number | string,
): Record<string, PlanConfig> | undefined {
  if (config.app_id !== appId) return undefined;
  const versionKey = String(pricingVersion);
  const versionData = config.pricing_version[versionKey];
  return versionData?.plans;
}

/**
 * Get all pricing versions
 */
export function getPricingVersions(
  config: ConfigData,
  appId: string,
): string[] {
  if (config.app_id !== appId) return [];
  return Object.keys(config.pricing_version);
}

/**
 * Check if app has any free plan across all pricing versions
 */
export function hasFreePlan(config: ConfigData, appId: string): boolean {
  if (config.app_id !== appId) return false;
  for (const versionData of Object.values(config.pricing_version)) {
    if (versionData?.freePlan) {
      return true;
    }
  }
  return false;
}

/**
 * Check if app has any trial plan across all pricing versions
 */
export function hasTrialPlan(config: ConfigData, appId: string): boolean {
  if (config.app_id !== appId) return false;
  for (const versionData of Object.values(config.pricing_version)) {
    if (versionData?.trialPlan) {
      return true;
    }
  }
  return false;
}

/**
 * Validate config structure
 */
export function validateConfig(config: ConfigData): boolean {
  if (
    !config.app_id ||
    !config.app_name ||
    !config.webhook_url ||
    !config.pricing_version
  ) {
    return false;
  }

  // Validate pricing versions
  for (const [_version, versionData] of Object.entries(
    config.pricing_version,
  )) {
    if (!versionData || typeof versionData !== "object") {
      return false;
    }
    if (!versionData.plans || typeof versionData.plans !== "object") {
      return false;
    }
    // Validate freePlan and trialPlan metadata
    if (
      versionData.freePlan !== undefined &&
      versionData.freePlan !== null &&
      typeof versionData.freePlan !== "string"
    ) {
      return false;
    }
    if (
      versionData.trialPlan !== undefined &&
      versionData.trialPlan !== null &&
      typeof versionData.trialPlan !== "string"
    ) {
      return false;
    }
    // Validate plans
    for (const [_planId, plan] of Object.entries(versionData.plans)) {
      if (
        typeof plan !== "object" ||
        plan === null ||
        !plan.plan_id ||
        typeof plan.isFree !== "boolean" ||
        typeof plan.isTrial !== "boolean"
      ) {
        return false;
      }
    }
  }

  return true;
}
