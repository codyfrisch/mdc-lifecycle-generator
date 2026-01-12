<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { get } from "svelte/store";
	import type { PlanConfig } from "../../types.js";
	import {
		appCollection,
		selectedApp,
		selectApp,
		updateApp,
		activePricingVersion,
	} from "../stores/apps-store.js";
	import type { AppData } from "../stores/apps-store.js";

	let newPlanId = $state("");
	let newPlanIsFree = $state(false);
	let newPlanIsTrial = $state(false);
	let newPlanMaxUnits = $state("");
	let errorMessage = $state("");
	let showError = $state(false);
	let expandedPlans = $state<Set<string>>(new Set());

	// Track store values reactively
	let currentActiveVersion = $state<string | null>(null);
	let currentApp = $state<AppData | null>(null);

	let unsubscribeVersion: (() => void) | null = null;
	let unsubscribeApp: (() => void) | null = null;

	onMount(() => {
		unsubscribeVersion = activePricingVersion.subscribe((value) => {
			currentActiveVersion = value;
		});
		unsubscribeApp = selectedApp.subscribe((value) => {
			currentApp = value;
		});
	});

	onDestroy(() => {
		if (unsubscribeVersion) unsubscribeVersion();
		if (unsubscribeApp) unsubscribeApp();
	});

	let pricingVersions = $derived.by(() => {
		if (!currentApp?.pricing_version) return [];
		return Object.keys(currentApp.pricing_version).sort((a, b) => {
			const numA = Number(a);
			const numB = Number(b);
			if (Number.isNaN(numA) || Number.isNaN(numB)) {
				return a.localeCompare(b);
			}
			return numB - numA;
		});
	});

	let plans = $derived.by(() => {
		const version = currentActiveVersion;
		if (!version || !currentApp?.pricing_version?.[version]?.plans) {
			return [];
		}

		const plansData = currentApp.pricing_version[version].plans;
		return Object.entries(plansData)
			.filter(([_, plan]) => typeof plan === "object" && plan !== null)
			.map(([id, plan]) => ({
				id,
				...(plan as PlanConfig),
			}))
			.sort((a, b) => (a.plan_index ?? 0) - (b.plan_index ?? 0));
	});

	function getMaxPlanIndex(): number {
		const version = get(activePricingVersion);
		const app = get(selectedApp);
		if (!version || !app) return -1;

		const versionData = app.pricing_version?.[version];
		if (!versionData?.plans) return -1;

		let maxIndex = -1;
		for (const plan of Object.values(versionData.plans)) {
			if (typeof plan === "object" && plan !== null && plan.plan_index !== undefined) {
				maxIndex = Math.max(maxIndex, plan.plan_index);
			}
		}
		return maxIndex;
	}

	function addPlan() {
		const version = get(activePricingVersion);
		const app = get(selectedApp);
		if (!version || !app) {
			displayMessage("Select a pricing version first", "error");
			return;
		}

		const planId = newPlanId.trim();
		showError = false;
		errorMessage = "";

		if (!planId) {
			displayMessage("Plan ID is required", "error");
			return;
		}

		const versionData = app.pricing_version?.[version];
		if (!versionData) {
			displayMessage("Pricing version not found", "error");
			return;
		}

		if (planId in (versionData.plans || {})) {
			displayMessage("Plan ID already exists", "error");
			return;
		}

		if (newPlanIsFree && versionData.freePlan) {
			displayMessage("A free plan already exists", "error");
			return;
		}

		if (newPlanIsTrial && versionData.trialPlan) {
			displayMessage("A trial plan already exists", "error");
			return;
		}

		const maxIndex = getMaxPlanIndex();
		const newPlanIndex = maxIndex + 1;

		const updatedPricingVersion = { ...app.pricing_version };
		updatedPricingVersion[version] = {
			...versionData,
			plans: {
				...versionData.plans,
				[planId]: {
					plan_id: planId,
					isFree: newPlanIsFree,
					isTrial: newPlanIsTrial,
					plan_index: newPlanIndex,
					max_units: newPlanMaxUnits.trim() ? Number.parseInt(newPlanMaxUnits) : null,
				},
			},
			freePlan: newPlanIsFree ? planId : versionData.freePlan,
			trialPlan: newPlanIsTrial ? planId : versionData.trialPlan,
		};

		updateApp(app.id, { pricing_version: updatedPricingVersion });

		newPlanId = "";
		newPlanIsFree = false;
		newPlanIsTrial = false;
		newPlanMaxUnits = "";
		showError = false;
	}

	function removePlan(planId: string) {
		const version = get(activePricingVersion);
		const app = get(selectedApp);
		if (!version || !app) return;

		if (!confirm(`Remove plan ${planId}?`)) return;

		const versionData = app.pricing_version?.[version];
		if (!versionData?.plans) return;

		const { [planId]: _, ...remainingPlans } = versionData.plans;

		const updatedPricingVersion = { ...app.pricing_version };
		updatedPricingVersion[version] = {
			...versionData,
			plans: remainingPlans,
			freePlan: versionData.freePlan === planId ? null : versionData.freePlan,
			trialPlan: versionData.trialPlan === planId ? null : versionData.trialPlan,
		};

		updateApp(app.id, { pricing_version: updatedPricingVersion });

		const planKey = `${version}-${planId}`;
		expandedPlans.delete(planKey);
	}

	function togglePlanExpanded(planId: string) {
		const version = get(activePricingVersion);
		if (!version) return;
		const planKey = `${version}-${planId}`;
		expandedPlans = new Set(expandedPlans);
		if (expandedPlans.has(planKey)) {
			expandedPlans.delete(planKey);
		} else {
			expandedPlans.add(planKey);
		}
	}

	function displayMessage(msg: string, type: "success" | "error") {
		if (type === "error") {
			errorMessage = msg;
			showError = true;
		} else {
			errorMessage = "";
			showError = false;
		}
	}

	let draggedPlan: { id: string; index: number } | null = null;

	function handleDragStart(planId: string, index: number) {
		draggedPlan = { id: planId, index };
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function handleDrop(targetPlanId: string, targetIndex: number) {
		if (!draggedPlan || draggedPlan.id === targetPlanId) {
			draggedPlan = null;
			return;
		}

		const version = get(activePricingVersion);
		const app = get(selectedApp);
		if (!version || !app) return;

		const currentPlans = [...plans];
		const draggedPlanObj = currentPlans[draggedPlan.index];
		currentPlans.splice(draggedPlan.index, 1);
		currentPlans.splice(targetIndex, 0, draggedPlanObj);

		const versionData = app.pricing_version?.[version];
		if (!versionData?.plans) return;

		const updatedPlans = { ...versionData.plans };
		currentPlans.forEach((plan, index) => {
			const planConfig = updatedPlans[plan.id];
			if (typeof planConfig === "object" && planConfig !== null) {
				planConfig.plan_index = index;
			}
		});

		const updatedPricingVersion = { ...app.pricing_version };
		updatedPricingVersion[version] = {
			...versionData,
			plans: updatedPlans,
		};

		updateApp(app.id, { pricing_version: updatedPricingVersion });

		draggedPlan = null;
	}

	function handleInput() {
		if (showError) {
			showError = false;
			errorMessage = "";
		}
	}
</script>

<div class="plans-tab">
	<div class="form-group">
		<h3>Plans</h3>

		<div class="selection-row">
			<div class="form-group">
				<label for="plans-app-select">App</label>
				<select
					id="plans-app-select"
					value={$appCollection.selectedAppId || ""}
					onchange={(e) => {
						const value = (e.target as HTMLSelectElement).value;
						if (value) selectApp(value);
					}}
				>
					<option value="">Select an app</option>
					{#each $appCollection.apps as app (app.id)}
						<option value={app.id}>{app.app_name || app.app_id || "Unnamed"}</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="plans-pricing-version-select">Pricing Version</label>
				<select
					id="plans-pricing-version-select"
					value={currentActiveVersion || ""}
					disabled={!currentApp}
					onchange={(e) => {
						const value = (e.target as HTMLSelectElement).value;
						activePricingVersion.set(value || null);
					}}
				>
					<option value="">Select a pricing version</option>
					{#each pricingVersions as version}
						<option value={version}>Version {version}</option>
					{/each}
				</select>
			</div>
		</div>

		{#if !currentApp}
			<p class="no-app-message">Select an app above to manage plans.</p>
		{:else}
			{#if !currentActiveVersion}
				<p style="color: #666; padding: 20px; text-align: center;">
					Select a pricing version to view/edit plans
				</p>
			{:else}
				<div class="plans-list">
					{#each plans as plan, index (plan.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="plan-item"
							role="listitem"
							draggable="true"
							ondragstart={() => handleDragStart(plan.id, index)}
							ondragover={handleDragOver}
							ondrop={() => handleDrop(plan.id, index)}
						>
							<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
							<div class="plan-header" onclick={() => togglePlanExpanded(plan.id)}>
								<span class="plan-id">{plan.plan_id}</span>
								{#if plan.isFree}
									<span class="plan-badge free">Free</span>
								{/if}
								{#if plan.isTrial}
									<span class="plan-badge trial">Trial</span>
								{/if}
								<span class="plan-index">Index: {plan.plan_index ?? 0}</span>
								<button
									class="remove-button plan-remove"
									onclick={(e) => {
										e.stopPropagation();
										removePlan(plan.id);
									}}
								>
									Remove
								</button>
							</div>
							{#if expandedPlans.has(`${currentActiveVersion}-${plan.id}`)}
								<div class="plan-details">
									<div class="plan-detail-row">
										<span class="detail-label">Plan ID:</span>
										<span>{plan.plan_id}</span>
									</div>
									<div class="plan-detail-row">
										<span class="detail-label">Is Free:</span>
										<span>{plan.isFree ? "Yes" : "No"}</span>
									</div>
									<div class="plan-detail-row">
										<span class="detail-label">Is Trial:</span>
										<span>{plan.isTrial ? "Yes" : "No"}</span>
									</div>
									<div class="plan-detail-row">
										<span class="detail-label">Plan Index:</span>
										<span>{plan.plan_index ?? 0}</span>
									</div>
									<div class="plan-detail-row">
										<span class="detail-label">Max Units:</span>
										<span>{plan.max_units ?? "null"}</span>
									</div>
								</div>
							{/if}
						</div>
					{/each}
					{#if plans.length === 0}
						<p style="color: #666; padding: 20px; text-align: center;">No plans yet for this pricing version</p>
					{/if}
				</div>
				<div class="config-item" style="background: #f8f9fa; padding: 15px; margin-top: 10px;">
					<h4>Add New Plan</h4>
					<div class="config-item-row">
						<label for="new-plan-id">Plan ID:</label>
						<input
							type="text"
							id="new-plan-id"
							placeholder="e.g., plan_123"
							value={newPlanId}
							oninput={(e) => {
								newPlanId = (e.target as HTMLInputElement).value;
								handleInput();
							}}
						/>
					</div>
					<div class="config-item-row">
						<label for="new-plan-is-free">Is Free Plan:</label>
						<input
							type="checkbox"
							id="new-plan-is-free"
							checked={newPlanIsFree}
							onchange={(e) => (newPlanIsFree = (e.target as HTMLInputElement).checked)}
						/>
					</div>
					<div class="config-item-row">
						<label for="new-plan-is-trial">Is Trial Plan:</label>
						<input
							type="checkbox"
							id="new-plan-is-trial"
							checked={newPlanIsTrial}
							onchange={(e) => (newPlanIsTrial = (e.target as HTMLInputElement).checked)}
						/>
					</div>
					<div class="config-item-row">
						<label for="new-plan-max-units">Max Units (optional):</label>
						<input
							type="number"
							id="new-plan-max-units"
							placeholder="leave empty for null"
							value={newPlanMaxUnits}
							oninput={(e) => {
								newPlanMaxUnits = (e.target as HTMLInputElement).value;
								handleInput();
							}}
						/>
					</div>
					<p style="color: #666; font-size: 12px; margin-top: 5px;">
						<strong>Note:</strong> Plan order is managed by drag-and-drop. New plans are added at the end.
					</p>
					<button onclick={addPlan} style="margin-top: 10px;">Add Plan</button>
					{#if showError}
						<div class="plan-error" style="color: #e74c3c; font-size: 12px; margin-top: 5px;">
							{errorMessage}
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.selection-row {
		display: flex;
		gap: 20px;
		margin-bottom: 15px;
	}

	.selection-row .form-group {
		flex: 1;
	}

	.no-app-message {
		color: #888;
		font-style: italic;
		padding: 20px 0;
	}

	.plans-list {
		margin-bottom: 15px;
	}

	.plan-item {
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		margin-bottom: 10px;
		cursor: move;
	}

	.plan-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px;
		cursor: pointer;
	}

	.plan-id {
		font-weight: 500;
		flex: 1;
	}

	.plan-badge {
		padding: 2px 8px;
		border-radius: 3px;
		font-size: 12px;
		font-weight: 500;
	}

	.plan-badge.free {
		background: #d4edda;
		color: #155724;
	}

	.plan-badge.trial {
		background: #fff3cd;
		color: #856404;
	}

	.plan-index {
		color: #666;
		font-size: 12px;
	}

	.plan-remove {
		margin-left: auto;
	}

	.plan-details {
		padding: 10px;
		background: #f9f9f9;
		border-top: 1px solid #ddd;
	}

	.plan-detail-row {
		display: flex;
		gap: 10px;
		margin-bottom: 8px;
	}

	.plan-detail-row .detail-label {
		min-width: 120px;
		font-weight: 500;
	}

	.plan-detail-row:last-child {
		margin-bottom: 0;
	}
</style>
