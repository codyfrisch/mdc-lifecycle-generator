/** biome-ignore-all lint/correctness/useParseIntRadix: parseInt is used for user input where radix is implicit */

import type { PlanConfig } from "../../types.js";
import {
  getActivePricingVersion,
  getGeneratedConfigData,
  setGeneratedConfigData,
} from "../config-state.js";
import {
  addPlanBtn,
  newPlanId,
  newPlanIsFree,
  newPlanIsTrial,
  newPlanMaxUnits,
  planError,
  plansList,
} from "../dom-elements.js";
import { showMessage } from "../helpers/messages.js";
import { saveConfigImmediately, updateGeneratedConfig } from "./config-io.js";

/**
 * Get the maximum plan_index for a pricing version
 */
function getMaxPlanIndex(version: string): number {
  const generatedConfigData = getGeneratedConfigData();
  const versionData = generatedConfigData.pricing_version?.[version];
  if (!versionData?.plans) {
    return -1;
  }

  let maxIndex = -1;
  for (const plan of Object.values(versionData.plans)) {
    if (
      typeof plan === "object" &&
      plan !== null &&
      plan.plan_index !== undefined
    ) {
      maxIndex = Math.max(maxIndex, plan.plan_index);
    }
  }
  return maxIndex;
}

/**
 * Add a new plan to the active pricing version
 */
export function addPlan() {
  try {
    const version = getActivePricingVersion();
    if (!version) {
      showMessage("Please select a pricing version first", "error");
      return;
    }

    if (!newPlanId || !newPlanIsFree || !newPlanIsTrial || !newPlanMaxUnits) {
      showMessage("Form fields not found", "error");
      return;
    }
    // Clear any previous error
    if (planError) {
      planError.style.display = "none";
      planError.textContent = "";
    }

    const planId = newPlanId.value.trim();
    if (!planId) {
      if (planError) {
        planError.textContent = "Plan ID is required";
        planError.style.display = "block";
      }
      showMessage("Plan ID is required", "error");
      return;
    }

    const generatedConfigData = getGeneratedConfigData();
    if (
      !generatedConfigData.pricing_version ||
      !generatedConfigData.pricing_version[version]
    ) {
      if (planError) {
        planError.textContent = "Pricing version not found";
        planError.style.display = "block";
      }
      showMessage("Pricing version not found", "error");
      return;
    }

    const versionData = generatedConfigData.pricing_version[version];
    if (!versionData.plans) {
      versionData.plans = {};
    }

    if (planId in versionData.plans) {
      if (planError) {
        planError.textContent =
          "Plan ID already exists in this pricing version!";
        planError.style.display = "block";
      }
      showMessage("Plan ID already exists in this pricing version!", "error");
      return;
    }

    const isFree = newPlanIsFree.checked;
    const isTrial = newPlanIsTrial.checked;

    // Check if there's already a free plan
    if (isFree && versionData.freePlan) {
      if (planError) {
        planError.textContent =
          "A free plan already exists in this pricing version. Only one free plan is allowed.";
        planError.style.display = "block";
      }
      showMessage(
        "A free plan already exists in this pricing version. Only one free plan is allowed.",
        "error",
      );
      return;
    }

    // Check if there's already a trial plan
    if (isTrial && versionData.trialPlan) {
      if (planError) {
        planError.textContent =
          "A trial plan already exists in this pricing version. Only one trial plan is allowed.";
        planError.style.display = "block";
      }
      showMessage(
        "A trial plan already exists in this pricing version. Only one trial plan is allowed.",
        "error",
      );
      return;
    }

    // Auto-assign plan_index (max + 1)
    const maxIndex = getMaxPlanIndex(version);
    const newPlanIndex = maxIndex + 1;

    versionData.plans[planId] = {
      plan_id: planId,
      isFree,
      isTrial,
      plan_index: newPlanIndex,
      max_units: newPlanMaxUnits.value.trim()
        ? parseInt(newPlanMaxUnits.value)
        : null,
    };

    // Set freePlan or trialPlan if applicable
    if (isFree) {
      versionData.freePlan = planId;
    }
    if (isTrial) {
      versionData.trialPlan = planId;
    }
    setGeneratedConfigData(generatedConfigData);

    // Clear form and error
    newPlanId.value = "";
    newPlanIsFree.checked = false;
    newPlanIsTrial.checked = false;
    newPlanMaxUnits.value = "";
    if (planError) {
      planError.style.display = "none";
      planError.textContent = "";
    }

    renderPlans();
    updateGeneratedConfig();
    showMessage("Plan added successfully!", "success");
  } catch (error) {
    console.error("Error in addPlan:", error);
    showMessage(`Error adding plan: ${error}`, "error");
  }
}

