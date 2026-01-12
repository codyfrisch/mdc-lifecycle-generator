/**
 * IndexedDB storage for encrypted secrets using idb library
 * Provides binary storage for encrypted data without base64 overhead
 */

import type { DBSchema, IDBPDatabase } from "idb";
import { openDB } from "idb";

const DB_NAME = "lifecycle-secrets";
const DB_VERSION = 1;
const STORE_NAME = "secrets";

/**
 * Database schema for IndexedDB
 */
interface SecretsDBSchema extends DBSchema {
  secrets: {
    key: string;
    value: {
      key: string;
      data: Uint8Array;
      nonce?: Uint8Array;
    };
  };
}

/**
 * Stored salt entry
 */
export type StoredSalt = {
  key: "salt";
  data: Uint8Array;
};

/**
 * Stored encrypted app secrets
 */
export type StoredAppSecrets = {
  key: string; // `app:${appId}`
  data: Uint8Array; // ciphertext
  nonce: Uint8Array; // 24 bytes for XSalsa20-Poly1305
};

let dbInstance: IDBPDatabase<SecretsDBSchema> | null = null;

/**
 * Initialize and open the secrets database
 */
export async function initSecretsDB(): Promise<IDBPDatabase<SecretsDBSchema>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<SecretsDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create the secrets store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    },
  });

  return dbInstance;
}

/**
 * Get the database instance (initializes if needed)
 */
async function getDB(): Promise<IDBPDatabase<SecretsDBSchema>> {
  if (!dbInstance) {
    return initSecretsDB();
  }
  return dbInstance;
}

/**
 * Check if encrypted secrets exist in storage
 */
export async function hasStoredSecrets(): Promise<boolean> {
  try {
    const db = await getDB();
    const salt = await db.get(STORE_NAME, "salt");
    return salt !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get the stored salt
 */
export async function getSalt(): Promise<Uint8Array | null> {
  try {
    const db = await getDB();
    const entry = await db.get(STORE_NAME, "salt");
    if (entry?.data) {
      return entry.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Store the salt
 */
export async function setSalt(salt: Uint8Array): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, {
    key: "salt",
    data: salt,
  });
}

/**
 * Get encrypted data for a specific app
 */
export async function getAppEncrypted(
  appId: string,
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array } | null> {
  try {
    const db = await getDB();
    const entry = await db.get(STORE_NAME, `app:${appId}`);
    if (entry?.data && entry?.nonce) {
      return {
        ciphertext: entry.data,
        nonce: entry.nonce,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Store encrypted data for a specific app
 */
export async function setAppEncrypted(
  appId: string,
  ciphertext: Uint8Array,
  nonce: Uint8Array,
): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, {
    key: `app:${appId}`,
    data: ciphertext,
    nonce: nonce,
  });
}

/**
 * Delete encrypted data for a specific app
 */
export async function deleteAppEncrypted(appId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, `app:${appId}`);
}

/**
 * Get all stored app IDs
 */
export async function getAllAppIds(): Promise<string[]> {
  const db = await getDB();
  const allKeys = await db.getAllKeys(STORE_NAME);
  return allKeys
    .filter((key) => key.startsWith("app:"))
    .map((key) => key.slice(4)); // Remove "app:" prefix
}

/**
 * Get all encrypted app data (for export)
 */
export async function getAllAppsEncrypted(): Promise<
  Map<string, { ciphertext: Uint8Array; nonce: Uint8Array }>
> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  const result = new Map<
    string,
    { ciphertext: Uint8Array; nonce: Uint8Array }
  >();

  for (const entry of all) {
    if (entry.key.startsWith("app:") && entry.data && entry.nonce) {
      const appId = entry.key.slice(4);
      result.set(appId, {
        ciphertext: entry.data,
        nonce: entry.nonce,
      });
    }
  }

  return result;
}

/**
 * Clear all secrets from storage
 */
export async function clearAll(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

/**
 * Close the database connection
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Clear old localStorage data (migration cleanup)
 */
export function clearLegacyStorage(): void {
  try {
    localStorage.removeItem("lifecycle_webhook_secrets");
    localStorage.removeItem("lifecycle_webhook_salt");
  } catch {
    // Ignore errors if localStorage is unavailable
  }
}
