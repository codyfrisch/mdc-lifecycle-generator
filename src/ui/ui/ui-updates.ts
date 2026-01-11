import { updatePlanOptions, updatePricingVersions } from "./dropdowns.js";
import { updatePreview } from "./preview.js";

/**
 * Update all UI elements
 * @param preserveSelections - If true, preserve dropdown selections
 */
export function updateUI(preserveSelections = false) {
  updatePricingVersions(preserveSelections);
  updatePlanOptions(preserveSelections);
  updatePreview();
}