/**
 * Remove a plan from a pricing version
 */
export function removePlanFromVersion(version: string, planId: string) {
  const planKey = `${version}-${planId}`;
  expandedPlans.delete(planKey);

  const generatedConfigData = getGeneratedConfigData();
  const versionData = generatedConfigData.pricing_version?.[version];
  if (versionData?.plans) {
    // Clear freePlan or trialPlan if this plan was set as such
    if (versionData.freePlan === planId) {
      versionData.freePlan = null;
    }
    if (versionData.trialPlan === planId) {
      versionData.trialPlan = null;
    }
    delete versionData.plans[planId];
    setGeneratedConfigData(generatedConfigData);
  }
  renderPlans();
  updateGeneratedConfig();
}

/**
 * Update plan_index values based on current display order
 */
function updatePlanIndicesFromOrder(version: string) {
  const generatedConfigData = getGeneratedConfigData();
  const versionData = generatedConfigData.pricing_version?.[version];
  if (!versionData?.plans || !plansList) {
    return;
  }

  // Get all plan items in their current DOM order
  const planItems = Array.from(plansList.children) as HTMLElement[];
  const planElements = planItems.filter((item) =>
    item.id.startsWith(`plan-item-${version}-`),
  );

  // Update plan_index based on position (0, 1, 2, ...)
  planElements.forEach((item, index) => {
    const planId = item.id.replace(`plan-item-${version}-`, "");
    const plan = versionData.plans[planId];
    if (typeof plan === "object" && plan !== null) {
      plan.plan_index = index;
    }
  });

  setGeneratedConfigData(generatedConfigData);
  saveConfigImmediately();
}

// Track expanded plans
const expandedPlans = new Set<string>();

/**
 * Render the list of plans for the active pricing version
 */
