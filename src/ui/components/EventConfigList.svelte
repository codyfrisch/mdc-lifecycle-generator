<script lang="ts">
	import {
		filteredConfigs,
		selectedEventConfig,
		eventConfigCollection,
		addConfig,
		removeConfig,
		duplicateConfig,
		selectConfig,
	} from "../stores/event-configs-store.js";

	// Check if we can add configs (need app+account selected)
	let canAddConfig = $derived.by(() => {
		return !!$eventConfigCollection.selectedAppId && !!$eventConfigCollection.selectedAccountId;
	});

	function handleAddConfig() {
		addConfig();
	}

	function handleSelectConfig(configId: string) {
		selectConfig(configId);
	}

	function handleDuplicateConfig(e: Event, configId: string) {
		e.stopPropagation();
		duplicateConfig(configId);
	}

	function handleRemoveConfig(e: Event, configId: string) {
		e.stopPropagation();
		const config = $filteredConfigs.find((c) => c.id === configId);
		if (config && confirm(`Delete "${config.name}"?`)) {
			removeConfig(configId);
		}
	}
</script>

<div class="config-list">
	<div class="config-list-header">
		<h3>Configurations</h3>
		<button
			class="add-btn"
			onclick={handleAddConfig}
			title={canAddConfig ? "Add new configuration" : "Select an app and account first"}
			disabled={!canAddConfig}
		>
			+
		</button>
	</div>

	<div class="config-items">
		{#if !canAddConfig}
			<div class="empty-state">
				Select an app and account<br />
				to view configurations.
			</div>
		{:else if $filteredConfigs.length === 0}
			<div class="empty-state">
				No configurations yet.<br />
				Click + to create one.
			</div>
		{:else}
			{#each $filteredConfigs as config (config.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="config-item"
					class:selected={$selectedEventConfig?.id === config.id}
					onclick={() => handleSelectConfig(config.id)}
					onkeydown={(e) => e.key === 'Enter' && handleSelectConfig(config.id)}
					tabindex="0"
					role="button"
				>
					<div class="config-info">
						<div class="config-name">{config.name}</div>
						<div class="config-type">{config.event_type}</div>
					</div>
					<div class="config-actions">
						<button
							class="action-btn"
							onclick={(e) => handleDuplicateConfig(e, config.id)}
							title="Duplicate"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
								<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
								<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
							</svg>
						</button>
						<button
							class="action-btn danger"
							onclick={(e) => handleRemoveConfig(e, config.id)}
							title="Delete"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
								<polyline points="3 6 5 6 21 6"></polyline>
								<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
							</svg>
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.config-list {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: #f8f9fa;
		border-right: 1px solid #e0e0e0;
	}

	.config-list-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 15px;
		border-bottom: 1px solid #e0e0e0;
		background: white;
	}

	.config-list-header h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #333;
	}

	.add-btn {
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 4px;
		background: #3498db;
		color: white;
		font-size: 18px;
		font-weight: bold;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}

	.add-btn:hover:not(:disabled) {
		background: #2980b9;
	}

	.add-btn:disabled {
		background: #bdc3c7;
		cursor: not-allowed;
	}

	.config-items {
		flex: 1;
		overflow-y: auto;
		padding: 10px;
	}

	.empty-state {
		text-align: center;
		color: #666;
		font-size: 13px;
		padding: 20px;
		line-height: 1.5;
	}

	.config-item {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 10px 12px;
		margin-bottom: 6px;
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		transition: all 0.2s;
	}

	.config-item:hover {
		border-color: #3498db;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.config-item.selected {
		border-color: #3498db;
		background: #ebf5fb;
	}

	.config-info {
		flex: 1;
		min-width: 0;
	}

	.config-name {
		font-weight: 500;
		color: #333;
		font-size: 13px;
		margin-bottom: 3px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.config-type {
		font-size: 11px;
		color: #888;
		font-family: monospace;
	}

	.config-actions {
		display: flex;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.config-item:hover .config-actions {
		opacity: 1;
	}

	.action-btn {
		width: 26px;
		height: 26px;
		border: 1px solid #ccc;
		border-radius: 4px;
		background: #fff;
		color: #555;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.action-btn:hover {
		background: #3498db;
		border-color: #3498db;
		color: #fff;
	}

	.action-btn.danger {
		color: #999;
	}

	.action-btn.danger:hover {
		background: #e74c3c;
		border-color: #e74c3c;
		color: #fff;
	}
</style>
