<script lang="ts">
	import {
		selectedEventConfig,
		updateConfig,
		configSelectedAppId,
		type EventConfiguration,
	} from "../stores/event-configs-store.js";
	import { appCollection } from "../stores/apps-store.js";
	import type { PlanConfig } from "../../types.js";

	// Debounce timer for auto-save
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	// Get the selected app from the config store's app selection
	let selectedApp = $derived.by(() => {
		if (!$configSelectedAppId) return null;
		return $appCollection.apps.find((a) => a.id === $configSelectedAppId) ?? null;
	});

	// Computed pricing versions from selected app
	let pricingVersions = $derived.by(() => {
		if (!selectedApp?.pricing_version) return [];
		return Object.keys(selectedApp.pricing_version).sort((a, b) => {
			const numA = Number(a);
			const numB = Number(b);
			if (Number.isNaN(numA) || Number.isNaN(numB)) {
				return a.localeCompare(b);
			}
			return numB - numA;
		});
	});

	// Computed available plans from selected pricing version
	let availablePlans = $derived.by(() => {
		if (!selectedApp?.pricing_version || !$selectedEventConfig?.pricing_version) return [];
		
		const versionData = selectedApp.pricing_version[$selectedEventConfig.pricing_version];
		if (!versionData?.plans) return [];

		return Object.entries(versionData.plans)
			.filter(([_, plan]) => typeof plan === "object" && plan !== null)
			.map(([planIdValue, plan]) => ({
				id: planIdValue,
				...((plan as PlanConfig).plan_index != null
					? (plan as PlanConfig)
					: ({ plan_index: 0 } as PlanConfig)),
			}))
			.sort((a, b) => (a.plan_index ?? 0) - (b.plan_index ?? 0));
	});

	function handleFieldChange(field: keyof EventConfiguration, value: string) {
		if (!$selectedEventConfig) return;

		// Clear existing timer
		if (saveTimer) {
			clearTimeout(saveTimer);
		}

		// Debounced save for text inputs
		saveTimer = setTimeout(() => {
			updateConfig($selectedEventConfig.id, { [field]: value });
			saveTimer = null;
		}, 500);
	}

	function handleSelectChange(field: keyof EventConfiguration, value: string) {
		if (!$selectedEventConfig) return;

		// Immediate save for dropdowns
		const updates: Partial<EventConfiguration> = { [field]: value };

		// Reset dependent fields when parent changes
		if (field === "pricing_version") {
			updates.plan_id = "";
		}

		updateConfig($selectedEventConfig.id, updates);
	}
</script>

{#if $selectedEventConfig}
	<div class="config-form">
		<div class="form-group">
			<label for="config-name">Configuration Name</label>
			<input
				type="text"
				id="config-name"
				value={$selectedEventConfig.name}
				oninput={(e) => handleFieldChange("name", (e.target as HTMLInputElement).value)}
				placeholder="My Test Configuration"
			/>
		</div>

		<div class="form-group">
			<label for="config-event-type">Event Type</label>
			<select
				id="config-event-type"
				value={$selectedEventConfig.event_type}
				onchange={(e) => handleSelectChange("event_type", (e.target as HTMLSelectElement).value)}
			>
				<option value="install">install</option>
				<option value="uninstall">uninstall</option>
				<option value="app_subscription_created">app_subscription_created</option>
				<option value="app_subscription_changed">app_subscription_changed</option>
				<option value="app_subscription_renewed">app_subscription_renewed</option>
				<option value="app_subscription_cancelled_by_user">app_subscription_cancelled_by_user</option>
				<option value="app_subscription_cancelled">app_subscription_cancelled</option>
				<option value="app_subscription_cancellation_revoked_by_user">app_subscription_cancellation_revoked_by_user</option>
				<option value="app_subscription_renewal_attempt_failed">app_subscription_renewal_attempt_failed</option>
				<option value="app_subscription_renewal_failed">app_subscription_renewal_failed</option>
				<option value="app_trial_subscription_started">app_trial_subscription_started</option>
				<option value="app_trial_subscription_ended">app_trial_subscription_ended</option>
			</select>
		</div>

		<div class="form-group">
			<label for="config-pricing-version">Pricing Version</label>
			<select
				id="config-pricing-version"
				value={$selectedEventConfig.pricing_version}
				onchange={(e) => handleSelectChange("pricing_version", (e.target as HTMLSelectElement).value)}
				disabled={pricingVersions.length === 0}
			>
				<option value="">Select pricing version</option>
				{#each pricingVersions as version}
					<option value={version}>{version}</option>
				{/each}
			</select>
		</div>

		<div class="form-group">
			<label for="config-plan-id">Plan</label>
			<select
				id="config-plan-id"
				value={$selectedEventConfig.plan_id}
				onchange={(e) => handleSelectChange("plan_id", (e.target as HTMLSelectElement).value)}
				disabled={!$selectedEventConfig.pricing_version || availablePlans.length === 0}
			>
				<option value="">Select a plan</option>
				{#each availablePlans as plan}
					<option value={plan.id}>
						{plan.plan_id} {plan.isFree ? "(Free)" : ""} {plan.isTrial ? "(Trial)" : ""}
					</option>
				{/each}
			</select>
		</div>

		<div class="form-group">
			<label for="config-billing-period">Billing Period</label>
			<select
				id="config-billing-period"
				value={$selectedEventConfig.billing_period}
				onchange={(e) => handleSelectChange("billing_period", (e.target as HTMLSelectElement).value)}
			>
				<option value="">(blank)</option>
				<option value="monthly">monthly</option>
				<option value="yearly">yearly</option>
			</select>
		</div>

		<div class="form-group">
			<label for="config-renewal-date">Renewal Date (optional)</label>
			<input
				type="datetime-local"
				id="config-renewal-date"
				value={$selectedEventConfig.renewal_date}
				oninput={(e) => handleFieldChange("renewal_date", (e.target as HTMLInputElement).value)}
			/>
			<p class="field-hint">
				Leave blank to set renewal_date to null. days_left will be calculated automatically if a date is provided.
			</p>
		</div>

		<div class="form-group">
			<label for="config-reason">Reason (optional)</label>
			<input
				type="text"
				id="config-reason"
				placeholder="Optional reason field"
				value={$selectedEventConfig.reason}
				oninput={(e) => handleFieldChange("reason", (e.target as HTMLInputElement).value)}
			/>
		</div>
	</div>
{:else}
	<div class="no-config-selected">
		<p>Select a configuration from the list or create a new one.</p>
	</div>
{/if}

<style>
	.config-form {
		padding: 20px;
	}

	.form-group {
		margin-bottom: 15px;
	}

	.form-group label {
		display: block;
		margin-bottom: 5px;
		font-weight: 500;
		color: #333;
		font-size: 14px;
	}

	.form-group input,
	.form-group select {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		box-sizing: border-box;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: #3498db;
		box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
	}

	.form-group select:disabled {
		background: #f5f5f5;
		color: #999;
		cursor: not-allowed;
	}

	.field-hint {
		color: #666;
		font-size: 12px;
		margin-top: 5px;
		margin-bottom: 0;
	}

	.no-config-selected {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 40px;
		text-align: center;
		color: #666;
	}

	.no-config-selected p {
		margin: 0;
		font-size: 14px;
	}
</style>
