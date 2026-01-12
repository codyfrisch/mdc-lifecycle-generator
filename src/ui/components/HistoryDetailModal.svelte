<script lang="ts">
	import type { HistoryItem } from "./history-types.js";

	let {
		item,
		onClose,
		onResend,
		onDelete,
	}: {
		item: HistoryItem | null;
		onClose: () => void;
		onResend: (item: HistoryItem) => void;
		onDelete: (item: HistoryItem) => void;
	} = $props();

	let eventCopied = $state(false);
	let jwtCopied = $state(false);

	// Handle escape key to close modal
	function handleModalKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			onClose();
		}
	}

	async function copyEvent() {
		if (!item) return;
		try {
			await navigator.clipboard.writeText(JSON.stringify(item.event, null, 2));
			eventCopied = true;
			setTimeout(() => {
				eventCopied = false;
			}, 2000);
		} catch (error) {
			console.error("Failed to copy event payload:", error);
		}
	}

	async function copyJwt() {
		if (!item) return;
		try {
			// Extract just the dat payload from the JWT payload structure
			const datPayload = item.jwtPayload.dat;
			await navigator.clipboard.writeText(JSON.stringify(datPayload, null, 2));
			jwtCopied = true;
			setTimeout(() => {
				jwtCopied = false;
			}, 2000);
		} catch (error) {
			console.error("Failed to copy JWT payload:", error);
		}
	}
</script>

{#if item}
	<div
		class="history-modal-overlay"
		onclick={onClose}
		onkeydown={handleModalKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="history-modal-title"
		tabindex="-1"
	>
		<div class="history-modal-content">
			<div class="history-modal-header">
				<h2 id="history-modal-title">History Details</h2>
				<button class="history-modal-close" onclick={onClose} aria-label="Close">
					×
				</button>
			</div>
			<div class="history-modal-body">
				<div class="history-modal-container">
					<div class="history-modal-section">
						<div class="history-modal-header-section">
							<h3>Event Payload</h3>
							<button class="copy-btn" onclick={copyEvent} aria-label="Copy Event Payload" title="Copy Event Payload">
								{#if eventCopied}
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
								{:else}
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M5.5 3.5H3.5C2.67157 3.5 2 4.17157 2 5V12.5C2 13.3284 2.67157 14 3.5 14H11C11.8284 14 12.5 13.3284 12.5 12.5V10.5M5.5 3.5C5.5 2.67157 6.17157 2 7 2H9.5M5.5 3.5C5.5 4.32843 6.17157 5 7 5H9.5M9.5 2H12.5C13.3284 2 14 2.67157 14 3.5V6.5M9.5 2V5M9.5 5H12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
								{/if}
							</button>
						</div>
						<pre class="history-modal-payload">{JSON.stringify(item.event, null, 2)}</pre>
					</div>
					<div class="history-modal-section">
						<div class="history-modal-header-section">
							<h3>JWT Payload</h3>
							<button class="copy-btn" onclick={copyJwt} aria-label="Copy JWT Payload" title="Copy JWT Payload">
								{#if jwtCopied}
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
								{:else}
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M5.5 3.5H3.5C2.67157 3.5 2 4.17157 2 5V12.5C2 13.3284 2.67157 14 3.5 14H11C11.8284 14 12.5 13.3284 12.5 12.5V10.5M5.5 3.5C5.5 2.67157 6.17157 2 7 2H9.5M5.5 3.5C5.5 4.32843 6.17157 5 7 5H9.5M9.5 2H12.5C13.3284 2 14 2.67157 14 3.5V6.5M9.5 2V5M9.5 5H12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
								{/if}
							</button>
						</div>
						<pre class="history-modal-payload">{JSON.stringify(item.jwtPayload, null, 2)}</pre>
					</div>
				</div>
			</div>
			<div class="history-modal-footer">
				<button
					class="history-modal-resend-btn"
					onclick={() => {
						onResend(item);
					}}
				>
					Resend
				</button>
				<button
					class="history-modal-delete-btn"
					onclick={() => {
						onDelete(item);
					}}
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.history-modal-overlay {
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
		padding: 20px;
	}

	.history-modal-content {
		background: white;
		border-radius: 8px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
		max-width: 900px;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.history-modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px;
		border-bottom: 1px solid #e0e0e0;
		background: #f8f9fa;
	}

	.history-modal-header h2 {
		margin: 0;
		font-size: 18px;
		color: #333;
	}

	.history-modal-close {
		background: none;
		border: none;
		font-size: 28px;
		color: #666;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background 0.2s, color 0.2s;
	}

	.history-modal-close:hover {
		background: #e0e0e0;
		color: #333;
	}

	.history-modal-body {
		padding: 20px;
		overflow-y: auto;
		flex: 1;
	}

	.history-modal-container {
		display: flex;
		gap: 15px;
		align-items: flex-start;
	}

	.history-modal-section {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}

	.history-modal-header-section {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
		gap: 10px;
	}

	.history-modal-section h3 {
		margin: 0;
		font-size: 14px;
		color: #333;
		font-weight: 600;
		flex-shrink: 0;
	}

	.copy-btn {
		background: transparent;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 4px 8px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #666;
		transition: background 0.2s, color 0.2s, border-color 0.2s;
		flex-shrink: 0;
	}

	.copy-btn:hover {
		background: #f0f0f0;
		color: #333;
		border-color: #bbb;
	}

	.copy-btn svg {
		display: block;
	}

	.history-modal-payload {
		background: #f5f5f5;
		color: #333;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 12px;
		font-family: monospace;
		font-size: 12px;
		white-space: pre-wrap;
		word-break: break-word;
		overflow-wrap: break-word;
		margin: 0;
		width: 100%;
		box-sizing: border-box;
		max-height: 500px;
		overflow-y: auto;
	}

	.history-modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 15px 20px;
		border-top: 1px solid #e0e0e0;
		background: #f8f9fa;
	}

	.history-modal-resend-btn {
		padding: 10px 20px;
		background: #3498db;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.history-modal-resend-btn:hover {
		background: #2980b9;
	}

	.history-modal-delete-btn {
		padding: 10px 20px;
		background: #e74c3c;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.history-modal-delete-btn:hover {
		background: #c0392b;
	}
</style>
