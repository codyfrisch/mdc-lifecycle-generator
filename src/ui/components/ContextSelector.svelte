<script lang="ts">
	import { appCollection } from "../stores/apps-store.js";
	import { accountCollection } from "../stores/account-data-store.js";
	import {
		configSelectedAppId,
		configSelectedAccountId,
		selectConfigApp,
		selectConfigAccount,
	} from "../stores/event-configs-store.js";

	// Handle app selection
	function handleAppChange(e: Event) {
		const value = (e.target as HTMLSelectElement).value;
		if (value) {
			selectConfigApp(value);
		}
	}

	// Handle account selection
	function handleAccountChange(e: Event) {
		const value = (e.target as HTMLSelectElement).value;
		if (value) {
			selectConfigAccount(value);
		}
	}
</script>

<div class="context-selector">
	<div class="context-group">
		<label for="context-app">App</label>
		<select
			id="context-app"
			value={$configSelectedAppId || ""}
			onchange={handleAppChange}
		>
			<option value="">Select an app</option>
			{#each $appCollection.apps as app (app.id)}
				<option value={app.id}>{app.app_name || app.app_id || "Unnamed"}</option>
			{/each}
		</select>
	</div>
	<div class="context-group">
		<label for="context-account">Account</label>
		<select
			id="context-account"
			value={$configSelectedAccountId || ""}
			onchange={handleAccountChange}
		>
			<option value="">Select an account</option>
			{#each $accountCollection.accounts as account (account.id)}
				<option value={account.id}>{account.account_name || account.account_id || "Unnamed"}</option>
			{/each}
		</select>
	</div>
</div>

<style>
	.context-selector {
		display: flex;
		gap: 20px;
		padding: 15px 20px;
		background: #f8f9fa;
		border-bottom: 1px solid #e0e0e0;
	}

	.context-group {
		flex: 1;
		max-width: 300px;
	}

	.context-group label {
		display: block;
		margin-bottom: 5px;
		font-weight: 600;
		color: #333;
		font-size: 13px;
	}

	.context-group select {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		background: white;
	}

	.context-group select:focus {
		outline: none;
		border-color: #3498db;
		box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
	}
</style>
