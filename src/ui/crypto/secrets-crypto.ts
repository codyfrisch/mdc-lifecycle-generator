/**
 * Secrets encryption using libsodium
 *
 * Security properties:
 * - Key derivation: Argon2id (memory-hard, OWASP recommended)
 * - DEK derivation: crypto_kdf (deterministic, context-bound)
 * - Encryption: XSalsa20-Poly1305 (authenticated encryption)
 * - Storage: IndexedDB with binary data
 *
 * See docs/CRYPTOGRAPHY.md for full audit documentation.
 */

import sodium from "libsodium-wrappers-sumo";
import {
  clearAll,
  clearLegacyStorage,
  deleteAppEncrypted,
  getAllAppIds,
  getAllAppsEncrypted,
  getAppEncrypted,
  getSalt,
  setAppEncrypted,
  setSalt,
  hasStoredSecrets as storageHasSecrets,
} from "./storage.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Secrets for a single app
 */
export type AppSecrets = {
  client_secret: string;
  // Future: signing_key, api_key, etc.
};

/**
 * All secrets indexed by app ID
 */
export type SecretsData = Record<string, AppSecrets>;

/**
 * V3 export format (libsodium + IndexedDB)
 */
export type EncryptedSecretsExport = {
  version: 3;
  salt: string | null; // base64
  apps: Record<
    string,
    {
      nonce: string; // base64
      ciphertext: string; // base64
    }
  >;
};

// ============================================================================
// Argon2id Parameters (OWASP recommended)
// ============================================================================

const ARGON2_MEMORY_LIMIT = 67108864; // 64 MiB
const ARGON2_OPS_LIMIT = 3; // Iterations
const ARGON2_SALT_LENGTH = 16; // crypto_pwhash_SALTBYTES

// ============================================================================
// KDF Parameters for DEK derivation
// ============================================================================

const KDF_SUBKEY_LENGTH = 32; // crypto_secretbox_KEYBYTES
const KDF_KEYBYTES = 32; // crypto_kdf_KEYBYTES

// ============================================================================
// Libsodium Initialization
// ============================================================================

let sodiumReady = false;

/**
 * Ensure libsodium is initialized
 */
