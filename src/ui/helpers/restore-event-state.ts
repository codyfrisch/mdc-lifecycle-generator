/**
 * Helper to restore event form state after UI updates
 * This should be called after any updateUI() call that might clear dropdowns
 */

import {
  billingPeriod,
  eventType,
  planId,
  pricingVersion,
  reason,
} from "../dom-elements.js";
import { updatePlanOptions, updatePricingVersions } from "../ui/dropdowns.js";
import { loadEventFormState } from "./event-form-state.js";

/**
 * Restore event form state after dropdowns are updated
 */
export function restoreEventFormStateAfterUpdate() {
  const saved = loadEventFormState();
  if (!saved) return;

  // Update dropdowns with preserved selections
  updatePricingVersions(true);

  // Set pricing version if saved
  if (saved.pricing_version) {
    pricingVersion.value = saved.pricing_version;
    updatePlanOptions(true);
  } else {
    updatePlanOptions(true);
  }

  // Restore all form fields (except client_secret - session only)
  eventType.value = saved.event_type || "";
  planId.value = saved.plan_id || "";
  billingPeriod.value = saved.billing_period || "";
  reason.value = saved.reason || "";
  // client_secret is NOT restored - session only
}
