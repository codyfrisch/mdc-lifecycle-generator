import type { Readable, Writable } from "svelte/store";
import { derived, get, writable } from "svelte/store";
import {
  type AppSecrets,
  clearStoredSecrets,
  createEmptyAppSecrets,
  encryptAndStoreAppSecrets,
  ensureSodiumReady,
  getMasterKey,
  hasStoredSecrets,
  initializeSalt,
  loadAndDecryptAppSecrets,
  reencryptWithNewPassword,
  removeAppSecretsFromStorage,
  type SecretsData,
  secureZero,
  verifyPassword,
} from "../crypto/secrets-crypto.js";
import { clearLegacyStorage } from "../crypto/storage.js";

export type { AppSecrets, SecretsData };

// ============================================================================
// Auto-lock Timer
// ============================================================================

const AUTO_LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Start or reset the auto-lock timer
 */
function startAutoLockTimer(): void {
  // Clear existing timer if any
  if (autoLockTimer !== null) {
    clearTimeout(autoLockTimer);
  }

  // Set new timer
  autoLockTimer = setTimeout(() => {
    console.log("Auto-locking secrets due to inactivity");
    lockSecrets();
  }, AUTO_LOCK_TIMEOUT_MS);
}

/**
 * Stop the auto-lock timer
 */
function stopAutoLockTimer(): void {
  if (autoLockTimer !== null) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
}

/**
 * Reset the auto-lock timer (call this on user activity)
 * Exported so it can be called from webhook send handler
 */
export function resetAutoLockTimer(): void {
  const state = get(secretsStateInternal);
  if (!state.isLocked) {
    startAutoLockTimer();
  }
}

/**
 * Public state for the secrets store (no actual secrets exposed)
 */
export type SecretsState = {
  isLocked: boolean;
  hasSecrets: boolean;
  masterPasswordSet: boolean;
  isInitialized: boolean;
};

const defaultState: SecretsState = {
  isLocked: true,
  hasSecrets: false,
  masterPasswordSet: false,
  isInitialized: false,
};

/**
 * Internal writable store for secrets state metadata only
 */
const secretsStateInternal: Writable<SecretsState> = writable(defaultState);

/**
 * Public readable store for secrets state (metadata only, no secrets exposed)
 */
export const secretsState: Readable<SecretsState> = derived(
  secretsStateInternal,
  ($state) => $state,
);

/**
 * Private closure for sensitive data - not accessible from dev console
 * Uses an IIFE to create a true closure
 *
 * Secrets are decrypted on-demand and cached for performance.
 * Only the master key is held persistently while unlocked.
 */
const secretsVault = (() => {
  let password: string | null = null;
  let masterKey: Uint8Array | null = null;
  // Cache for decrypted secrets - populated on-demand
  let secretsCache: SecretsData = {};

  return {
    setPassword(p: string | null) {
      password = p;
    },
    getPassword(): string | null {
      return password;
    },
    setMasterKey(k: Uint8Array | null) {
      // Zero out old key before replacing
      if (masterKey) {
        secureZero(masterKey);
      }
      masterKey = k;
    },
    getMasterKey(): Uint8Array | null {
      return masterKey;
    },
    /**
     * Get cached secrets for an app (may be undefined if not yet decrypted)
     */
    getCachedAppSecrets(appId: string): AppSecrets | undefined {
      return secretsCache[appId];
    },
    /**
     * Cache decrypted secrets for an app
     */
    cacheAppSecrets(appId: string, secrets: AppSecrets) {
      secretsCache[appId] = secrets;
    },
    /**
     * Remove an app from cache
     */
    uncacheAppSecrets(appId: string) {
      delete secretsCache[appId];
    },
    /**
     * Get all cached secrets (for re-encryption on password change)
     */
    getAllCachedSecrets(): SecretsData {
      return { ...secretsCache };
    },
    /**
     * Check if we have any cached secrets
     */
    hasCachedSecrets(): boolean {
      return Object.keys(secretsCache).length > 0;
    },
    /**
     * Clear all sensitive data from memory
     */
    clear() {
      password = null;
      if (masterKey) {
        secureZero(masterKey);
        masterKey = null;
      }
      secretsCache = {};
    },
  };
})();

/**
 * Initialize secrets store - check if encrypted secrets exist
 * Must be called on app startup (async for libsodium and IndexedDB)
 */
export async function initializeSecretsStore(): Promise<void> {
  // Ensure libsodium is ready
  await ensureSodiumReady();

  // Clear any legacy localStorage data
  clearLegacyStorage();

  // Check if we have secrets in IndexedDB
  const hasSecretsStored = await hasStoredSecrets();
  secretsStateInternal.update((state) => ({
    ...state,
    hasSecrets: hasSecretsStored,
    masterPasswordSet: hasSecretsStored,
    isInitialized: true,
  }));
}

/**
 * Unlock secrets with password
 * Returns true if successful, false if password is incorrect
 *
 * Note: Secrets are NOT decrypted at unlock time. They are decrypted
 * on-demand when accessed and cached for performance.
 */
