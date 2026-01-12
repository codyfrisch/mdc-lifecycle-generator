<script lang="ts">
	import { generateEvent } from "../../core/event-generator.js";
	import { sendWebhook } from "../../core/http-sender.js";
	import type { SubscriptionPeriodType } from "../../schema/enums.js";
	import type { EventGenerationInput, ConfigData } from "../../types.js";
	import type { LifecyclePayload } from "../../schema/payload.js";
	import type { LifecycleJwt } from "../../schema/jwt.js";
	import { signLifecycleJwt } from "../../core/jwt-signer.js";
	import { appCollection } from "../stores/apps-store.js";
	import { accountCollection } from "../stores/account-data-store.js";
	import {
		selectedEventConfig,
		configSelectedAppId,
		configSelectedAccountId,
	} from "../stores/event-configs-store.js";
	import {
		secretsState,
		getAppSecret,
	} from "../stores/secrets-store.js";
	import EventConfigList from "./EventConfigList.svelte";
	import EventConfigForm from "./EventConfigForm.svelte";
	import ContextSelector from "./ContextSelector.svelte";
	import PreviewSection from "./PreviewSection.svelte";
	import HistorySection from "./HistorySection.svelte";
	import HistoryDetailModal from "./HistoryDetailModal.svelte";
	import type { HistoryItem } from "./history-types.js";

	// Preview state
	let previewEvent = $state("");
	let previewJwtPayload = $state("");

	// Message state
	let message = $state("");
	let messageType: "success" | "error" | null = $state(null);
	let showMessage = $state(false);
	let copiedFeedback = $state(false);

	// History state
	let historyItems = $state<HistoryItem[]>([]);

	// Storage key prefix for history items
	const HISTORY_STORAGE_PREFIX = "lifecycle_webhook_history_";

	// Generate storage key from account and app IDs
	function getHistoryStorageKey(accountId: string, appId: string): string {
		return `${HISTORY_STORAGE_PREFIX}${accountId}_${appId}`;
	}

	// Purge items older than 30 days
	function purgeOldItems(items: HistoryItem[]): HistoryItem[] {
		const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
		return items.filter((item) => item.timestamp > thirtyDaysAgo);
	}

	// Load history from localStorage for current account/app
	function loadHistoryFromStorage(accountId: string | null, appId: string | null): HistoryItem[] {
		if (!accountId || !appId) {
			return [];
		}

		try {
			const key = getHistoryStorageKey(accountId, appId);
			const stored = localStorage.getItem(key);
			if (!stored) {
				return [];
			}

			const items = JSON.parse(stored) as (HistoryItem | Omit<HistoryItem, "timestamp">)[];
			
			// Migrate old items without timestamp (backward compatibility for timestamp only)
			// Use the time string to estimate timestamp, or use current time as fallback
			const migratedItems: HistoryItem[] = items.map((item) => {
				if ("timestamp" in item && typeof item.timestamp === "number") {
					return item as HistoryItem;
				}
				// Try to parse time string, fallback to 30 days ago to be safe (will be purged if older)
				let timestamp = Date.now() - 30 * 24 * 60 * 60 * 1000;
				try {
					const parsed = new Date(item.time);
					if (!Number.isNaN(parsed.getTime())) {
						timestamp = parsed.getTime();
					}
				} catch {
					// Keep fallback timestamp
				}
				return {
					...item,
					timestamp,
				} as HistoryItem;
			});

			// Purge old items and return
			const purged = purgeOldItems(migratedItems);
			
			// Save back if items were purged or migrated
			if (purged.length !== items.length || migratedItems.some((item, i) => !("timestamp" in items[i]))) {
				saveHistoryToStorage(accountId, appId, purged);
			}

			return purged;
		} catch (error) {
			console.error("Failed to load history from localStorage:", error);
			return [];
		}
	}

	// Save history to localStorage for current account/app
	function saveHistoryToStorage(accountId: string | null, appId: string | null, items: HistoryItem[]): void {
		if (!accountId || !appId) {
			return;
		}

		try {
			const key = getHistoryStorageKey(accountId, appId);
			localStorage.setItem(key, JSON.stringify(items));
		} catch (error) {
			console.error("Failed to save history to localStorage:", error);
		}
	}

	// Modal state
	let selectedHistoryItem = $state<HistoryItem | null>(null);

	// Get the app and account from the config store's selections
	let selectedApp = $derived.by(() => {
		if (!$configSelectedAppId) return null;
		return $appCollection.apps.find((a) => a.id === $configSelectedAppId) ?? null;
	});

	let selectedAccount = $derived.by(() => {
		if (!$configSelectedAccountId) return null;
		return $accountCollection.accounts.find((a) => a.id === $configSelectedAccountId) ?? null;
	});

	// Client secret loaded on-demand (async decryption with caching)
	let clientSecret = $state("");

	// Load client secret when app changes or secrets unlocked
	$effect(() => {
		const app = selectedApp;
		const isLocked = $secretsState.isLocked;

		if (!app || isLocked) {
			clientSecret = "";
			return;
		}

		// Load secret asynchronously (on-demand decryption, cached after first load)
		getAppSecret(app.id, "client_secret").then((secret) => {
			clientSecret = secret ?? "";
		});
	});

	// Load history from localStorage when account/app combination changes
	$effect(() => {
		const account = selectedAccount;
		const app = selectedApp;

		if (account?.account_id && app?.app_id) {
			historyItems = loadHistoryFromStorage(account.account_id, app.app_id);
		} else {
			historyItems = [];
		}
	});

	// Helper to convert AppData to ConfigData format
	function appToConfig(app: { app_id: string; app_name: string; webhook_url: string; pricing_version: Record<string, unknown> }): ConfigData {
		return {
			app_id: app.app_id,
			app_name: app.app_name,
			webhook_url: app.webhook_url,
			pricing_version: app.pricing_version as ConfigData["pricing_version"],
		};
	}


	// Build JWT payload preview (the "dat" claim that goes into the JWT)
	function buildJwtPayloadPreview(
		event: { data: { account_id: string; app_id: string; account_slug?: string; user_id: string; subscription?: { plan_id: string; renewal_date: string | null; is_trial: boolean; billing_period?: string | null; days_left?: number | null; pricing_version: number; max_units?: number | null } } },
		clientId: string,
		account: { is_admin?: boolean; is_guest?: boolean; is_view_only?: boolean; user_kind?: string | null } | null,
	): object {
		return {
			dat: {
				account_id: event.data.account_id,
				app_id: event.data.app_id,
				app_version_id: null,
				client_id: clientId,
				install_id: null,
				is_admin: account?.is_admin ?? false,
				is_guest: account?.is_guest ?? false,
				is_view_only: account?.is_view_only ?? false,
				slug: event.data.account_slug,
				user_id: event.data.user_id,
				user_kind: account?.user_kind ?? null,
				subscription: event.data.subscription
					? {
							plan_id: event.data.subscription.plan_id,
							renewal_date: event.data.subscription.renewal_date ?? null,
							is_trial: event.data.subscription.is_trial,
							billing_period: event.data.subscription.billing_period ?? null,
							days_left: event.data.subscription.days_left ?? null,
							pricing_version: event.data.subscription.pricing_version,
							max_units: event.data.subscription.max_units ?? null,
						}
					: undefined,
			},
		};
	}

	// Build full JWT payload (with iat and exp)
	function buildJwtPayload(event: LifecyclePayload, clientId: string, account: { is_admin?: boolean; is_guest?: boolean; is_view_only?: boolean; user_kind?: string | null } | null): LifecycleJwt {
		const now = Math.floor(Date.now() / 1000);
		return {
			iat: now,
			exp: now + 3600, // 1 hour expiration
			dat: {
				account_id: event.data.account_id,
				app_id: event.data.app_id,
				app_version_id: null,
				client_id: clientId,
				install_id: null,
				is_admin: account?.is_admin ?? false,
				is_guest: account?.is_guest ?? false,
				is_view_only: account?.is_view_only ?? false,
				slug: event.data.account_slug,
				user_id: event.data.user_id,
				user_kind: account?.user_kind ?? null,
				subscription: event.data.subscription
					? {
							plan_id: event.data.subscription.plan_id,
							renewal_date: event.data.subscription.renewal_date ?? null,
							is_trial: event.data.subscription.is_trial,
							billing_period: event.data.subscription.billing_period ?? null,
							days_left: event.data.subscription.days_left ?? null,
							pricing_version: event.data.subscription.pricing_version,
							max_units: event.data.subscription.max_units ?? null,
						}
					: undefined,
			},
		};
	}

	// Update preview when config changes
	$effect(() => {
		const config = $selectedEventConfig;
		const app = selectedApp;
		const account = selectedAccount;

		if (!$configSelectedAppId || !$configSelectedAccountId) {
			previewEvent = "Select an app and account to get started...";
			previewJwtPayload = "";
			return;
		}

		if (!config) {
			previewEvent = "Select or create a configuration to see preview...";
			previewJwtPayload = "";
			return;
		}

		if (!app || !app.app_id) {
			previewEvent = "App not found...";
			previewJwtPayload = "";
			return;
		}

		if (!account || !account.account_id) {
			previewEvent = "Account not found...";
			previewJwtPayload = "";
			return;
		}

		try {
			const renewalDateValue = config.renewal_date?.trim();
			const renewalDateInput =
				renewalDateValue && renewalDateValue.length > 0 ? renewalDateValue : null;

			const input: EventGenerationInput = {
				event_type: config.event_type,
				app_id: app.app_id,
				account_id: account.account_id,
				plan_id: config.plan_id || undefined,
				pricing_version: config.pricing_version
					? Number.parseInt(config.pricing_version)
					: undefined,
				billing_period: (config.billing_period?.trim() || undefined) as
					| SubscriptionPeriodType
					| undefined,
				renewal_date: renewalDateInput,
				user_id: account.user_id || undefined,
				user_name: account.user_name || undefined,
				user_email: account.user_email || undefined,
				user_country: account.user_country || undefined,
				user_cluster: account.user_cluster || undefined,
				account_name: account.account_name || undefined,
				account_slug: account.account_slug || undefined,
				account_tier: account.account_tier,
				account_max_users: account.account_max_users,
				reason: config.reason || undefined,
			};

			const configData = appToConfig(app);
			const event = generateEvent(input, configData);
			previewEvent = JSON.stringify(event, null, 2);

			// Show JWT payload preview (the dat claim) if we have the required info
			if (app.client_id) {
				const jwtPayload = buildJwtPayloadPreview(event, app.client_id, account);
				previewJwtPayload = JSON.stringify(jwtPayload, null, 2);
			} else {
				previewJwtPayload = "";
			}
		} catch (error) {
			previewEvent = `Error: ${error instanceof Error ? error.message : String(error)}`;
			previewJwtPayload = "";
		}
	});

	// Show message helper
	function displayMessage(msg: string, type: "success" | "error") {
		message = msg;
		messageType = type;
		showMessage = true;
		setTimeout(() => {
			showMessage = false;
		}, 5000);
	}

	// Copy message to clipboard
	async function copyMessage() {
		if (!message) return;
		try {
			await navigator.clipboard.writeText(message);
			copiedFeedback = true;
			setTimeout(() => {
				copiedFeedback = false;
			}, 2000);
		} catch (error) {
			console.error("Failed to copy message:", error);
		}
	}

	// Add to history
	function addToHistory(
		eventType: string,
		status: number,
		statusText: string,
		configName: string,
		event: LifecyclePayload,
		jwtPayload: LifecycleJwt,
		webhookUrl: string,
	) {
		const now = Date.now();
		const newItem: HistoryItem = {
			eventType,
			time: new Date().toLocaleString(),
			timestamp: now,
			status: `${status} ${statusText}`,
			configName,
			event,
			// jwt is not stored - regenerated on resend
			jwtPayload,
			webhookUrl,
		};

		historyItems = [newItem, ...historyItems];

		// Save to localStorage
		const account = selectedAccount;
		const app = selectedApp;
		if (account?.account_id && app?.app_id) {
			saveHistoryToStorage(account.account_id, app.app_id, historyItems);
		}
	}

	// Send webhook
	async function handleSendWebhook() {
		const config = $selectedEventConfig;
		if (!config) {
			displayMessage("Please select a configuration first", "error");
			return;
		}

		const app = selectedApp;
		if (!app || !app.app_id) {
			displayMessage("Please select an app", "error");
			return;
		}

		if (!app.webhook_url) {
			displayMessage("Webhook URL not configured for app", "error");
			return;
		}

		if (!clientSecret) {
			if ($secretsState.isLocked) {
				displayMessage("Please unlock secrets first", "error");
			} else {
				displayMessage("No client secret configured for this app. Add it in Settings.", "error");
			}
			return;
		}

		const account = selectedAccount;
		if (!account || !account.account_id) {
			displayMessage("Please select an account", "error");
			return;
		}

		try {
			const renewalDateValue = config.renewal_date?.trim();
			const renewalDateInput =
				renewalDateValue && renewalDateValue.length > 0 ? renewalDateValue : null;

			const input: EventGenerationInput = {
				event_type: config.event_type,
				app_id: app.app_id,
				account_id: account.account_id,
				plan_id: config.plan_id || undefined,
				pricing_version: config.pricing_version
					? Number.parseInt(config.pricing_version)
					: undefined,
				billing_period: config.billing_period as SubscriptionPeriodType,
				renewal_date: renewalDateInput,
				user_id: account.user_id || undefined,
				user_name: account.user_name || undefined,
				user_email: account.user_email || undefined,
				user_country: account.user_country || undefined,
				user_cluster: account.user_cluster || undefined,
				account_name: account.account_name || undefined,
				account_slug: account.account_slug || undefined,
				account_tier: account.account_tier,
				account_max_users: account.account_max_users,
				reason: config.reason || undefined,
			};

			const configData = appToConfig(app);
			const event = generateEvent(input, configData);

			if (!app.client_id) {
				displayMessage("Client ID not configured for app", "error");
				return;
			}

			const jwtPayload = buildJwtPayload(event, app.client_id, account);
			const jwt = await signLifecycleJwt(event, clientSecret, app.client_id, {
				is_admin: account.is_admin,
				is_guest: account.is_guest,
				is_view_only: account.is_view_only,
				user_kind: account.user_kind,
			});
			const result = await sendWebhook(app.webhook_url, event, jwt);

			if (result.success) {
				displayMessage(`Webhook sent successfully! Status: ${result.status}`, "success");
				addToHistory(event.type, result.status, result.statusText, config.name, event, jwtPayload, app.webhook_url);
			} else {
				displayMessage(
					`Webhook failed! Status: ${result.status}, Error: ${result.error || result.body}`,
					"error",
				);
				// Still add to history even on failure so it can be resent
				addToHistory(event.type, result.status, result.statusText, config.name, event, jwtPayload, app.webhook_url);
			}
		} catch (error) {
			displayMessage(`Error: ${error instanceof Error ? error.message : String(error)}`, "error");
		}
	}

	// Resend webhook from history
	async function handleResendWebhook(item: HistoryItem) {
		// Find the app from the stored event
		const app = $appCollection.apps.find((a) => a.app_id === item.event.data.app_id);
		if (!app) {
			displayMessage("App not found for this event", "error");
			return;
		}

		// Find the account from the stored event
		const account = $accountCollection.accounts.find((a) => a.account_id === item.event.data.account_id);

		if (!app.webhook_url) {
			displayMessage("Webhook URL not configured for app", "error");
			return;
		}

		if (!app.client_id) {
			displayMessage("Client ID not configured for app", "error");
			return;
		}

		// Get client secret (may need to wait if secrets are locked)
		if ($secretsState.isLocked) {
			displayMessage("Please unlock secrets first", "error");
			return;
		}

		try {
			const secret = await getAppSecret(app.id, "client_secret");
			if (!secret) {
				displayMessage("No client secret configured for this app", "error");
				return;
			}

			// Regenerate JWT payload and JWT to ensure it's not expired
			const jwtPayload = buildJwtPayload(item.event, app.client_id, account ?? null);
			const jwt = await signLifecycleJwt(item.event, secret, app.client_id, {
				is_admin: account?.is_admin ?? false,
				is_guest: account?.is_guest ?? false,
				is_view_only: account?.is_view_only ?? false,
				user_kind: account?.user_kind ?? null,
			});
			const result = await sendWebhook(item.webhookUrl, item.event, jwt);

			if (result.success) {
				displayMessage(`Webhook resent successfully! Status: ${result.status}`, "success");
				// Update the history item with new status and JWT payload
				const index = historyItems.findIndex((h) => h === item);
				if (index !== -1) {
					const now = Date.now();
					historyItems[index] = {
						...item,
						time: new Date().toLocaleString(),
						timestamp: now,
						status: `${result.status} ${result.statusText}`,
						// jwt is not stored - regenerated on resend
						jwtPayload, // Update with new JWT payload
					};
					// Move to top
					historyItems = [
						historyItems[index],
						...historyItems.filter((_, i) => i !== index),
					];
					
					// Save to localStorage
					const account = selectedAccount;
					const app = selectedApp;
					if (account?.account_id && app?.app_id) {
						saveHistoryToStorage(account.account_id, app.app_id, historyItems);
					}
				}
			} else {
				displayMessage(
					`Webhook resend failed! Status: ${result.status}, Error: ${result.error || result.body}`,
					"error",
				);
				// Update status even on failure
				const index = historyItems.findIndex((h) => h === item);
				if (index !== -1) {
					historyItems[index] = {
						...item,
						status: `${result.status} ${result.statusText}`,
					};
					
					// Save to localStorage
					const account = selectedAccount;
					const app = selectedApp;
					if (account?.account_id && app?.app_id) {
						saveHistoryToStorage(account.account_id, app.app_id, historyItems);
					}
				}
			}
		} catch (error) {
			displayMessage(`Error resending webhook: ${error instanceof Error ? error.message : String(error)}`, "error");
		}
	}

	// Delete a single history item
	function handleDeleteHistoryItem(item: HistoryItem) {
		historyItems = historyItems.filter((h) => h !== item);
		
		// Save to localStorage
		const account = selectedAccount;
		const app = selectedApp;
		if (account?.account_id && app?.app_id) {
			saveHistoryToStorage(account.account_id, app.app_id, historyItems);
		}

		// Close modal if the deleted item was the selected one
		if (selectedHistoryItem === item) {
			handleCloseHistoryModal();
		}
	}

	// Clear all history
	function handleClearHistory() {
		historyItems = [];
		
		// Save to localStorage
		const account = selectedAccount;
		const app = selectedApp;
		if (account?.account_id && app?.app_id) {
			saveHistoryToStorage(account.account_id, app.app_id, historyItems);
		}
	}

	// Open history item modal
	function handleHistoryItemClick(item: HistoryItem) {
		selectedHistoryItem = item;
	}

	// Close history modal
	function handleCloseHistoryModal() {
		selectedHistoryItem = null;
	}

