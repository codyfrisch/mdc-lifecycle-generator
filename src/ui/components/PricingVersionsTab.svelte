<script lang="ts">
	import { get } from "svelte/store";
	import {
		appCollection,
		selectedApp,
		selectApp,
		addPricingVersion,
		removePricingVersion,
		activePricingVersion,
	} from "../stores/apps-store.js";

	let newVersionInput = $state("");
	let message = $state("");
	let messageType: "success" | "error" | null = $state(null);
	let showMessage = $state(false);

	let pricingVersions = $derived.by(() => {
		const app = $selectedApp;
		if (!app?.pricing_version) return [];
		return Object.keys(app.pricing_version).sort((a, b) => {
			const numA = Number(a);
			const numB = Number(b);
			if (Number.isNaN(numA) || Number.isNaN(numB)) {
				return a.localeCompare(b);
			}
			return numB - numA; // Descending
		});
	});

	function handleAppChange(appId: string) {
		if (appId) {
			selectApp(appId);
		}
	}

	function displayMessage(msg: string, type: "success" | "error") {
		message = msg;
		messageType = type;
		showMessage = true;
		setTimeout(() => {
			showMessage = false;
		}, 5000);
	}

	function handleAddVersion() {
		const version = newVersionInput.trim();

		if (!version) {
			displayMessage("Version number required", "error");
			return;
		}

		if (!/^\d+$/.test(version)) {
			displayMessage("Version must be a number", "error");
			return;
		}

		const app = get(selectedApp);
		if (!app) {
			displayMessage("Select an app first", "error");
			return;
		}

		if (version in app.pricing_version) {
			displayMessage("Version already exists", "error");
			return;
		}

		addPricingVersion(version);
		newVersionInput = "";
		displayMessage("Version added", "success");
	}

	function handleRemoveVersion(version: string) {
		if (confirm(`Remove pricing version ${version}? This will also remove all plans.`)) {
			removePricingVersion(version);
			
			// Clear active version if it was removed
			const currentActive = get(activePricingVersion);
			if (currentActive === version) {
				const app = get(selectedApp);
				if (app?.pricing_version) {
					const remaining = Object.keys(app.pricing_version).filter((v) => v !== version);
					if (remaining.length > 0) {
						activePricingVersion.set(remaining.sort((a, b) => Number(b) - Number(a))[0]);
					} else {
						activePricingVersion.set(null);
					}
				}
			}
			
			displayMessage("Version removed", "success");
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter" && newVersionInput.trim()) {
			handleAddVersion();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="pricing-versions-tab">
	<div class="form-group">
		<h2>Pricing Versions</h2>

		<div class="form-group">
			<label for="pricing-app-select">App</label>
			<select
				id="pricing-app-select"
				value={$appCollection.selectedAppId || ""}
				onchange={(e) => handleAppChange((e.target as HTMLSelectElement).value)}
			>
				<option value="">Select an app</option>
				{#each $appCollection.apps as app (app.id)}
					<option value={app.id}>{app.app_name || app.app_id || "Unnamed"}</option>
				{/each}
			</select>
		</div>

		{#if !$selectedApp}
			<p class="no-app-message">Select an app above to manage pricing versions.</p>
		{:else}

			<div class="version-list">
				{#if pricingVersions.length === 0}
					<div class="empty-state">No pricing versions. Add one below.</div>
				{:else}
					{#each pricingVersions as version (version)}
						<div class="version-row">
							<span class="version-name">Version {version}</span>
							<button class="icon-btn danger" onclick={() => handleRemoveVersion(version)} title="Remove">−</button>
						</div>
					{/each}
				{/if}
			</div>

			<div class="list-controls">
				<input
					type="text"
					class="version-input"
					placeholder="e.g., 5"
					value={newVersionInput}
					oninput={(e) => (newVersionInput = (e.target as HTMLInputElement).value)}
				/>
				<button class="icon-btn add-btn" onclick={handleAddVersion} title="Add version">+</button>
			</div>

			{#if showMessage}
				<div class="message" class:success={messageType === "success"} class:error={messageType === "error"}>
					{message}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.pricing-versions-tab {
		max-width: 400px;
	}

	.no-app-message {
		color: #888;
		font-style: italic;
		padding: 20px 0;
	}

	.version-list {
		font-family: monospace;
		font-size: 13px;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 8px 12px;
		background: #fafafa;
		min-height: 40px;
		margin-bottom: 10px;
	}

	.empty-state {
		color: #888;
		font-style: italic;
		padding: 4px 0;
	}

	.version-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 0;
		border-bottom: 1px solid #eee;
	}

	.version-row:last-child {
		border-bottom: none;
	}

	.version-name {
		color: #333;
	}

	.list-controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.version-input {
		width: 80px;
		padding: 4px 8px;
		font-size: 13px;
	}

	.add-btn {
		margin-left: auto;
	}

	.icon-btn {
		background: #f0f0f0;
		border: 1px solid #ccc;
		border-radius: 4px;
		cursor: pointer;
		padding: 4px 8px;
		font-size: 14px;
		font-weight: bold;
		color: #333;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
	}

	.icon-btn:hover {
		background: #e0e0e0;
		border-color: #999;
	}

	.icon-btn.danger {
		color: #c00;
	}

	.icon-btn.danger:hover {
		background: #fee;
		border-color: #c00;
	}

	.message {
		margin-top: 10px;
		padding: 8px 12px;
		border-radius: 4px;
		font-size: 13px;
	}

	.message.success {
		background: #d4edda;
		color: #155724;
	}

	.message.error {
		background: #f8d7da;
		color: #721c24;
	}
</style>
