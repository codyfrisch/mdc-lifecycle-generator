<script lang="ts">
	import type { HistoryItem } from "./history-types.js";

	let {
		historyItems,
		onItemClick,
		onResend,
		onDelete,
		onClearHistory,
	}: {
		historyItems: HistoryItem[];
		onItemClick: (item: HistoryItem) => void;
		onResend: (item: HistoryItem) => void;
		onDelete: (item: HistoryItem) => void;
		onClearHistory: () => void;
	} = $props();
</script>

<div class="history-section">
	<div class="history-header-section">
		<h3>History</h3>
		{#if historyItems.length > 0}
			<button class="clear-history-btn" onclick={onClearHistory}>
				Clear History
			</button>
		{/if}
	</div>
	<div class="history">
		{#each historyItems as item}
			<div
				class="history-item"
				role="button"
				tabindex="0"
				onclick={() => onItemClick(item)}
				onkeydown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onItemClick(item);
					}
				}}
			>
				<div class="history-header">
					<strong>{item.eventType}</strong>
					<span class="history-config">{item.configName}</span>
				</div>
				<div class="history-meta">
					<span class="history-time">{item.time}</span>
					<span class="history-status">{item.status}</span>
				</div>
				<div class="history-actions">
					<button
						class="resend-btn"
						onclick={(e) => {
							e.stopPropagation();
							onResend(item);
						}}
					>
						Resend
					</button>
					<button
						class="delete-btn"
						onclick={(e) => {
							e.stopPropagation();
							onDelete(item);
						}}
					>
						Delete
					</button>
				</div>
			</div>
		{/each}
		{#if historyItems.length === 0}
			<p class="empty-history">No webhooks sent yet</p>
		{/if}
	</div>
</div>

<style>
	.history-section {
		padding: 15px 20px;
		flex: 1;
		min-height: 0;
	}

	.history-header-section {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}

	.history-section h3 {
		margin: 0;
		font-size: 14px;
		color: #333;
	}

	.clear-history-btn {
		padding: 6px 12px;
		background: #e74c3c;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.clear-history-btn:hover {
		background: #c0392b;
	}

	.history {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 500px;
		overflow-y: auto;
	}

	.history-item {
		background: #f8f9fa;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		cursor: pointer;
		transition: background 0.2s, border-color 0.2s;
	}

	.history-item:hover {
		background: #e9ecef;
		border-color: #3498db;
	}

	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.history-header strong {
		font-size: 13px;
		color: #333;
	}

	.history-config {
		font-size: 11px;
		color: #666;
		background: #e9ecef;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.history-meta {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: #666;
	}

	.history-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 4px;
	}

	.resend-btn {
		padding: 6px 12px;
		background: #3498db;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.resend-btn:hover {
		background: #2980b9;
	}

	.delete-btn {
		padding: 6px 12px;
		background: #e74c3c;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.delete-btn:hover {
		background: #c0392b;
	}

	.empty-history {
		color: #666;
		font-size: 13px;
		margin: 0;
	}
</style>