export function renderPlans() {
  if (!plansList) return;
  const plansListElement = plansList;

  // Store which plans were expanded before clearing
  const version = getActivePricingVersion();
  const previouslyExpanded = new Set(expandedPlans);
  plansListElement.innerHTML = "";

  if (!version) {
    plansListElement.innerHTML =
      '<p style="color: #666; padding: 20px; text-align: center;">Select a pricing version to view/edit plans</p>';
    return;
  }
  const generatedConfigData = getGeneratedConfigData();
  const versionData = generatedConfigData.pricing_version?.[version];
  const plans = versionData?.plans;

  if (!plans) {
    plansListElement.innerHTML =
      '<p style="color: #666; padding: 20px; text-align: center;">No plans in this pricing version</p>';
    return;
  }

  // Sort plans by plan_index
  const sortedPlans = Object.entries(plans)
    .filter(([_, plan]) => typeof plan === "object" && plan !== null)
    .sort(([_, a], [__, b]) => {
      const planA = a as PlanConfig;
      const planB = b as PlanConfig;
      return (planA.plan_index ?? 0) - (planB.plan_index ?? 0);
    });

  sortedPlans.forEach(([planId, plan]) => {
    const planConfig = plan as PlanConfig;
    const planKey = `${version}-${planId}`;
    const isExpanded = previouslyExpanded.has(planKey);
    if (isExpanded) {
      expandedPlans.add(planKey);
    }

    const planItem = document.createElement("div");
    planItem.className = "plan-item";
    planItem.draggable = true;
    planItem.id = `plan-item-${version}-${planId}`;
    planItem.dataset.planId = planId;
    planItem.dataset.version = version;

    planItem.innerHTML = `
      <div class="plan-item-content">
        <div class="plan-item-twirly" data-plan-key="${planKey}" style="cursor: pointer; margin-right: 8px; color: #666; user-select: none; transition: transform 0.2s;">
          ${isExpanded ? "&#9660;" : "&#9654;"}
        </div>
        <div class="plan-item-info" data-plan-key="${planKey}" style="flex: 1; cursor: pointer;">
          <strong>${planConfig.plan_id}</strong>
          ${planConfig.isFree ? "<span style='color: #27ae60; margin-left: 10px;'>(Free)</span>" : ""}
          ${planConfig.isTrial ? "<span style='color: #3498db; margin-left: 10px;'>(Trial)</span>" : ""}
        </div>
        <div style="display: flex; align-items: center; gap: 10px; padding-right: 10px;">
          <button class="remove-button" onclick="removePlanFromUI('${version}', '${planId}')">Remove</button>
          <div class="plan-item-drag-handle" style="cursor: move; color: #999; user-select: none;">&#9776;</div>
        </div>
      </div>
      <div id="plan-edit-${version}-${planId}" class="plan-edit-form" style="display: ${isExpanded ? "block" : "none"}; margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
        <div class="config-item-row">
          <label>Plan ID:</label>
          <input type="text" id="edit-plan-id-${version}-${planId}" value="${planConfig.plan_id}" />
        </div>
        <div class="config-item-row">
          <label>Is Free Plan:</label>
          <input type="checkbox" id="edit-plan-is-free-${version}-${planId}" ${planConfig.isFree ? "checked" : ""} />
        </div>
        <div class="config-item-row">
          <label>Is Trial Plan:</label>
          <input type="checkbox" id="edit-plan-is-trial-${version}-${planId}" ${planConfig.isTrial ? "checked" : ""} />
        </div>
        <div class="config-item-row">
          <label>Max Units:</label>
          <input type="number" id="edit-plan-max-units-${version}-${planId}" value="${planConfig.max_units ?? ""}" placeholder="null" />
        </div>
        <button onclick="savePlanFromUI('${version}', '${planId}')" style="margin-top: 10px;">Save</button>
        <button onclick="cancelEditPlanFromUI('${version}', '${planId}')" style="margin-top: 10px; margin-left: 5px;">Cancel</button>
      </div>
    `;

    // Add click handler for expand/collapse
    const twirly = planItem.querySelector(
      `.plan-item-twirly[data-plan-key="${planKey}"]`,
    ) as HTMLElement;
    const planInfo = planItem.querySelector(
      `.plan-item-info[data-plan-key="${planKey}"]`,
    ) as HTMLElement;
    const editForm = planItem.querySelector(
      `#plan-edit-${version}-${planId}`,
    ) as HTMLElement;

    const toggleExpand = (e: Event) => {
      // Don't toggle if clicking on drag handle or remove button
      const target = e.target as HTMLElement;
      if (
        target.closest(".plan-item-drag-handle") ||
        target.closest(".remove-button")
      ) {
        return;
      }

      const isCurrentlyExpanded = expandedPlans.has(planKey);
      if (isCurrentlyExpanded) {
        expandedPlans.delete(planKey);
        if (editForm) editForm.style.display = "none";
        if (twirly) twirly.innerHTML = "&#9654;";
      } else {
        expandedPlans.add(planKey);
        if (editForm) editForm.style.display = "block";
        if (twirly) twirly.innerHTML = "&#9660;";
      }
    };

    if (twirly) {
      twirly.addEventListener("click", toggleExpand);
    }
    if (planInfo) {
      planInfo.addEventListener("click", toggleExpand);
    }

    // Add drag event listeners
    planItem.addEventListener("dragstart", (e) => {
      if (!e.dataTransfer) return;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", planId);
      planItem.classList.add("dragging");
      planItem.style.opacity = "0.5";
    });

    planItem.addEventListener("dragend", () => {
      planItem.classList.remove("dragging");
      planItem.style.opacity = "1";
      // Update plan indices after drag ends
      updatePlanIndicesFromOrder(version);
      renderPlans(); // Re-render to reflect new order
    });

    planItem.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
      const dragging = document.querySelector(
        ".plan-item.dragging",
      ) as HTMLElement;
      if (!dragging || dragging === planItem) {
        return;
      }
      const afterElement = getDragAfterElement(plansListElement, e.clientY);
      if (afterElement == null) {
        plansListElement.appendChild(dragging);
      } else {
        plansListElement.insertBefore(dragging, afterElement);
      }
    });

    planItem.addEventListener("dragenter", (e) => {
      e.preventDefault();
      if (!planItem.classList.contains("dragging")) {
        planItem.classList.add("drag-over");
      }
    });

    planItem.addEventListener("dragleave", () => {
      planItem.classList.remove("drag-over");
    });

    planItem.addEventListener("drop", (e) => {
      e.preventDefault();
      planItem.classList.remove("drag-over");
    });

    plansListElement.appendChild(planItem);
  });
}

