<script lang="ts">
	import { onMount } from "svelte";
	import { isConfigModalOpen } from "./stores/modal-store.js";
	import { initializeAccountData } from "./stores/account-data-store.js";
	import { initializeAppsData } from "./stores/apps-store.js";
	import { initializeSecretsStore, secretsState, lockSecrets } from "./stores/secrets-store.js";
	import { initializeEventConfigs, clearOldEventFormStorage } from "./stores/event-configs-store.js";
	import ManageLifecycle from "./components/ManageLifecycle.svelte";
	import ConfigModal from "./components/ConfigModal.svelte";
	import SecretsUnlockModal from "./components/SecretsUnlockModal.svelte";

	// Secrets unlock modal state
	let isUnlockModalOpen = $state(false);

	// Initialize stores on mount
	onMount(async () => {
		// Initialize apps data (non-secret configuration)
		initializeAppsData();

		// Initialize secrets store (encrypted secrets - starts locked)
		// This is async because it initializes libsodium and IndexedDB
		await initializeSecretsStore();

		// Initialize event configurations
		initializeEventConfigs();

		// Initialize account data
		initializeAccountData();

		// Clean up old event form storage
		clearOldEventFormStorage();

		// Auto-prompt for password if there are stored secrets
		if ($secretsState.hasSecrets && $secretsState.isLocked) {
			isUnlockModalOpen = true;
		}
	});

	function openUnlockModal() {
		isUnlockModalOpen = true;
	}

	function handleUnlockModalClose() {
		isUnlockModalOpen = false;
	}

	function handleLockSecrets() {
		lockSecrets();
	}
</script>

<main class="app">
	<header class="app-header">
		<h1>Monday Lifecycle Webhook Mock Tool</h1>
		<div class="header-actions">
			{#if $secretsState.isLocked}
				<button
					class="secrets-button locked"
					onclick={openUnlockModal}
					title="Unlock secrets"
					aria-label="Unlock secrets"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
						<circle cx="12" cy="16" r="1"></circle>
						<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
					</svg>
					<span>Locked</span>
				</button>
			{:else}
				<button
					class="secrets-button unlocked"
					onclick={handleLockSecrets}
					title="Lock secrets"
					aria-label="Lock secrets"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
						<circle cx="12" cy="16" r="1"></circle>
						<path d="M7 11V7a5 5 0 0 1 5-5 5 5 0 0 1 4.83 3.68"></path>
					</svg>
					<span>Unlocked</span>
				</button>
			{/if}
			<button
				class="config-button"
				onclick={() => isConfigModalOpen.set(true)}
				title="Configuration"
				aria-label="Open configuration"
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3"></circle>
					<path
						d="M12 1v6m0 6v6M5.636 5.636l4.243 4.243m4.242 4.242l4.243 4.243M1 12h6m6 0h6M5.636 18.364l4.243-4.243m4.242-4.242l4.243-4.243"
					></path>
				</svg>
			</button>
		</div>
	</header>

	<div class="app-content">
		<ManageLifecycle />
	</div>

	{#if $isConfigModalOpen}
		<ConfigModal onclose={() => isConfigModalOpen.set(false)} />
	{/if}

	{#if isUnlockModalOpen}
		<SecretsUnlockModal onclose={handleUnlockModalClose} />
	{/if}
</main>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: #f5f5f5;
	}

	.app-header {
		background: white;
		border-bottom: 1px solid #e0e0e0;
		padding: 20px 30px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		position: sticky;
		top: 0;
		z-index: 5000;
	}

	.app-header h1 {
		margin: 0;
		color: #2c3e50;
		font-size: 1.5em;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.secrets-button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.secrets-button.locked {
		background: #f8f9fa;
		border: 1px solid #dee2e6;
		color: #6c757d;
	}

	.secrets-button.locked:hover {
		background: #e9ecef;
		border-color: #adb5bd;
		color: #495057;
	}

	.secrets-button.unlocked {
		background: #d4edda;
		border: 1px solid #c3e6cb;
		color: #155724;
	}

	.secrets-button.unlocked:hover {
		background: #c3e6cb;
		border-color: #a9dfb5;
	}

	.config-button {
		background: transparent;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 8px;
		cursor: pointer;
		color: #555;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.config-button:hover {
		background: #f5f5f5;
		border-color: #3498db;
		color: #3498db;
	}

	.app-content {
		flex: 1;
		padding: 30px;
		max-width: 1200px;
		width: 100%;
		margin: 0 auto;
	}
</style>
