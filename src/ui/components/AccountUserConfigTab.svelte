<script lang="ts">
	import { get } from "svelte/store";
	import {
		accountCollection,
		addAccount,
		removeAccount,
		updateAccount,
		createDefaultAccount,
		type AccountUserData,
	} from "../stores/account-data-store.js";

	let message = $state("");
	let messageType: "success" | "error" | null = $state(null);
	let showMessage = $state(false);

	// Edit modal state
	let isEditModalOpen = $state(false);
	let editingAccount = $state<AccountUserData | null>(null);
	let mouseDownOnOverlay = $state(false);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape" && isEditModalOpen) {
			handleCancelEdit();
		}
	}

	function handleOverlayMouseDown(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			mouseDownOnOverlay = true;
		}
	}

	function handleOverlayMouseUp(e: MouseEvent) {
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

	function handleAddAccount() {
		const newAccount = createDefaultAccount();
		addAccount(newAccount);
		// Open edit modal for the new account
		editingAccount = { ...newAccount };
		isEditModalOpen = true;
	}

	function handleEditAccount(account: AccountUserData) {
		editingAccount = { ...account };
		isEditModalOpen = true;
	}

	function handleRemoveAccount(accountId: string) {
		const collection = get(accountCollection);
		const account = collection.accounts.find((a) => a.id === accountId);
		if (account && confirm(`Remove "${account.account_name || account.account_id || accountId}"?`)) {
			removeAccount(accountId);
			displayMessage("Account removed", "success");
		}
	}

	function handleSaveEdit() {
		if (editingAccount) {
			// Ensure defaults are set for user_country and user_cluster
			const accountToSave = {
				...editingAccount,
				user_country: editingAccount.user_country || "US",
				user_cluster: editingAccount.user_cluster || "other",
			};
			updateAccount(accountToSave.id, accountToSave);
			displayMessage("Account saved", "success");
		}
		isEditModalOpen = false;
		editingAccount = null;
	}

	function handleCancelEdit() {
		isEditModalOpen = false;
		editingAccount = null;
	}

	function handleEditFieldChange(field: keyof AccountUserData, value: string | number | boolean | null) {
		if (editingAccount) {
			editingAccount = { ...editingAccount, [field]: value };
		}
	}

	function handleTierChange(value: string) {
		handleEditFieldChange("account_tier", value === "" ? null : value);
	}

	function handleMaxUsersChange(value: string) {
		const numValue = value.trim() ? Number.parseInt(value) : null;
		handleEditFieldChange("account_max_users", numValue);
	}

	function getDisplayLabel(account: AccountUserData): string {
		if (account.account_name) return account.account_name;
		if (account.account_id) return `Account ${account.account_id}`;
		return "Unnamed Account";
	}

	function handleRowKeydown(e: KeyboardEvent, account: AccountUserData) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleEditAccount(account);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="account-user-config-tab">
	<div class="form-group">
		<h2>Accounts</h2>

		<div class="account-list">
			{#if $accountCollection.accounts.length === 0}
				<div class="empty-state">No accounts. Click + to add one.</div>
			{:else}
				{#each $accountCollection.accounts as account (account.id)}
					<div 
						class="account-row" 
						role="button"
						tabindex="0"
						onclick={() => handleEditAccount(account)}
						onkeydown={(e) => handleRowKeydown(e, account)}
					>
						<span class="account-name">{getDisplayLabel(account)}</span>
						<span class="account-actions">
							<button class="icon-btn danger" onclick={(e) => { e.stopPropagation(); handleRemoveAccount(account.id); }} title="Remove">−</button>
						</span>
					</div>
				{/each}
			{/if}
		</div>

		<div class="list-controls">
			<button class="icon-btn add-btn" onclick={handleAddAccount} title="Add account">+</button>
		</div>

		{#if showMessage}
			<div class="message" class:success={messageType === "success"} class:error={messageType === "error"}>
				{message}
			</div>
		{/if}
	</div>
</div>

<!-- Edit Modal -->
{#if isEditModalOpen && editingAccount}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="edit-modal-overlay" 
		role="presentation"
		onmousedown={handleOverlayMouseDown}
		onmouseup={handleOverlayMouseUp}
	>
		<div class="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title" tabindex="-1">
			<header class="edit-modal-header">
				<h3 id="edit-modal-title">Edit Account</h3>
				<button class="close-button" onclick={handleCancelEdit} aria-label="Close">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</header>

			<div class="edit-modal-body">
				<div class="form-sections-container">
					<div class="form-section">
						<h4 class="section-title">Account</h4>
					<div class="form-group">
						<label for="edit-account-name">Account Name</label>
						<input
							type="text"
							id="edit-account-name"
							placeholder="Test Account"
							value={editingAccount.account_name}
							oninput={(e) => handleEditFieldChange("account_name", (e.target as HTMLInputElement).value)}
						/>
					</div>
					<div class="form-group">
						<label for="edit-account-id">Account ID</label>
						<input
							type="text"
							id="edit-account-id"
							placeholder="777777"
							value={editingAccount.account_id}
							oninput={(e) => handleEditFieldChange("account_id", (e.target as HTMLInputElement).value)}
						/>
					</div>
					<div class="form-group">
						<label for="edit-account-slug">Account Slug</label>
						<input
							type="text"
							id="edit-account-slug"
							placeholder="test"
							value={editingAccount.account_slug}
							oninput={(e) => handleEditFieldChange("account_slug", (e.target as HTMLInputElement).value)}
						/>
					</div>
					<div class="form-group">
						<label for="edit-account-tier">Account Tier</label>
						<select
							id="edit-account-tier"
							value={editingAccount.account_tier || ""}
							onchange={(e) => handleTierChange((e.target as HTMLSelectElement).value)}
						>
							<option value="free">free</option>
							<option value="pro">pro</option>
							<option value="enterprise">enterprise</option>
							<option value="">null</option>
						</select>
					</div>
					<div class="form-group">
						<label for="edit-account-max-users">Account Max Users</label>
						<input
							type="number"
							id="edit-account-max-users"
							placeholder="10000"
							value={editingAccount.account_max_users ?? ""}
							oninput={(e) => handleMaxUsersChange((e.target as HTMLInputElement).value)}
						/>
					</div>
					</div>

					<div class="form-section">
						<h4 class="section-title">User</h4>
						<div class="form-group">
						<label for="edit-user-id">User ID</label>
						<input
							type="text"
							id="edit-user-id"
							placeholder="1"
							value={editingAccount.user_id}
							oninput={(e) => handleEditFieldChange("user_id", (e.target as HTMLInputElement).value)}
						/>
					</div>
					<div class="form-group">
						<label for="edit-user-name">User Name</label>
						<input
							type="text"
							id="edit-user-name"
							placeholder="Test User"
							value={editingAccount.user_name}
							oninput={(e) => handleEditFieldChange("user_name", (e.target as HTMLInputElement).value)}
						/>
					</div>
					<div class="form-group">
						<label for="edit-user-email">User Email</label>
						<input
							type="email"
							id="edit-user-email"
							placeholder="user@example.com"
							value={editingAccount.user_email}
							oninput={(e) => handleEditFieldChange("user_email", (e.target as HTMLInputElement).value)}
						/>
					</div>
					<div class="form-group">
						<label for="edit-user-country">User Country</label>
						<input
							type="text"
							id="edit-user-country"
							placeholder="US"
							value={editingAccount.user_country || "US"}
							oninput={(e) => handleEditFieldChange("user_country", (e.target as HTMLInputElement).value)}
						/>
					</div>
					<div class="form-group">
						<label for="edit-user-cluster">User Cluster</label>
						<input
							type="text"
							id="edit-user-cluster"
							placeholder="other"
							value={editingAccount.user_cluster || "other"}
							oninput={(e) => handleEditFieldChange("user_cluster", (e.target as HTMLInputElement).value)}
						/>
					</div>
					<div class="form-group">
						<label for="edit-user-kind">User Kind</label>
						<select
							id="edit-user-kind"
							value={editingAccount.user_kind || ""}
							onchange={(e) => handleEditFieldChange("user_kind", (e.target as HTMLSelectElement).value === "" ? null : (e.target as HTMLSelectElement).value)}
						>
							<option value="">null</option>
							<option value="admin">admin</option>
							<option value="member">member</option>
							<option value="guest">guest</option>
						</select>
					</div>
					<div class="form-group checkbox-group">
						<div class="checkbox-group-label">User Permissions</div>
						<div class="checkbox-row">
							<label class="checkbox-label">
								<input
									type="checkbox"
									id="edit-is-admin"
									checked={editingAccount.is_admin}
									onchange={(e) => handleEditFieldChange("is_admin", (e.target as HTMLInputElement).checked)}
								/>
								<span>Is Admin</span>
							</label>
							<label class="checkbox-label">
								<input
									type="checkbox"
									id="edit-is-guest"
									checked={editingAccount.is_guest}
									onchange={(e) => handleEditFieldChange("is_guest", (e.target as HTMLInputElement).checked)}
								/>
								<span>Is Guest</span>
							</label>
							<label class="checkbox-label">
								<input
									type="checkbox"
									id="edit-is-view-only"
									checked={editingAccount.is_view_only}
									onchange={(e) => handleEditFieldChange("is_view_only", (e.target as HTMLInputElement).checked)}
								/>
								<span>Is View Only</span>
							</label>
						</div>
					</div>
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

<style>
	.account-user-config-tab {
		max-width: 400px;
	}

	.account-list {
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

	.account-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 0;
		border-bottom: 1px solid #eee;
		cursor: pointer;
	}

	.account-row:hover {
		background: #f0f0f0;
	}

	.account-row:last-child {
		border-bottom: none;
	}

	.account-name {
		color: #333;
	}

	.account-actions {
		display: flex;
		gap: 8px;
	}

	.list-controls {
		display: flex;
		align-items: center;
		gap: 8px;
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
		max-width: 1000px;
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

	.form-sections-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 30px;
		align-items: start;
	}

	@media (max-width: 768px) {
		.form-sections-container {
			grid-template-columns: 1fr;
		}
	}

	.form-section {
		margin-bottom: 0;
	}

	.section-title {
		margin: 0 0 15px 0;
		font-size: 16px;
		font-weight: 600;
		color: #2c3e50;
		padding-bottom: 8px;
		border-bottom: 2px solid #e0e0e0;
	}

	.edit-modal-body .form-group {
		margin-bottom: 15px;
	}

	.edit-modal-body .form-group:last-child {
		margin-bottom: 0;
	}

	.edit-modal-body label {
		display: block;
		margin-bottom: 5px;
		font-weight: 500;
		color: #555;
		font-size: 13px;
	}

	.edit-modal-body input,
	.edit-modal-body select {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		font-family: inherit;
	}

	.edit-modal-body input:focus,
	.edit-modal-body select:focus {
		outline: none;
		border-color: #3498db;
		box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.1);
	}


	.edit-modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 15px 20px;
		border-top: 1px solid #e0e0e0;
	}

	.cancel-button,
	.save-button {
		padding: 10px 20px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		color: white;
		transition: background 0.2s;
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

	.checkbox-group {
		margin-bottom: 15px;
	}

	.checkbox-group-label {
		display: block;
		margin-bottom: 8px;
		font-weight: 500;
		color: #555;
		font-size: 13px;
	}

	.checkbox-row {
		display: flex;
		gap: 20px;
		flex-wrap: wrap;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		font-size: 14px;
		color: #333;
		user-select: none;
	}

	.checkbox-label input[type="checkbox"] {
		width: auto;
		margin: 0;
		cursor: pointer;
	}

	.checkbox-label span {
		line-height: 1;
	}
</style>