/**
 * Helper function to determine where to insert dragged element
 */
function getDragAfterElement(
  container: HTMLElement,
  y: number,
): HTMLElement | null {
  const draggableElements = [
    ...Array.from(container.querySelectorAll(".plan-item:not(.dragging)")),
  ] as HTMLElement[];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY, element: null as HTMLElement | null },
  ).element;
}

/**
 * Edit plan UI handler (exposed to window) - kept for backwards compatibility but no longer used
 */
(window as unknown as Record<string, unknown>).editPlanFromUI = (
  version: string,
  planId: string,
) => {
  const planKey = `${version}-${planId}`;
  const editDiv = document.getElementById(`plan-edit-${version}-${planId}`);
  const twirly = document.querySelector(
    `.plan-item-twirly[data-plan-key="${planKey}"]`,
  ) as HTMLElement;

  if (editDiv && twirly) {
    const isCurrentlyExpanded = expandedPlans.has(planKey);
    if (isCurrentlyExpanded) {
      expandedPlans.delete(planKey);
      editDiv.style.display = "none";
      twirly.innerHTML = "&#9654;";
    } else {
      expandedPlans.add(planKey);
      editDiv.style.display = "block";
      twirly.innerHTML = "&#9660;";
    }
  }
};

/**
 * Cancel edit plan UI handler (exposed to window)
 */
(window as unknown as Record<string, unknown>).cancelEditPlanFromUI = (
  version: string,
  planId: string,
) => {
  const planKey = `${version}-${planId}`;
  const editDiv = document.getElementById(`plan-edit-${version}-${planId}`);
  const twirly = document.querySelector(
    `.plan-item-twirly[data-plan-key="${planKey}"]`,
  ) as HTMLElement;

  if (editDiv && twirly) {
    expandedPlans.delete(planKey);
    editDiv.style.display = "none";
    twirly.innerHTML = "&#9654;";
    // Re-render to reset form
    renderPlans();
  }
};

/**
 * Save plan from UI (exposed to window)
 */
