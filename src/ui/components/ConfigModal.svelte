<script lang="ts">
	import { get } from "svelte/store";
	import AppConfigTab from "./AppConfigTab.svelte";
	import PricingVersionsTab from "./PricingVersionsTab.svelte";
	import PlansTab from "./PlansTab.svelte";
	import AccountUserConfigTab from "./AccountUserConfigTab.svelte";
	import SecretsManagementTab from "./SecretsManagementTab.svelte";
	import { appCollection, importAppCollection, type AppCollection } from "../stores/apps-store.js";
	import { accountCollection, importAccountCollection, type AccountCollection } from "../stores/account-data-store.js";
	import {
		eventConfigCollection,
		importEventConfigs,
		type EventConfigCollection,
	} from "../stores/event-configs-store.js";

	type ExportData = {
		version: number;
		apps: AppCollection;
		accounts: AccountCollection;
		eventConfigs?: EventConfigCollection;
	};

	const CURRENT_EXPORT_VERSION = 3;

	let { onclose }: { onclose?: () => void } = $props();

	let activeTab = $state<"app" | "pricing" | "plans" | "account" | "secrets">("app");
	let mouseDownOnOverlay = $state(false);
	let message = $state("");
	let messageType: "success" | "error" | null = $state(null);
	let showMessage = $state(false);
	let windowJustActivated = $state(false);

	// Track when window gains focus to prevent click-to-activate from dismissing modal
	function handleWindowFocus() {
		windowJustActivated = true;
		// Reset after a short delay - typical OS click-through window is immediate
		setTimeout(() => {
			windowJustActivated = false;
		}, 150);
	}

	function displayMessage(msg: string, type: "success" | "error") {
		message = msg;
		messageType = type;
		showMessage = true;
		setTimeout(() => {
			showMessage = false;
		}, 5000);
	}

	function handleClose() {
		if (onclose) {
			onclose();
		}
	}

	function handleEscape(e: KeyboardEvent) {
		if (e.key === "Escape") {
			handleClose();
		}
	}

	function handleOverlayMouseDown(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			mouseDownOnOverlay = true;
		}
	}

	function handleOverlayMouseUp(e: MouseEvent) {
		if (mouseDownOnOverlay && e.target === e.currentTarget && !windowJustActivated) {
			handleClose();
		}
		mouseDownOnOverlay = false;
	}

	function exportAllConfig() {
		const exportData: ExportData = {
			version: CURRENT_EXPORT_VERSION,
			apps: get(appCollection),
			accounts: get(accountCollection),
			eventConfigs: get(eventConfigCollection),
		};

		const json = JSON.stringify(exportData, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "lifecycle-config.json";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		displayMessage("Configuration exported (secrets must be exported separately)", "success");
	}

	function handleImportConfig(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const text = event.target?.result as string;
			if (text) {
				try {
					const parsed = JSON.parse(text) as ExportData;

					// Validate structure
					if (typeof parsed.version !== "number") {
						displayMessage("Invalid config file: missing version", "error");
						return;
					}

					const importedItems: string[] = [];

					// Import apps if present
					if (parsed.apps && Array.isArray(parsed.apps.apps)) {
						importAppCollection(JSON.stringify(parsed.apps));
						importedItems.push("apps");
					}

					// Import accounts if present
					if (parsed.accounts && Array.isArray(parsed.accounts.accounts)) {
						importAccountCollection(JSON.stringify(parsed.accounts));
						importedItems.push("accounts");
					}

					// Import event configs if present (v2+)
					if (parsed.eventConfigs && Array.isArray(parsed.eventConfigs.configs)) {
						importEventConfigs(parsed.eventConfigs);
						importedItems.push("event configs");
					}

					if (importedItems.length > 0) {
						displayMessage(`Imported: ${importedItems.join(", ")}`, "success");
					} else {
						displayMessage("No valid data found in config file", "error");
					}
				} catch (error) {
					displayMessage(`Import failed: ${error instanceof Error ? error.message : "Invalid JSON"}`, "error");
				}
			}
		};
		reader.readAsText(file);
		target.value = "";
	}