</script>

<div class="manage-lifecycle">
	<ContextSelector />

	<div class="main-layout">
		<div class="sidebar">
			<EventConfigList />
		</div>

		<div class="main-content">
			<div class="config-section">
				<h2>
					{#if $selectedEventConfig}
						{$selectedEventConfig.name}
					{:else}
						Event Configuration
					{/if}
				</h2>
				<EventConfigForm />
			</div>

			<div class="actions-section">
				<button class="send-btn" onclick={handleSendWebhook} disabled={!$selectedEventConfig}>
					Send Webhook
				</button>
				{#if showMessage}
					<div
						class="response-message"
						class:success={messageType === "success"}
						class:error={messageType === "error"}
						class:copied={copiedFeedback}
						title={message}
						onclick={copyMessage}
						role="button"
						tabindex="0"
						onkeydown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								copyMessage();
							}
						}}
					>
						{message}
					</div>
				{/if}
			</div>

		<PreviewSection {previewEvent} {previewJwtPayload} />

		<HistorySection
			{historyItems}
			onItemClick={handleHistoryItemClick}
			onResend={handleResendWebhook}
			onDelete={handleDeleteHistoryItem}
			onClearHistory={handleClearHistory}
		/>
		</div>
	</div>

	<HistoryDetailModal
		item={selectedHistoryItem}
		onClose={handleCloseHistoryModal}
		onResend={handleResendWebhook}
		onDelete={handleDeleteHistoryItem}
	/>
