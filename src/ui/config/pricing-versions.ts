import {
  getActivePricingVersion,
  getGeneratedConfigData,
  setActivePricingVersion,
  setGeneratedConfigData,
} from "../config-state.js";
import {
  addPricingVersionBtn,
  newPricingVersion,
  pricingVersionError,
  pricingVersionsList,
} from "../dom-elements.js";
import { showMessage } from "../helpers/messages.js";
import { updateGeneratedConfig } from "./config-io.js";
import { renderPlans } from "./plans.js";

/**
 * Add a new pricing version
 */
export function addPricingVersion() {
  try {
    if (!newPricingVersion) {
      showMessage("Form field not found", "error");
      return;
    }

    const version = newPricingVersion.value.trim();

    // Clear any previous error
    if (pricingVersionError) {
      pricingVersionError.style.display = "none";
      pricingVersionError.textContent = "";
    }

    if (!version) {
      if (pricingVersionError) {
        pricingVersionError.textContent = "Pricing version is required";
        pricingVersionError.style.display = "block";
      }
      showMessage("Pricing version is required", "error");
      return;
    }

    // Validate that version is a string of digits
    if (!/^\d+$/.test(version)) {
      if (pricingVersionError) {
        pricingVersionError.textContent =
          "Pricing version must be a number (digits only)";
        pricingVersionError.style.display = "block";
      }
      showMessage("Pricing version must be a number (digits only)", "error");
      return;
    }

    const generatedConfigData = getGeneratedConfigData();
    if (!generatedConfigData.pricing_version) {
      generatedConfigData.pricing_version = {};
    }

    if (version in generatedConfigData.pricing_version) {
      if (pricingVersionError) {
        pricingVersionError.textContent = "Pricing version already exists!";
        pricingVersionError.style.display = "block";
      }
      showMessage("Pricing version already exists!", "error");
      return;
    }

    generatedConfigData.pricing_version[version] = {
      plans: {},
      freePlan: null,
      trialPlan: null,
    };
    setGeneratedConfigData(generatedConfigData);

    // Set the new version as active
    setActivePricingVersion(version);

    // Clear form and error
    newPricingVersion.value = "";
    if (pricingVersionError) {
      pricingVersionError.style.display = "none";
      pricingVersionError.textContent = "";
    }

    renderPricingVersions();
    renderPlans();
    updateGeneratedConfig();
    showMessage("Pricing version added successfully!", "success");
  } catch (error) {
    console.error("Error in addPricingVersion:", error);
    showMessage(`Error adding pricing version: ${error}`, "error");
  }
}

/**
 * Remove a pricing version
 */
export function removePricingVersion(version: string) {
  const generatedConfigData = getGeneratedConfigData();
  if (generatedConfigData.pricing_version) {
    delete generatedConfigData.pricing_version[version];
    setGeneratedConfigData(generatedConfigData);
  }

  // Clear active version if it was the one being removed
  if (getActivePricingVersion() === version) {
    setActivePricingVersion(null);
    renderPlans();
  }

  renderPricingVersions();
  updateGeneratedConfig();
}

/**
 * Set a pricing version as active
 */
export function setPricingVersionActive(version: string) {
  setActivePricingVersion(version);
  renderPricingVersions();
  renderPlans();
}

/**
 * Render the list of pricing versions
 */
export function renderPricingVersions() {
  if (!pricingVersionsList) return;
  pricingVersionsList.innerHTML = "";

  const generatedConfigData = getGeneratedConfigData();
  if (!generatedConfigData.pricing_version) {
    return;
  }

  const activeVersion = getActivePricingVersion();

  for (const [version] of Object.entries(generatedConfigData.pricing_version)) {
    const versionItem = document.createElement("div");
    versionItem.className = "pricing-version-item";

    const isActive = activeVersion === version;
    const radioId = `pricing-version-radio-${version}`;

    // Create radio button
    const radioInput = document.createElement("input");
    radioInput.type = "radio";
    radioInput.id = radioId;
    radioInput.name = "active-pricing-version";
    radioInput.value = version;
    radioInput.checked = isActive;
    radioInput.className = "pricing-version-radio";
    radioInput.addEventListener("change", () => {
      if (radioInput.checked) {
        setPricingVersionActive(version);
      }
    });

    // Create label
    const label = document.createElement("label");
    label.htmlFor = radioId;
    label.className = "pricing-version-label";
    label.textContent = `Pricing Version ${version}`;

    // Create remove button
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-button pricing-version-remove";
    removeBtn.textContent = "Remove";
    removeBtn.onclick = () => {
      if (
        confirm(
          `Remove pricing version ${version}? This will also remove all plans in this version.`,
        )
      ) {
        removePricingVersion(version);
      }
    };

    // Assemble the item
    versionItem.appendChild(radioInput);
    versionItem.appendChild(label);
    versionItem.appendChild(removeBtn);

    pricingVersionsList.appendChild(versionItem);
  }
}

/**
 * Get the highest pricing version number
 */
function getHighestPricingVersion(): string | null {
  const generatedConfigData = getGeneratedConfigData();
  if (!generatedConfigData.pricing_version) {
    return null;
  }

  const versions = Object.keys(generatedConfigData.pricing_version);
  if (versions.length === 0) {
    return null;
  }

  // Sort versions numerically (convert to numbers for comparison)
  const sortedVersions = versions.sort((a, b) => {
    const numA = Number(a);
    const numB = Number(b);
    // Handle non-numeric versions by comparing as strings
    if (Number.isNaN(numA) || Number.isNaN(numB)) {
      return a.localeCompare(b);
    }
    return numB - numA; // Descending order
  });

  return sortedVersions[0];
}

/**
 * Set the active pricing version to the highest (for initial load)
 */
export function setActivePricingVersionToHighest() {
  const highestVersion = getHighestPricingVersion();
  if (highestVersion) {
    setActivePricingVersion(highestVersion);
    renderPricingVersions();
    renderPlans();
  }
}

/**
 * Setup event listeners for pricing versions
 */
export function setupPricingVersionListeners() {
  if (addPricingVersionBtn) {
    addPricingVersionBtn.addEventListener("click", (e) => {
      e.preventDefault();
      addPricingVersion();
    });
  }

  // Clear error message when user starts typing
  if (newPricingVersion && pricingVersionError) {
    newPricingVersion.addEventListener("input", () => {
      if (!pricingVersionError) return;
      if (pricingVersionError.style.display !== "none") {
        pricingVersionError.style.display = "none";
        pricingVersionError.textContent = "";
      }
    });
  }
}

// Expose to window for onclick handlers
(window as unknown as Record<string, unknown>).removePricingVersionFromUI = (
  version: string,
) => {
  if (
    confirm(
      `Remove pricing version ${version}? This will also remove all plans in this version.`,
    )
  ) {
    removePricingVersion(version);
  }
};
