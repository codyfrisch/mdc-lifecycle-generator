<script lang="ts">
	import { get } from "svelte/store";
	import {
		appCollection,
		addApp,
		removeApp,
		updateApp,
		createDefaultApp,
		type AppData,
	} from "../stores/apps-store.js";
	import {
		secretsState,
		getAppSecrets,
		setAppSecrets,
		lockSecrets,
		removeAppSecrets,
		type AppSecrets,
	} from "../stores/secrets-store.js";
	import SecretsUnlockModal from "./SecretsUnlockModal.svelte";

	let message = $state("");
	let messageType: "success" | "error" | null = $state(null);
	let showMessage = $state(false);

	// Edit modal state
	let isEditModalOpen = $state(false);
	let editingApp = $state<AppData | null>(null);
	let editingSecrets = $state<AppSecrets>({ client_secret: "" });
	let mouseDownOnOverlay = $state(false);
	let showClientSecret = $state(false);

	// Secrets unlock modal state
	let isUnlockModalOpen = $state(false);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape" && isEditModalOpen) {
			handleCancelEdit();
		}
	}

	function handleOverlayMouseDown(e: MouseEvent) {
		// Only set flag if the mousedown is directly on the overlay
		if (e.target === e.currentTarget) {
			mouseDownOnOverlay = true;
		}
	}

	function handleOverlayMouseUp(e: MouseEvent) {
		// Only close if both mousedown and mouseup were on the overlay
		if (mouseDownOnOverlay && e.target === e.currentTarget) {
			handleCancelEdit();
		}
		mouseDownOnOverlay = false;
	}

	function displayMessage(msg: string, type: "success" | "error") {
		message = msg;
		messageType = type;
		showMessage = true;
		setTimeout(() => {
			showMessage = false;
		}, 5000);
	}

	function handleAddApp() {
		const newApp = createDefaultApp();
		addApp(newApp);
		editingApp = { ...newApp };
		editingSecrets = { client_secret: "" };
		isEditModalOpen = true;
	}

	async function handleEditApp(app: AppData) {
		editingApp = { ...app };
		// Load secrets if unlocked (on-demand decryption)
		if (!$secretsState.isLocked) {
			const secrets = await getAppSecrets(app.id);
			editingSecrets = secrets ? { ...secrets } : { client_secret: "" };
		} else {
			editingSecrets = { client_secret: "" };
		}
		isEditModalOpen = true;
	}

	async function handleRemoveApp(appId: string) {
		const collection = get(appCollection);
		const app = collection.apps.find((a) => a.id === appId);
		if (app && confirm(`Remove "${app.app_name || app.app_id || appId}"?`)) {
			removeApp(appId);
			// Also remove secrets for this app if unlocked
			if (!$secretsState.isLocked) {
				try {
					await removeAppSecrets(appId);
				} catch {
					// Ignore errors when removing secrets
				}
			}
			displayMessage("App removed", "success");
		}
	}

	async function handleSaveEdit() {
		if (editingApp) {
			updateApp(editingApp.id, editingApp);
			// Save secrets if unlocked and there's a client_secret
			if (!$secretsState.isLocked && editingSecrets.client_secret) {
				try {
					await setAppSecrets(editingApp.id, editingSecrets);
				} catch (err) {
					displayMessage(
						`App saved but failed to save secrets: ${err instanceof Error ? err.message : "Unknown error"}`,
						"error",
					);
					isEditModalOpen = false;
					editingApp = null;
					editingSecrets = { client_secret: "" };
					showClientSecret = false;
					return;
				}
			}
			displayMessage("App saved", "success");
		}
		isEditModalOpen = false;
		editingApp = null;
		editingSecrets = { client_secret: "" };
		showClientSecret = false;
	}

	function handleCancelEdit() {
		isEditModalOpen = false;
		editingApp = null;
		editingSecrets = { client_secret: "" };
		showClientSecret = false;
	}

	function handleEditFieldChange(field: keyof AppData, value: string) {
		if (editingApp) {
			editingApp = { ...editingApp, [field]: value };
		}
	}

	function handleSecretFieldChange(field: keyof AppSecrets, value: string) {
		editingSecrets = { ...editingSecrets, [field]: value };
	}

	function openUnlockModal() {
		isUnlockModalOpen = true;
	}

	function handleUnlockModalClose() {
		isUnlockModalOpen = false;
	}

	async function handleSecretsUnlocked() {
		// Reload secrets for the currently editing app (on-demand decryption)
		if (editingApp) {
			const secrets = await getAppSecrets(editingApp.id);
			editingSecrets = secrets ? { ...secrets } : { client_secret: "" };
		}
	}

	function handleLockSecrets() {
		lockSecrets();
		editingSecrets = { client_secret: "" };
	}

	async function handleClearAppSecrets() {
		if (!editingApp) return;
		
		const appName = editingApp.app_name || editingApp.app_id || "this app";
		if (confirm(`Clear secrets for "${appName}"? This cannot be undone.`)) {
			try {
				await removeAppSecrets(editingApp.id);
				editingSecrets = { client_secret: "" };
				displayMessage(`Secrets cleared for ${appName}`, "success");
			} catch (err) {
				displayMessage(
					`Failed to clear secrets: ${err instanceof Error ? err.message : "Unknown error"}`,
					"error",
				);
			}
		}
	}

	function getDisplayLabel(app: AppData): string {
		if (app.app_name) return app.app_name;
		if (app.app_id) return `App ${app.app_id}`;
		return "Unnamed App";
	}

	function handleRowKeydown(e: KeyboardEvent, app: AppData) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleEditApp(app);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="app-config-tab">
	<div class="form-group">
		<h2>Apps</h2>

		<div class="app-list">
			{#if $appCollection.apps.length === 0}
				<div class="empty-state">No apps. Click + to add one.</div>
			{:else}
				{#each $appCollection.apps as app (app.id)}
					<div 
						class="app-row" 
						role="button"
						tabindex="0"
						onclick={() => handleEditApp(app)}
						onkeydown={(e) => handleRowKeydown(e, app)}
					>
						<span class="app-name">{getDisplayLabel(app)}</span>
						<span class="app-actions">
							<button class="icon-btn danger" onclick={(e) => { e.stopPropagation(); handleRemoveApp(app.id); }} title="Remove">−</button>
						</span>
					</div>
				{/each}
			{/if}
		</div>

		<div class="list-controls">
			<button class="icon-btn add-btn" onclick={handleAddApp} title="Add app">+</button>
		</div>

		{#if showMessage}
			<div class="message" class:success={messageType === "success"} class:error={messageType === "error"}>
				{message}
			</div>
		{/if}
	</div>
</div>

<!-- Edit Modal -->
{#if isEditModalOpen && editingApp}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="edit-modal-overlay" 
		role="presentation"
		onmousedown={handleOverlayMouseDown}
		onmouseup={handleOverlayMouseUp}
	>
		<div class="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title" tabindex="-1">
			<header class="edit-modal-header">
				<h3 id="edit-modal-title">Edit App</h3>
				<button class="close-button" onclick={handleCancelEdit} aria-label="Close">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</header>

			<div class="edit-modal-body">
				<div class="form-group">
					<label for="edit-app-name">App Name</label>
					<input
						type="text"
						id="edit-app-name"
						placeholder="My App"
						value={editingApp.app_name}
						oninput={(e) => handleEditFieldChange("app_name", (e.target as HTMLInputElement).value)}
					/>
				</div>
				<hr />
				<div class="form-group">
					<label for="edit-app-id">App ID</label>
					<input
						type="text"
						id="edit-app-id"
						placeholder="123456789"
						value={editingApp.app_id}
						oninput={(e) => handleEditFieldChange("app_id", (e.target as HTMLInputElement).value)}
					/>
				</div>
				<div class="form-group">
					<label for="edit-client-id">Client ID</label>
					<input
						type="text"
						id="edit-client-id"
						placeholder="abc123def456..."
						value={editingApp.client_id}
						oninput={(e) => handleEditFieldChange("client_id", (e.target as HTMLInputElement).value)}
					/>
				</div>
				<div class="form-group">
					<label for="edit-webhook-url">Webhook URL</label>
					<input
						type="url"
						id="edit-webhook-url"
						placeholder="https://your-webhook-endpoint.com/webhook"
						value={editingApp.webhook_url}
						oninput={(e) => handleEditFieldChange("webhook_url", (e.target as HTMLInputElement).value)}
					/>
				</div>

				<hr />

				<div class="secrets-section">
					<div class="secrets-header">
						<span class="secrets-title">Secrets</span>
						{#if $secretsState.isLocked}
							<button class="secrets-action-btn" onclick={openUnlockModal}>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
									<circle cx="12" cy="16" r="1"></circle>
									<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
								</svg>
								Unlock
							</button>
						{:else}
							<button class="secrets-action-btn" onclick={handleLockSecrets}>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
									<circle cx="12" cy="16" r="1"></circle>
									<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
								</svg>
								Lock
							</button>
						{/if}
					</div>

					<div class="form-group">
						<label for="edit-client-secret">Client Secret</label>
						<div class="secret-input-wrapper">
							<input
								type={showClientSecret ? "text" : "password"}
								id="edit-client-secret"
								placeholder={$secretsState.isLocked ? "Unlock to edit" : "Enter client secret"}
								disabled={$secretsState.isLocked}
								value={$secretsState.isLocked ? "" : editingSecrets.client_secret}
								oninput={(e) => handleSecretFieldChange("client_secret", (e.target as HTMLInputElement).value)}
								autocomplete="off"
								data-1p-ignore
							/>
							<button
								type="button"
								class="toggle-secret-btn"
								onclick={() => showClientSecret = !showClientSecret}
								disabled={$secretsState.isLocked}
								title={showClientSecret ? "Hide secret" : "Show secret"}
							>
								{#if showClientSecret}
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
										<line x1="1" y1="1" x2="23" y2="23"></line>
									</svg>
								{:else}
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
										<circle cx="12" cy="12" r="3"></circle>
									</svg>
								{/if}
							</button>
						</div>
						{#if $secretsState.isLocked}
							<p class="secrets-hint">Secrets are encrypted. Click "Unlock" to view or edit.</p>
						{:else if editingSecrets.client_secret}
							<div class="secrets-footer">
								<button
									type="button"
									class="clear-app-secrets-btn"
									onclick={handleClearAppSecrets}
									title="Clear secrets for this app"
								>
									Clear Secrets
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<footer class="edit-modal-footer">
				<button class="cancel-button" onclick={handleCancelEdit}>Cancel</button>
				<button class="save-button" onclick={handleSaveEdit}>Save</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Secrets Unlock Modal -->
{#if isUnlockModalOpen}
	<SecretsUnlockModal
		onclose={handleUnlockModalClose}
		onunlock={handleSecretsUnlocked}
	/>
{/if}

<style>
	.app-config-tab {
		max-width: 400px;
	}

	.app-list {
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

	.app-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 0;
		border-bottom: 1px solid #eee;
		cursor: pointer;
	}

	.app-row:hover {
		background: #f0f0f0;
	}

	.app-row:last-child {
		border-bottom: none;
	}

	.app-name {
		color: #333;
	}

	.app-actions {
		display: flex;
		gap: 8px;
	}

	.list-controls {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
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

	.secret-input-wrapper {
		display: flex;
		gap: 8px;
	}

	.secret-input-wrapper input {
		flex: 1;
	}

	.toggle-secret-btn {
		background: #f0f0f0;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 8px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #666;
		transition: all 0.2s;
	}

	.toggle-secret-btn:hover:not(:disabled) {
		background: #e0e0e0;
		border-color: #999;
		color: #333;
	}

	.toggle-secret-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Edit Modal Styles */
	.edit-modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
		backdrop-filter: blur(2px);
	}

	.edit-modal {
		background: white;
		border-radius: 8px;
		width: 90%;
		max-width: 500px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.edit-modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 15px 20px;
		border-bottom: 1px solid #e0e0e0;
	}

	.edit-modal-header h3 {
		margin: 0;
		color: #2c3e50;
	}

	.close-button {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 4px;
		color: #666;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.close-button:hover {
		background: #f5f5f5;
		color: #333;
	}

	.edit-modal-body {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
	}

	.edit-modal-body hr {
		border: none;
		border-top: 1px solid #eee;
		margin: 15px 0;
	}

	.edit-modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 15px 20px;
		border-top: 1px solid #e0e0e0;
	}

	.cancel-button {
		background: #95a5a6;
	}

	.cancel-button:hover {
		background: #7f8c8d;
	}

	.save-button {
		background: #3498db;
	}

	.save-button:hover {
		background: #2980b9;
	}

	/* Secrets Section Styles */
	.secrets-section {
		background: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 6px;
		padding: 15px;
		margin-top: 5px;
	}

	.secrets-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 15px;
	}

	.secrets-title {
		font-weight: 600;
		color: #495057;
		font-size: 14px;
	}

	.secrets-action-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: #e9ecef;
		border: 1px solid #ced4da;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		color: #495057;
		transition: all 0.2s;
	}

	.secrets-action-btn:hover {
		background: #dee2e6;
		border-color: #adb5bd;
	}

	.secrets-hint {
		margin: 8px 0 0 0;
		font-size: 12px;
		color: #6c757d;
		font-style: italic;
	}

	.secrets-section .form-group input:disabled {
		background: #e9ecef;
		cursor: not-allowed;
		color: #6c757d;
	}

	.secrets-footer {
		margin-top: 10px;
		display: flex;
		justify-content: flex-end;
	}

	.clear-app-secrets-btn {
		padding: 6px 12px;
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		color: #721c24;
		font-size: 12px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.clear-app-secrets-btn:hover {
		background: #f1b0b7;
		border-color: #e4a0a8;
	}
</style>
