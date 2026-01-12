<script lang="ts">
	let { previewEvent, previewJwtPayload }: { previewEvent: string; previewJwtPayload: string } = $props();

	let eventCopied = $state(false);
	let jwtCopied = $state(false);

	async function copyEvent() {
		try {
			await navigator.clipboard.writeText(previewEvent);
			eventCopied = true;
			setTimeout(() => {
				eventCopied = false;
			}, 2000);
		} catch (error) {
			console.error("Failed to copy event payload:", error);
		}
	}

	async function copyJwt() {
		try {
			// Extract just the dat payload from the JWT payload structure
			const jwtPayloadObj = JSON.parse(previewJwtPayload);
			const datPayload = jwtPayloadObj.dat || jwtPayloadObj;
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

<div class="preview-section">
	<div class="preview-container">
		<div class="preview-item">
			<div class="preview-header">
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
			<pre class="preview">{previewEvent}</pre>
		</div>
		{#if previewJwtPayload}
			<div class="preview-item">
				<div class="preview-header">
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
				<pre class="preview">{previewJwtPayload}</pre>
			</div>
		{/if}
	</div>
</div>

<style>
	.preview-section {
		padding: 15px 20px;
		border-bottom: 1px solid #e0e0e0;
		flex-shrink: 0;
	}

	.preview-container {
		display: flex;
		gap: 15px;
		align-items: flex-start;
	}

	.preview-item {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}

	.preview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
		gap: 10px;
	}

	.preview-item h3 {
		margin: 0;
		font-size: 14px;
		color: #333;
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

	.preview {
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
		overflow: visible !important;
		display: block;
		max-height: none !important;
		overflow-y: visible !important;
		overflow-x: visible !important;
		height: auto !important;
	}
</style>
