<script lang="ts">
	import {
		secretsState,
		lockSecrets,
		resetAllSecrets,
		changeMasterPassword,
		initializeSecretsStore,
	} from "../stores/secrets-store.js";
	import {
		exportEncryptedSecrets,
		importEncryptedSecrets,
		type EncryptedSecretsExport,
	} from "../crypto/secrets-crypto.js";
	import SecretsUnlockModal from "./SecretsUnlockModal.svelte";

	let message = $state("");
	let messageType: "success" | "error" | null = $state(null);
	let showMessage = $state(false);

	// Unlock modal state
	let isUnlockModalOpen = $state(false);

	// Change password state
	let isChangePasswordOpen = $state(false);
	let newPassword = $state("");
	let confirmPassword = $state("");

	function displayMessage(msg: string, type: "success" | "error") {
		message = msg;
		messageType = type;
		showMessage = true;
		setTimeout(() => {
			showMessage = false;
		}, 5000);
	}

	function openUnlockModal() {
		isUnlockModalOpen = true;
	}

	function handleUnlockModalClose() {
		isUnlockModalOpen = false;
	}

	function handleSecretsUnlocked() {
		displayMessage("Secrets unlocked", "success");
	}

	function handleLockSecrets() {
		lockSecrets();
		displayMessage("Secrets locked", "success");
	}

	async function handleClearAllSecrets() {
		if (confirm("Clear all stored secrets? This cannot be undone.")) {
			await resetAllSecrets();
			displayMessage("All secrets cleared", "success");
		}
	}

	async function handleExportSecrets() {
		const encryptedSecrets = await exportEncryptedSecrets();

		const hasSecrets = encryptedSecrets.salt && Object.keys(encryptedSecrets.apps).length > 0;

		if (!hasSecrets) {
			displayMessage("No secrets to export", "error");
			return;
		}

		const json = JSON.stringify(encryptedSecrets, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "lifecycle-secrets.json";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		displayMessage("Secrets exported (encrypted with your password)", "success");
	}

	function handleImportSecretsClick() {
		document.getElementById("secrets-mgmt-import-file")?.click();
	}

	async function handleImportSecrets(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (event) => {
			const text = event.target?.result as string;
			if (text) {
				try {
					const parsed = JSON.parse(text) as EncryptedSecretsExport;

					if (parsed.version !== 3) {
						displayMessage(
							`Invalid secrets file: expected version 3, got ${parsed.version ?? "unknown"}`,
							"error",
						);
						return;
					}

					if (!parsed.salt) {
						displayMessage("Invalid secrets file: missing salt", "error");
						return;
					}

					const imported = await importEncryptedSecrets(parsed);
					if (imported) {
						await initializeSecretsStore();
						displayMessage("Secrets imported successfully. Unlock to use them.", "success");
					} else {
						displayMessage("Failed to import secrets", "error");
					}
				} catch (error) {
					displayMessage(
						`Import failed: ${error instanceof Error ? error.message : "Invalid JSON"}`,
						"error",
					);
				}
			}
		};
		reader.readAsText(file);
		target.value = "";
	}

	function openChangePassword() {
		newPassword = "";
		confirmPassword = "";
		isChangePasswordOpen = true;
	}

	function cancelChangePassword() {
		isChangePasswordOpen = false;
		newPassword = "";
		confirmPassword = "";
	}

	async function handleChangePassword() {
		if (newPassword.length < 8) {
			displayMessage("Password must be at least 8 characters", "error");
			return;
		}

		if (newPassword !== confirmPassword) {
			displayMessage("Passwords do not match", "error");
			return;
		}

		try {
			await changeMasterPassword(newPassword);
			displayMessage("Password changed successfully", "success");
			isChangePasswordOpen = false;
			newPassword = "";
			confirmPassword = "";
		} catch (err) {
			displayMessage(
				`Failed to change password: ${err instanceof Error ? err.message : "Unknown error"}`,
				"error",
			);
		}
	}
</script>

<div class="secrets-management-tab">
	<h2>Secrets Management</h2>

	<div class="status-section">
		<div class="status-row">
			<span class="status-label">Status:</span>
			<span class="status-value" class:locked={$secretsState.isLocked} class:unlocked={!$secretsState.isLocked}>
				{#if $secretsState.isLocked}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
						<circle cx="12" cy="16" r="1"></circle>
						<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
					</svg>
					Locked
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
						<circle cx="12" cy="16" r="1"></circle>
						<path d="M7 11V7a5 5 0 0 1 5-5 5 5 0 0 1 5 5"></path>
					</svg>
					Unlocked
				{/if}
			</span>
		</div>

		<div class="status-row">
			<span class="status-label">Secrets stored:</span>
			<span class="status-value">{$secretsState.hasSecrets ? "Yes" : "No"}</span>
		</div>
	</div>

	<div class="actions-section">
		<h3>Lock / Unlock</h3>
		<p class="section-description">
			Secrets are encrypted with your master password. Unlock to view or edit secrets.
		</p>
		<div class="action-buttons">
			{#if $secretsState.isLocked}
				<button class="action-btn primary" onclick={openUnlockModal}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
						<circle cx="12" cy="16" r="1"></circle>
						<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
					</svg>
					Unlock Secrets
				</button>
			{:else}
				<button class="action-btn" onclick={handleLockSecrets}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
						<circle cx="12" cy="16" r="1"></circle>
						<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
					</svg>
					Lock Secrets
				</button>
			{/if}
		</div>
	</div>

	<div class="actions-section">
		<h3>Export / Import</h3>
		<p class="section-description">
			Export your encrypted secrets to a file for backup or transfer. Import previously exported secrets.
		</p>
		<div class="action-buttons">
			<button class="action-btn" onclick={handleExportSecrets}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
					<polyline points="7 10 12 15 17 10"></polyline>
					<line x1="12" y1="15" x2="12" y2="3"></line>
				</svg>
				Export Secrets
			</button>
			<button class="action-btn" onclick={handleImportSecretsClick}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
					<polyline points="17 8 12 3 7 8"></polyline>
					<line x1="12" y1="3" x2="12" y2="15"></line>
				</svg>
				Import Secrets
			</button>
			<input
				type="file"
				id="secrets-mgmt-import-file"
				accept=".json"
				style="display: none;"
				onchange={handleImportSecrets}
			/>
		</div>
	</div>

	<div class="actions-section">
		<h3>Change Password</h3>
		<p class="section-description">
			Change your master password. All secrets will be re-encrypted with the new password.
		</p>
		{#if isChangePasswordOpen}
			<div class="change-password-form">
				<div class="form-group">
					<label for="new-password">New Password</label>
					<input
						type="password"
						id="new-password"
						placeholder="Enter new password (min 8 characters)"
						bind:value={newPassword}
						disabled={$secretsState.isLocked}
					/>
				</div>
				<div class="form-group">
					<label for="confirm-password">Confirm Password</label>
					<input
						type="password"
						id="confirm-password"
						placeholder="Confirm new password"
						bind:value={confirmPassword}
						disabled={$secretsState.isLocked}
					/>
				</div>
				<div class="action-buttons">
					<button class="action-btn" onclick={cancelChangePassword}>Cancel</button>
					<button class="action-btn primary" onclick={handleChangePassword} disabled={$secretsState.isLocked}>
						Change Password
					</button>
				</div>
				{#if $secretsState.isLocked}
					<p class="warning-text">Unlock secrets first to change password.</p>
				{/if}
			</div>
		{:else}
			<div class="action-buttons">
				<button class="action-btn" onclick={openChangePassword} disabled={$secretsState.isLocked}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
					</svg>
					Change Password
				</button>
				{#if $secretsState.isLocked}
					<span class="hint-text">Unlock secrets first</span>
				{/if}
			</div>
		{/if}
	</div>

	<div class="actions-section danger-section">
		<h3>Danger Zone</h3>
		<p class="section-description">
			Permanently delete all stored secrets. This action cannot be undone.
		</p>
		<div class="action-buttons">
			<button class="action-btn danger" onclick={handleClearAllSecrets} disabled={!$secretsState.hasSecrets}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="3 6 5 6 21 6"></polyline>
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
					<line x1="10" y1="11" x2="10" y2="17"></line>
					<line x1="14" y1="11" x2="14" y2="17"></line>
				</svg>
				Clear All Secrets
			</button>
		</div>
	</div>

	{#if showMessage}
		<div class="message" class:success={messageType === "success"} class:error={messageType === "error"}>
			{message}
		</div>
	{/if}
</div>

{#if isUnlockModalOpen}
	<SecretsUnlockModal
		onclose={handleUnlockModalClose}
		onunlock={handleSecretsUnlocked}
	/>
{/if}

<style>
	.secrets-management-tab {
		max-width: 600px;
	}

	h2 {
		margin-top: 0;
		margin-bottom: 20px;
		color: #2c3e50;
	}

	h3 {
		margin: 0 0 8px 0;
		font-size: 16px;
		color: #333;
	}

	.status-section {
		background: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 8px;
		padding: 16px 20px;
		margin-bottom: 24px;
	}

	.status-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 0;
	}

	.status-label {
		color: #6c757d;
		font-size: 14px;
		min-width: 120px;
	}

	.status-value {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 500;
		font-size: 14px;
	}

	.status-value.locked {
		color: #dc3545;
	}

	.status-value.unlocked {
		color: #28a745;
	}

	.actions-section {
		background: #fff;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 20px;
		margin-bottom: 16px;
	}

	.danger-section {
		border-color: #f5c6cb;
		background: #fff5f5;
	}

	.danger-section h3 {
		color: #721c24;
	}

	.section-description {
		margin: 0 0 16px 0;
		font-size: 13px;
		color: #6c757d;
		line-height: 1.5;
	}

	.action-buttons {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		background: #f0f0f0;
		border: 1px solid #ccc;
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		color: #333;
		transition: all 0.2s;
	}

	.action-btn:hover:not(:disabled) {
		background: #e0e0e0;
		border-color: #999;
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-btn.primary {
		background: #3498db;
		border-color: #2980b9;
		color: white;
	}

	.action-btn.primary:hover:not(:disabled) {
		background: #2980b9;
	}

	.action-btn.danger {
		background: #f8d7da;
		border-color: #f5c6cb;
		color: #721c24;
	}

	.action-btn.danger:hover:not(:disabled) {
		background: #f1b0b7;
		border-color: #e4a0a8;
	}

	.change-password-form {
		background: #f8f9fa;
		border-radius: 6px;
		padding: 16px;
	}

	.form-group {
		margin-bottom: 12px;
	}

	.form-group label {
		display: block;
		margin-bottom: 4px;
		font-size: 13px;
		font-weight: 500;
		color: #495057;
	}

	.form-group input {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid #ced4da;
		border-radius: 4px;
		font-size: 14px;
		box-sizing: border-box;
	}

	.form-group input:disabled {
		background: #e9ecef;
		cursor: not-allowed;
	}

	.hint-text {
		font-size: 13px;
		color: #6c757d;
		font-style: italic;
	}

	.warning-text {
		margin: 12px 0 0 0;
		font-size: 13px;
		color: #856404;
		font-style: italic;
	}

	.message {
		margin-top: 20px;
		padding: 12px 16px;
		border-radius: 6px;
		font-size: 14px;
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