</div>

<style>
	.manage-lifecycle {
		display: flex;
		flex-direction: column;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		height: calc(100vh - 140px);
		min-height: 500px;
		overflow: hidden;
	}

	.main-layout {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.sidebar {
		width: 260px;
		flex-shrink: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.config-section {
		border-bottom: 1px solid #e0e0e0;
		flex-shrink: 0;
	}

	.config-section h2 {
		margin: 0;
		padding: 15px 20px;
		font-size: 16px;
		color: #333;
		background: #f8f9fa;
		border-bottom: 1px solid #e0e0e0;
	}

	.actions-section {
		padding: 15px 20px;
		border-bottom: 1px solid #e0e0e0;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.send-btn {
		padding: 10px 24px;
		background: #3498db;
		color: white;
		border: 1px solid transparent;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
		flex-shrink: 0;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		line-height: 1;
	}

	.send-btn:hover:not(:disabled) {
		background: #2980b9;
	}

	.send-btn:disabled {
		background: #bdc3c7;
		cursor: not-allowed;
	}

	.response-message {
		padding: 10px 15px;
		border-radius: 4px;
		font-size: 14px;
		width: 300px;
		height: 40px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
		transition: opacity 0.2s, transform 0.2s;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		flex-shrink: 0;
		box-sizing: border-box;
		line-height: 1;
		margin: 0;
	}

	.response-message:hover {
		opacity: 0.9;
	}

	.response-message:active {
		transform: scale(0.98);
	}

	.response-message.copied {
		opacity: 0.7;
	}

	.response-message.success {
		background: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.response-message.error {
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}

</style>