(window as unknown as Record<string, unknown>).savePlanFromUI = (
  version: string,
  planId: string,
) => {
  try {
    const newPlanId = (
      document.getElementById(
        `edit-plan-id-${version}-${planId}`,
      ) as HTMLInputElement
    )?.value.trim();
    const isFree =
      (
        document.getElementById(
          `edit-plan-is-free-${version}-${planId}`,
        ) as HTMLInputElement
      )?.checked || false;
    const isTrial =
      (
        document.getElementById(
          `edit-plan-is-trial-${version}-${planId}`,
        ) as HTMLInputElement
      )?.checked || false;
    const maxUnits = (
      document.getElementById(
        `edit-plan-max-units-${version}-${planId}`,
      ) as HTMLInputElement
    )?.value.trim();

    if (!newPlanId) {
      showMessage("Plan ID is required", "error");
      return;
    }

    const generatedConfigData = getGeneratedConfigData();
    const versionData = generatedConfigData.pricing_version?.[version];
    if (!versionData) {
      showMessage("Pricing version not found", "error");
      return;
    }

    if (!versionData.plans) {
      versionData.plans = {};
    }

    // If plan ID changed, remove old and add new
    if (newPlanId !== planId && newPlanId in versionData.plans) {
      showMessage("Plan ID already exists!", "error");
      return;
    }

    // Check if there's already a free plan (and it's not this one)
    const currentFreePlan = versionData.freePlan;
    if (isFree && currentFreePlan && currentFreePlan !== planId) {
      showMessage(
        "A free plan already exists in this pricing version. Only one free plan is allowed.",
        "error",
      );
      return;
    }

    // Check if there's already a trial plan (and it's not this one)
    const currentTrialPlan = versionData.trialPlan;
    if (isTrial && currentTrialPlan && currentTrialPlan !== planId) {
      showMessage(
        "A trial plan already exists in this pricing version. Only one trial plan is allowed.",
        "error",
      );
      return;
    }

    // Clear old freePlan/trialPlan references if this plan was set as such
    if (currentFreePlan === planId) {
      versionData.freePlan = null;
    }
    if (currentTrialPlan === planId) {
      versionData.trialPlan = null;
    }

    if (newPlanId !== planId) {
      delete versionData.plans[planId];
    }

    // Preserve existing plan_index if plan ID didn't change, otherwise use current max + 1
    const newPlanIndex =
      planId === newPlanId
        ? ((versionData.plans[planId] as PlanConfig)?.plan_index ??
          getMaxPlanIndex(version) + 1)
        : getMaxPlanIndex(version) + 1;

    versionData.plans[newPlanId] = {
      plan_id: newPlanId,
      isFree,
      isTrial,
      plan_index: newPlanIndex,
      max_units: maxUnits ? parseInt(maxUnits) : null,
    };

    // Set freePlan/trialPlan if status is now free/trial
    if (isFree) {
      versionData.freePlan = newPlanId;
    }
    if (isTrial) {
      versionData.trialPlan = newPlanId;
    }
    setGeneratedConfigData(generatedConfigData);

    // Collapse after saving
    const planKey = `${version}-${planId}`;
    expandedPlans.delete(planKey);

    renderPlans();
    updateGeneratedConfig();
    showMessage("Plan saved successfully!", "success");
  } catch (error) {
    console.error("Error saving plan:", error);
    showMessage(`Error saving plan: ${error}`, "error");
  }
};

/**
 * Remove plan from UI (exposed to window)
 */
(window as unknown as Record<string, unknown>).removePlanFromUI = (
  version: string,
  planId: string,
) => {
  if (confirm(`Remove plan ${planId}?`)) {
    removePlanFromVersion(version, planId);
    showMessage(`Plan ${planId} removed`, "success");
  }
};

/**
 * Setup event listeners for plans
 */
export function setupPlanListeners() {
  if (addPlanBtn) {
    addPlanBtn.addEventListener("click", (e) => {
      e.preventDefault();
      addPlan();
    });
  }

  // Clear error message when user starts typing or changes checkboxes
  if (newPlanId && planError) {
    newPlanId.addEventListener("input", () => {
      if (!planError) return;
      if (planError.style.display !== "none") {
        planError.style.display = "none";
        planError.textContent = "";
      }
    });
  }

  if (newPlanIsFree && planError) {
    newPlanIsFree.addEventListener("change", () => {
      if (!planError) return;
      if (planError.style.display !== "none") {
        planError.style.display = "none";
        planError.textContent = "";
      }
    });
  }

  if (newPlanIsTrial && planError) {
    newPlanIsTrial.addEventListener("change", () => {
      if (!planError) return;
      if (planError.style.display !== "none") {
        planError.style.display = "none";
        planError.textContent = "";
      }
    });
  }
}
