import {
  getPlansForVersion,
  getPricingVersions,
} from "../../core/config-loader.js";
import type { PlanConfig } from "../../types.js";
import { getConfig } from "../config-state.js";
import { planId, pricingVersion } from "../dom-elements.js";

/**
 * Update pricing versions dropdown
 * @param preserveSelection - If true, preserve the currently selected value if it still exists
 */
export function updatePricingVersions(preserveSelection = false) {
  const config = getConfig();
  const currentValue = preserveSelection ? pricingVersion.value : "";

  if (!config) {
    pricingVersion.innerHTML =
      '<option value="">Select pricing version</option>';
    return;
  }

  const versions = getPricingVersions(config, config.app_id);
  pricingVersion.innerHTML = '<option value="">Select pricing version</option>';

  for (const version of versions) {
    const option = document.createElement("option");
    option.value = version;
    option.textContent = version;
    pricingVersion.appendChild(option);
  }

  // Restore selection if it still exists
  if (preserveSelection && currentValue && versions.includes(currentValue)) {
    pricingVersion.value = currentValue;
  }
}

/**
 * Update plan dropdown when pricing version changes
 * @param preserveSelection - If true, preserve the currently selected value if it still exists
 */
export function updatePlanOptions(preserveSelection = false) {
  const config = getConfig();
  if (!config) return;

  const version = pricingVersion.value;
  const currentValue = preserveSelection ? planId.value : "";

  if (!version) {
    planId.innerHTML = '<option value="">Select a plan</option>';
    return;
  }

  const plans = getPlansForVersion(config, config.app_id, version);

  planId.innerHTML = '<option value="">Select a plan</option>';

  if (plans) {
    // Sort plans by plan_index (higher index = higher tier)
    const sortedPlans = Object.entries(plans)
      .filter(([key]) => key !== "freePlan" && key !== "trialPlan")
      .filter(([_, plan]) => typeof plan === "object" && plan !== null)
      .sort(([_, a], [__, b]) => {
        const planA = a as PlanConfig;
        const planB = b as PlanConfig;
        return (planA.plan_index ?? 0) - (planB.plan_index ?? 0);
      });

    for (const [planIdValue, plan] of sortedPlans) {
      const planConfig = plan as PlanConfig;
      const option = document.createElement("option");
      option.value = planIdValue;
      option.textContent = `${planConfig.plan_id} ${planConfig.isFree ? "(Free)" : ""} ${planConfig.isTrial ? "(Trial)" : ""}`;
      planId.appendChild(option);
    }

    // Restore selection if it still exists
    if (preserveSelection && currentValue && plans[currentValue]) {
      planId.value = currentValue;
    }
  }
}

/**
 * Setup event listeners for dropdowns
 */
export function setupDropdownListeners() {
  pricingVersion.addEventListener("change", () => {
    // Preserve plan selection when pricing version changes
    updatePlanOptions(true);
  });
}
