<script lang="ts">
	import {
		secretsState,
		unlockSecrets,
	} from "../stores/secrets-store.js";

	type Props = {
		onclose?: () => void;
		onunlock?: () => void;
	};

	let { onclose, onunlock }: Props = $props();

	let password = $state("");
	let confirmPassword = $state("");
	let persistSession = $state(false); // Default to disabled for maximum security
	let error = $state("");
	let isLoading = $state(false);
	let mouseDownOnOverlay = $state(false);

	// Determine if this is first-time setup (no secrets yet)
	const isFirstTime = $derived(!$secretsState.hasSecrets);

	// Password strength validation
	type PasswordCheck = {
		label: string;
		passed: boolean;
	};

	const passwordChecks = $derived.by((): PasswordCheck[] => {
		if (!isFirstTime) return [];
		return [
			{ label: "At least 12 characters", passed: password.length >= 12 },
			{ label: "At least 1 uppercase letter", passed: /[A-Z]/.test(password) },
			{ label: "At least 1 digit", passed: /\d/.test(password) },
			{ label: "At least 1 symbol (!@#$%^&*...)", passed: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) },
		];
	});

	const allChecksPassed = $derived(passwordChecks.every((check) => check.passed));

	function validatePassword(): string | null {
		if (password.length < 12) {
			return "Password must be at least 12 characters";
		}
		if (!/[A-Z]/.test(password)) {
			return "Password must contain at least 1 uppercase letter";
		}
		if (!/\d/.test(password)) {
			return "Password must contain at least 1 digit";
		}
		if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
			return "Password must contain at least 1 symbol";
		}
		return null;
	}

	// Clear error when user corrects the issue
	$effect(() => {
		if (!error || !isFirstTime) return;

		// Clear password strength errors when requirements are met
		if (error.includes("12 characters") && password.length >= 12) {
			error = "";
		} else if (error.includes("uppercase") && /[A-Z]/.test(password)) {
			error = "";
		} else if (error.includes("digit") && /\d/.test(password)) {
			error = "";
		} else if (error.includes("symbol") && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
			error = "";
		} else if (error.includes("do not match") && password === confirmPassword) {
			error = "";
		}
	});

	function handleClose() {
		password = "";
		confirmPassword = "";
		persistSession = false; // Reset to default
		error = "";
		onclose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			handleClose();
		}
		// Enter key is now handled by form submission
	}

	function handleOverlayMouseDown(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			mouseDownOnOverlay = true;
		}
	}

	function handleOverlayMouseUp(e: MouseEvent) {
		if (mouseDownOnOverlay && e.target === e.currentTarget) {
			handleClose();
		}
		mouseDownOnOverlay = false;
	}

	async function handleSubmit() {
		error = "";

		if (!password) {
			error = "Password is required";
			return;
		}

		if (isFirstTime) {
			// First-time setup: validate password strength
			const validationError = validatePassword();
			if (validationError) {
				error = validationError;
				return;
			}
			if (password !== confirmPassword) {
				error = "Passwords do not match";
				return;
			}
		}

		isLoading = true;

		try {
			const success = await unlockSecrets(password, persistSession);
			if (success) {
				password = "";
				confirmPassword = "";
				persistSession = false; // Reset to default
				onunlock?.();
				handleClose();
			} else {
				error = "Incorrect password";
			}
		} catch (err) {
			error = err instanceof Error ? err.message : "Failed to unlock secrets";
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="modal-overlay"
	role="presentation"
	onmousedown={handleOverlayMouseDown}
	onmouseup={handleOverlayMouseUp}
>
	<div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="unlock-modal-title">
		<header class="modal-header">
			<h3 id="unlock-modal-title">
				{#if isFirstTime}
					Set Encryption Password
				{:else}
					Unlock Secrets
				{/if}
			</h3>
			<button class="close-button" onclick={handleClose} aria-label="Close">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</header>

		<form class="modal-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			<div class="modal-body">
				{#if isFirstTime}
					<p class="description">
						Set a password to encrypt your secrets. This password is never stored
						and cannot be recovered if forgotten.
					</p>
					<p class="description hint">
						If you previously had secrets encrypted, using the same password will restore access to them.
					</p>
					<p class="description warning">
						These may be production secrets. Use a strong password.
					</p>
				{:else}
					<p class="description">
						Enter your encryption password to access your secrets.
					</p>
				{/if}

				<div class="form-group">
					<label for="unlock-password">
						{#if isFirstTime}Encryption Password{:else}Password{/if}
					</label>
					<input
						type="password"
						id="unlock-password"
						bind:value={password}
						placeholder="Enter password"
						disabled={isLoading}
						autocomplete={isFirstTime ? "new-password" : "current-password"}
						minlength={isFirstTime ? 12 : undefined}
						passwordrules={isFirstTime ? "minlength: 12; required: upper; required: digit; required: special;" : undefined}
					/>
				</div>

				{#if isFirstTime && password.length > 0}
					<div class="password-requirements">
						{#each passwordChecks as check}
							<div class="requirement" class:passed={check.passed}>
								<span class="check-icon">{check.passed ? "✓" : "○"}</span>
								<span>{check.label}</span>
							</div>
						{/each}
					</div>
				{/if}

			{#if isFirstTime}
				<div class="form-group">
					<label for="unlock-confirm-password">Confirm Password</label>
					<input
						type="password"
						id="unlock-confirm-password"
						bind:value={confirmPassword}
						placeholder="Confirm password"
						disabled={isLoading}
						autocomplete="new-password"
						minlength={12}
						passwordrules="minlength: 12; required: upper; required: digit; required: special;"
					/>
				</div>
			{/if}

			{#if !isFirstTime}
				<div class="form-group checkbox-group">
					<label class="checkbox-label">
						<input
							type="checkbox"
							bind:checked={persistSession}
							disabled={isLoading}
						/>
						<span>Keep unlocked after page refresh</span>
					</label>
					<p class="checkbox-hint">
						When enabled, your unlock state persists across page refreshes until you close the tab.
						Disable for maximum security (requires password on every refresh).
					</p>
				</div>
			{/if}

				{#if error}
					<div class="error-message">{error}</div>
				{/if}
			</div>

			<footer class="modal-footer">
				<button type="button" class="cancel-button" onclick={handleClose} disabled={isLoading}>
					Cancel
				</button>
				<button type="submit" class="unlock-button" disabled={isLoading}>
					{#if isLoading}
						{#if isFirstTime}Setting...{:else}Unlocking...{/if}
					{:else}
						{#if isFirstTime}Set Password{:else}Unlock{/if}
					{/if}
				</button>
			</footer>
		</form>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 3000;
		backdrop-filter: blur(2px);
	}

	.modal-content {
		background: white;
		border-radius: 8px;
		width: 90%;
		max-width: 400px;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.modal-form {
		display: contents;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 15px 20px;
		border-bottom: 1px solid #e0e0e0;
	}

	.modal-header h3 {
		margin: 0;
		color: #2c3e50;
		font-size: 1.1em;
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

	.modal-body {
		padding: 20px;
	}

	.description {
		margin: 0 0 15px 0;
		color: #666;
		font-size: 14px;
		line-height: 1.5;
	}

	.description.hint {
		color: #0c5460;
		background: #d1ecf1;
		padding: 8px 12px;
		border-radius: 4px;
		border: 1px solid #bee5eb;
		font-size: 13px;
	}

	.description.warning {
		color: #856404;
		background: #fff3cd;
		padding: 8px 12px;
		border-radius: 4px;
		border: 1px solid #ffeeba;
		font-size: 13px;
	}

	.password-requirements {
		background: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 4px;
		padding: 10px 12px;
		margin-bottom: 15px;
		font-size: 13px;
	}

	.requirement {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 3px 0;
		color: #6c757d;
	}

	.requirement.passed {
		color: #28a745;
	}

	.check-icon {
		font-size: 12px;
		width: 16px;
		text-align: center;
	}

	.form-group {
		margin-bottom: 15px;
	}

	.form-group label {
		display: block;
		margin-bottom: 5px;
		font-weight: 500;
		color: #333;
		font-size: 14px;
	}

	.form-group input {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		box-sizing: border-box;
	}

	.form-group input:focus {
		outline: none;
		border-color: #3498db;
		box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
	}

	.form-group input:disabled {
		background: #f5f5f5;
		cursor: not-allowed;
	}

	.checkbox-group {
		margin-top: 10px;
	}

	.checkbox-label {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		cursor: pointer;
		font-weight: 500;
		color: #333;
		font-size: 14px;
	}

	.checkbox-label input[type="checkbox"] {
		margin-top: 2px;
		width: auto;
		cursor: pointer;
		flex-shrink: 0;
	}

	.checkbox-label input[type="checkbox"]:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.checkbox-hint {
		margin: 6px 0 0 24px;
		font-size: 12px;
		color: #6c757d;
		line-height: 1.4;
	}

	.error-message {
		padding: 10px 12px;
		background: #f8d7da;
		color: #721c24;
		border-radius: 4px;
		font-size: 14px;
		margin-top: 10px;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 15px 20px;
		border-top: 1px solid #e0e0e0;
	}

	.cancel-button,
	.unlock-button {
		padding: 10px 20px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: background 0.2s;
	}

	.cancel-button {
		background: #95a5a6;
		color: white;
	}

	.cancel-button:hover:not(:disabled) {
		background: #7f8c8d;
	}

	.unlock-button {
		background: #3498db;
		color: white;
	}

	.unlock-button:hover:not(:disabled) {
		background: #2980b9;
	}

	.cancel-button:disabled,
	.unlock-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