</script>

<svelte:window onkeydown={handleEscape} onfocus={handleWindowFocus} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" role="presentation" onmousedown={handleOverlayMouseDown} onmouseup={handleOverlayMouseUp}>
	<div class="modal-content">
		<header class="modal-header">
			<h2>Configuration</h2>
			<div class="header-actions">
				<button class="header-btn" onclick={exportAllConfig} title="Export all configuration">
					Export
				</button>
				<button class="header-btn" onclick={() => document.getElementById("config-import-file")?.click()} title="Import configuration">
					Import
				</button>
				<input
					type="file"
					id="config-import-file"
					accept=".json"
					style="display: none;"
					onchange={handleImportConfig}
				/>
				<button class="close-button" onclick={handleClose} aria-label="Close">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>
		</header>

		{#if showMessage}
			<div class="header-message" class:success={messageType === "success"} class:error={messageType === "error"}>
				{message}
			</div>
		{/if}

		<nav class="modal-tabs">
			<button
				class:active={activeTab === "app"}
				onclick={() => (activeTab = "app")}
			>
				Apps
			</button>
			<button
				class:active={activeTab === "pricing"}
				onclick={() => (activeTab = "pricing")}
			>
				Pricing Versions
			</button>
			<button
				class:active={activeTab === "plans"}
				onclick={() => (activeTab = "plans")}
			>
				Plans
			</button>
			<button
				class:active={activeTab === "account"}
				onclick={() => (activeTab = "account")}
			>
				Accounts
			</button>
			<button
				class:active={activeTab === "secrets"}
				onclick={() => (activeTab = "secrets")}
			>
				Secrets
			</button>
		</nav>

		<div class="modal-body">
			{#if activeTab === "app"}
				<AppConfigTab />
			{:else if activeTab === "pricing"}
				<PricingVersionsTab />
			{:else if activeTab === "plans"}
				<PlansTab />
			{:else if activeTab === "account"}
				<AccountUserConfigTab />
			{:else if activeTab === "secrets"}
				<SecretsManagementTab />
			{/if}
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(4px);
	}

	.modal-content {
		background: white;
		border-radius: 8px;
		width: 95vw;
		height: 95vh;
		max-width: 1400px;
		max-height: 900px;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 30px;
		border-bottom: 1px solid #e0e0e0;
	}

	.modal-header h2 {
		margin: 0;
		color: #2c3e50;
		font-size: 1.5em;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.header-btn {
		background: #f0f0f0;
		border: 1px solid #ccc;
		border-radius: 4px;
		padding: 8px 16px;
		cursor: pointer;
		font-size: 14px;
		color: #333;
		transition: all 0.2s;
	}

	.header-btn:hover {
		background: #e0e0e0;
		border-color: #999;
	}

	.header-message {
		padding: 10px 30px;
		font-size: 14px;
	}

	.header-message.success {
		background: #d4edda;
		color: #155724;
	}

	.header-message.error {
		background: #f8d7da;
		color: #721c24;
	}

	.close-button {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 8px;
		color: #666;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-button:hover {
		background: #f5f5f5;
		color: #333;
	}

	.modal-tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid #e0e0e0;
		padding: 0 20px;
		background: #f9f9f9;
	}

	.modal-tabs button {
		background: transparent;
		border: none;
		padding: 15px 20px;
		cursor: pointer;
		color: #666;
		font-size: 14px;
		font-weight: 500;
		border-bottom: 2px solid transparent;
		transition: all 0.2s;
	}

	.modal-tabs button:hover {
		background: #f0f0f0;
		color: #333;
	}

	.modal-tabs button.active {
		color: #3498db;
		border-bottom-color: #3498db;
		background: white;
	}

	.modal-body {
		flex: 1;
		overflow-y: auto;
		padding: 30px;
	}
</style>