export async function ensureSodiumReady(): Promise<void> {
  if (!sodiumReady) {
    await sodium.ready;
    sodiumReady = true;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(arr: Uint8Array): string {
  return sodium.to_base64(arr, sodium.base64_variants.ORIGINAL);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  return sodium.from_base64(base64, sodium.base64_variants.ORIGINAL);
}

/**
 * Generate a random salt for Argon2id
 */
function generateSalt(): Uint8Array {
  return sodium.randombytes_buf(ARGON2_SALT_LENGTH);
}

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * Derive master key from password using Argon2id
 * Returns a 32-byte key suitable for HKDF
 */
export async function deriveMasterKey(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  await ensureSodiumReady();

  return sodium.crypto_pwhash(
    KDF_KEYBYTES, // 32 bytes
    password,
    salt,
    ARGON2_OPS_LIMIT,
    ARGON2_MEMORY_LIMIT,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}

/**
 * Derive a DEK (Data Encryption Key) for a specific app
 * Uses BLAKE2b hash with master key and app ID for deterministic derivation
 * DEKs are never stored - derived on-demand from master key + app ID
 */
function deriveDEK(masterKey: Uint8Array, appId: string): Uint8Array {
  // Use BLAKE2b keyed hash: H(masterKey, appId) -> 32-byte DEK
  // This provides cryptographic domain separation per app
  const appIdBytes = sodium.from_string(appId);
  return sodium.crypto_generichash(KDF_SUBKEY_LENGTH, appIdBytes, masterKey);
}

// ============================================================================
// Encryption / Decryption
// ============================================================================

/**
 * Encrypt app secrets using crypto_secretbox (XSalsa20-Poly1305)
 */
function encryptSecrets(
  secrets: AppSecrets,
  dek: Uint8Array,
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const plaintext = sodium.from_string(JSON.stringify(secrets));
  const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, dek);

  return { ciphertext, nonce };
}

/**
 * Decrypt app secrets using crypto_secretbox_open (XSalsa20-Poly1305)
 */
function decryptSecrets(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  dek: Uint8Array,
): AppSecrets {
  const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, dek);
  return JSON.parse(sodium.to_string(plaintext)) as AppSecrets;
}

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Check if encrypted secrets exist in storage
 */
export async function hasStoredSecrets(): Promise<boolean> {
  return storageHasSecrets();
}

/**
 * Get or create salt from storage
 */
async function getOrCreateSalt(): Promise<Uint8Array> {
  await ensureSodiumReady();

  const existingSalt = await getSalt();
  if (existingSalt) {
    return existingSalt;
  }

  const newSalt = generateSalt();
  await setSalt(newSalt);
  return newSalt;
}

/**
 * Encrypt and store a single app's secrets
 */
export async function encryptAndStoreAppSecrets(
  appId: string,
  secrets: AppSecrets,
  masterKey: Uint8Array,
): Promise<void> {
  await ensureSodiumReady();

  const dek = deriveDEK(masterKey, appId);
  const { ciphertext, nonce } = encryptSecrets(secrets, dek);

  await setAppEncrypted(appId, ciphertext, nonce);

  // Zero out the DEK from memory
  sodium.memzero(dek);
}

/**
 * Encrypt and store all secrets
 */
export async function encryptAndStoreSecrets(
  secrets: SecretsData,
  password: string,
): Promise<void> {
  await ensureSodiumReady();

  const salt = await getOrCreateSalt();
  const masterKey = await deriveMasterKey(password, salt);

  for (const [appId, appSecrets] of Object.entries(secrets)) {
    await encryptAndStoreAppSecrets(appId, appSecrets, masterKey);
  }

  // Zero out the master key from memory
  sodium.memzero(masterKey);
}

/**
 * Load and decrypt a single app's secrets on-demand
 * Only decrypts when accessed, reducing plaintext in memory
 */
export async function loadAndDecryptAppSecrets(
  appId: string,
  masterKey: Uint8Array,
): Promise<AppSecrets | null> {
  try {
    await ensureSodiumReady();

    const encrypted = await getAppEncrypted(appId);
    if (!encrypted) {
      return null;
    }

    const dek = deriveDEK(masterKey, appId);
    try {
      return decryptSecrets(encrypted.ciphertext, encrypted.nonce, dek);
    } finally {
      sodium.memzero(dek);
    }
  } catch {
    return null;
  }
}

/**
 * Verify password by attempting to decrypt any stored secret
 * Returns true if password is correct (or no secrets exist yet)
 */
export async function verifyPassword(password: string): Promise<boolean> {
  try {
    await ensureSodiumReady();

    const salt = await getSalt();
    if (!salt) {
      // No salt = no secrets stored yet, password is valid for new setup
      return true;
    }

    const appIds = await getAllAppIds();
    if (appIds.length === 0) {
      // Salt exists but no encrypted apps - password valid
      return true;
    }

    // Try to decrypt the first app to verify password
    const masterKey = await deriveMasterKey(password, salt);
    const firstAppId = appIds[0];
    const encrypted = await getAppEncrypted(firstAppId);

    if (!encrypted) {
      sodium.memzero(masterKey);
      return true;
    }

    const dek = deriveDEK(masterKey, firstAppId);
    try {
      // If decryption succeeds, password is correct
      decryptSecrets(encrypted.ciphertext, encrypted.nonce, dek);
      return true;
    } catch {
      return false;
    } finally {
      sodium.memzero(dek);
      sodium.memzero(masterKey);
    }
  } catch {
    return false;
  }
}

/**
 * Load and decrypt all secrets from storage
 * @deprecated Use loadAndDecryptAppSecrets() for on-demand decryption
 */
export async function loadAndDecryptSecrets(
  password: string,
): Promise<SecretsData | null> {
  try {
    await ensureSodiumReady();

    const salt = await getSalt();
    if (!salt) {
      return null;
    }

    const masterKey = await deriveMasterKey(password, salt);
    const allEncrypted = await getAllAppsEncrypted();
    const secrets: SecretsData = {};

    for (const [appId, { ciphertext, nonce }] of allEncrypted) {
      const dek = deriveDEK(masterKey, appId);
      try {
        secrets[appId] = decryptSecrets(ciphertext, nonce, dek);
      } finally {
        sodium.memzero(dek);
      }
    }

    // Zero out the master key from memory
    sodium.memzero(masterKey);

    return secrets;
  } catch {
    // Decryption failed (wrong password or corrupted data)
    return null;
  }
}

/**
 * Remove a single app's secrets from storage
 */
export async function removeAppSecretsFromStorage(
  appId: string,
): Promise<void> {
  await deleteAppEncrypted(appId);
}

/**
 * Clear all secrets from storage
 */
export async function clearStoredSecrets(): Promise<void> {
  await clearAll();
  clearLegacyStorage();
}

/**
 * Create an empty secrets object for a new app
 */
export function createEmptyAppSecrets(): AppSecrets {
  return {
    client_secret: "",
  };
}

// ============================================================================
// Export / Import (JSON portable format)
// ============================================================================

/**
 * Export encrypted secrets data (for backup)
 * Returns the raw encrypted data - still requires password to decrypt
 */
export async function exportEncryptedSecrets(): Promise<EncryptedSecretsExport> {
  try {
    await ensureSodiumReady();

    const salt = await getSalt();
    const allEncrypted = await getAllAppsEncrypted();

    const apps: EncryptedSecretsExport["apps"] = {};
    for (const [appId, { ciphertext, nonce }] of allEncrypted) {
      apps[appId] = {
        ciphertext: uint8ArrayToBase64(ciphertext),
        nonce: uint8ArrayToBase64(nonce),
      };
    }

    return {
      version: 3,
      salt: salt ? uint8ArrayToBase64(salt) : null,
      apps,
    };
  } catch {
    return { version: 3, salt: null, apps: {} };
  }
}

/**
 * Import encrypted secrets data (from backup)
 * Overwrites existing encrypted secrets
 */
export async function importEncryptedSecrets(
  data: EncryptedSecretsExport,
): Promise<boolean> {
  try {
    // Version check
    if (data.version !== 3) {
      console.warn(
        `Unsupported secrets export version: ${data.version}. Expected version 3.`,
      );
      return false;
    }

    if (!data.salt) {
      return false;
    }

    await ensureSodiumReady();

    // Clear existing data
    await clearAll();

    // Import salt
    const salt = base64ToUint8Array(data.salt);
    await setSalt(salt);

    // Import each app's encrypted data
    for (const [appId, { ciphertext, nonce }] of Object.entries(data.apps)) {
      await setAppEncrypted(
        appId,
        base64ToUint8Array(ciphertext),
        base64ToUint8Array(nonce),
      );
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Password Change
// ============================================================================

/**
 * Change the master password
 * With derived DEKs, this requires re-encrypting all secrets
 */
export async function reencryptWithNewPassword(
  secrets: SecretsData,
  newPassword: string,
): Promise<void> {
  await ensureSodiumReady();

  // Generate new salt for the new password
  const newSalt = generateSalt();
  await setSalt(newSalt);

  const newMasterKey = await deriveMasterKey(newPassword, newSalt);

  // Clear existing encrypted data and re-encrypt with new key
  const appIds = await getAllAppIds();
  for (const appId of appIds) {
    await deleteAppEncrypted(appId);
  }

  for (const [appId, appSecrets] of Object.entries(secrets)) {
    await encryptAndStoreAppSecrets(appId, appSecrets, newMasterKey);
  }

  // Zero out the master key from memory
  sodium.memzero(newMasterKey);
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Zero out sensitive data from memory
 */
export function secureZero(data: Uint8Array): void {
  sodium.memzero(data);
}

/**
 * Get the derived master key (for use by the store)
 * Caller is responsible for zeroing the key when done
 */
export async function getMasterKey(
  password: string,
): Promise<Uint8Array | null> {
  try {
    await ensureSodiumReady();

    const salt = await getSalt();
    if (!salt) {
      return null;
    }

    return deriveMasterKey(password, salt);
  } catch {
    return null;
  }
}

/**
 * Initialize salt for first-time setup
 */
export async function initializeSalt(): Promise<void> {
  await getOrCreateSalt();
}