export async function unlockSecrets(password: string): Promise<boolean> {
  const state = get(secretsStateInternal);

  // If no secrets exist yet, this is first-time setup
  if (!state.hasSecrets) {
    // Initialize salt for new user
    await initializeSalt();

    // Get the master key for future operations
    const masterKey = await getMasterKey(password);

    secretsVault.setPassword(password);
    secretsVault.setMasterKey(masterKey);
    secretsStateInternal.update((s) => ({
      ...s,
      isLocked: false,
      masterPasswordSet: true,
    }));

    // Start auto-lock timer
    startAutoLockTimer();
    return true;
  }

  // Verify password by attempting to decrypt one secret
  const passwordValid = await verifyPassword(password);
  if (!passwordValid) {
    return false;
  }

  // Get the master key for future operations (secrets decrypted on-demand)
  const masterKey = await getMasterKey(password);

  secretsVault.setPassword(password);
  secretsVault.setMasterKey(masterKey);

  secretsStateInternal.update((s) => ({
    ...s,
    isLocked: false,
  }));

  // Start auto-lock timer
  startAutoLockTimer();
  return true;
}

/**
 * Lock secrets - clear from memory
 */
export function lockSecrets(): void {
  stopAutoLockTimer();
  secretsVault.clear();
  secretsStateInternal.update((state) => ({
    ...state,
    isLocked: true,
  }));
}

/**
 * Get secrets for a specific app (async, on-demand decryption with caching)
 * Returns undefined if locked or no secrets exist for the app
 */
export async function getAppSecrets(
  appId: string,
): Promise<AppSecrets | undefined> {
  const state = get(secretsStateInternal);
  if (state.isLocked) {
    return undefined;
  }

  // Check cache first
  const cached = secretsVault.getCachedAppSecrets(appId);
  if (cached !== undefined) {
    return cached;
  }

  // Decrypt on-demand
  const masterKey = secretsVault.getMasterKey();
  if (!masterKey) {
    return undefined;
  }

  const decrypted = await loadAndDecryptAppSecrets(appId, masterKey);
  if (decrypted) {
    // Cache for future access
    secretsVault.cacheAppSecrets(appId, decrypted);
    return decrypted;
  }

  return undefined;
}

/**
 * Get a specific secret for an app (async, on-demand decryption with caching)
 * Returns undefined if locked or no secrets exist
 */
export async function getAppSecret(
  appId: string,
  key: keyof AppSecrets,
): Promise<string | undefined> {
  const appSecrets = await getAppSecrets(appId);
  return appSecrets?.[key];
}

/**
 * Set secrets for a specific app
 * Uses derived DEK encryption for the specific app
 * Encrypts and stores immediately, then caches for future access
 */
export async function setAppSecrets(
  appId: string,
  newSecrets: Partial<AppSecrets>,
): Promise<void> {
  const masterKey = secretsVault.getMasterKey();
  if (masterKey === null) {
    throw new Error("Cannot save secrets while locked");
  }

  // Get existing secrets (from cache or decrypt)
  const existingAppSecrets =
    (await getAppSecrets(appId)) ?? createEmptyAppSecrets();
  const updatedAppSecrets: AppSecrets = {
    ...existingAppSecrets,
    ...newSecrets,
  };

  // Save to encrypted storage
  await encryptAndStoreAppSecrets(appId, updatedAppSecrets, masterKey);

  // Update cache with the new secrets
  secretsVault.cacheAppSecrets(appId, updatedAppSecrets);

  // Update state metadata
  secretsStateInternal.update((s) => ({
    ...s,
    hasSecrets: true,
  }));
}

/**
 * Set a specific secret for an app
 */
export async function setAppSecret(
  appId: string,
  key: keyof AppSecrets,
  value: string,
): Promise<void> {
  await setAppSecrets(appId, { [key]: value });
}

/**
 * Remove secrets for a specific app
 */
export async function removeAppSecrets(appId: string): Promise<void> {
  const masterKey = secretsVault.getMasterKey();
  if (masterKey === null) {
    throw new Error("Cannot remove secrets while locked");
  }

  // Remove from encrypted storage
  await removeAppSecretsFromStorage(appId);

  // Remove from cache
  secretsVault.uncacheAppSecrets(appId);

  // Update state metadata (check if we still have secrets stored)
  const stillHasSecrets = await hasStoredSecrets();
  secretsStateInternal.update((s) => ({
    ...s,
    hasSecrets: stillHasSecrets,
  }));
}

/**
 * Check if secrets are currently unlocked
 */
export function isUnlocked(): boolean {
  return secretsVault.getMasterKey() !== null;
}

/**
 * Change the master password
 * Must be unlocked to change password
 * With derived DEKs, this requires re-encrypting all secrets
 */
export async function changeMasterPassword(newPassword: string): Promise<void> {
  const masterKey = secretsVault.getMasterKey();
  if (masterKey === null) {
    throw new Error("Cannot change password while locked");
  }

  // We need to decrypt all secrets before re-encrypting with new password
  // First, get everything from storage and decrypt
  const { getAllAppIds } = await import("../crypto/storage.js");
  const appIds = await getAllAppIds();

  const allSecrets: SecretsData = {};
  for (const appId of appIds) {
    const secrets = await getAppSecrets(appId);
    if (secrets) {
      allSecrets[appId] = secrets;
    }
  }

  // Re-encrypt all secrets with the new password (generates new salt)
  await reencryptWithNewPassword(allSecrets, newPassword);

  // Get the new master key
  const newMasterKey = await getMasterKey(newPassword);

  // Update vault (cache remains valid, just update password/key)
  secretsVault.setPassword(newPassword);
  secretsVault.setMasterKey(newMasterKey);
}

/**
 * Reset all secrets (dangerous - requires confirmation in UI)
 */
export async function resetAllSecrets(): Promise<void> {
  await clearStoredSecrets();
  secretsVault.clear();
  secretsStateInternal.set({
    ...defaultState,
    isInitialized: true,
  });
}
