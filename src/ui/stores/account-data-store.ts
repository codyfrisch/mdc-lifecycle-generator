import { derived, type Readable, type Writable, writable } from "svelte/store";

export type AccountUserData = {
  id: string;
  account_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_country: string;
  user_cluster: string;
  is_admin: boolean;
  is_guest: boolean;
  is_view_only: boolean;
  user_kind: string | null;
  account_name: string;
  account_slug: string;
  account_tier: string | null;
  account_max_users: number | null;
};

export type AccountCollection = {
  accounts: AccountUserData[];
  selectedAccountId: string | null;
};

const STORAGE_KEY = "lifecycle_webhook_account_collection";

function generateId(): string {
  return `account_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createDefaultAccount(): AccountUserData {
  return {
    id: generateId(),
    account_id: "",
    user_id: "",
    user_name: "",
    user_email: "",
    user_country: "US",
    user_cluster: "other",
    is_admin: false,
    is_guest: false,
    is_view_only: false,
    user_kind: null,
    account_name: "",
    account_slug: "",
    account_tier: null,
    account_max_users: null,
  };
}

const defaultCollection: AccountCollection = {
  accounts: [],
  selectedAccountId: null,
};

/**
 * Account collection store
 */
export const accountCollection: Writable<AccountCollection> =
  writable<AccountCollection>(defaultCollection);

/**
 * Derived store for the currently selected account
 */
export const accountData: Readable<AccountUserData | null> = derived(
  accountCollection,
  ($collection) => {
    if (!$collection.selectedAccountId) {
      return null;
    }
    return (
      $collection.accounts.find(
        (a) => a.id === $collection.selectedAccountId,
      ) ?? null
    );
  },
);

/**
 * Auto-save timer
 */
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Save account collection to localStorage
 */
function saveToStorage(data: AccountCollection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save account collection to localStorage:", error);
  }
}

/**
 * Load account collection from localStorage
 */
function loadFromStorage(): AccountCollection | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Try migrating from old single-account format
      const oldKey = "lifecycle_webhook_account_data";
      const oldStored = localStorage.getItem(oldKey);
      if (oldStored) {
        const oldData = JSON.parse(oldStored) as Omit<AccountUserData, "id">;
        const migratedAccount: AccountUserData = {
          ...oldData,
          id: generateId(),
        };
        const migratedCollection: AccountCollection = {
          accounts: [migratedAccount],
          selectedAccountId: migratedAccount.id,
        };
        // Save migrated data and remove old key
        saveToStorage(migratedCollection);
        localStorage.removeItem(oldKey);
        return migratedCollection;
      }
      return null;
    }
    return JSON.parse(stored) as AccountCollection;
  } catch {
    return null;
  }
}

/**
 * Auto-save account collection with debounce (2 seconds)
 */
export function autoSaveAccountCollection(data: AccountCollection): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
  autoSaveTimer = setTimeout(() => {
    saveToStorage(data);
    autoSaveTimer = null;
  }, 2000);
}

/**
 * Save immediately
 */
export function saveAccountCollectionImmediately(
  data: AccountCollection,
): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  saveToStorage(data);
}

/**
 * Initialize account collection from localStorage
 */
export function initializeAccountData(): void {
  const saved = loadFromStorage();
  if (saved) {
    accountCollection.set(saved);
  } else {
    accountCollection.set(defaultCollection);
  }
}

/**
 * Add a new account to the collection
 */
export function addAccount(account?: AccountUserData): AccountUserData {
  const newAccount = account ?? createDefaultAccount();
  accountCollection.update((collection) => {
    const updated = {
      ...collection,
      accounts: [...collection.accounts, newAccount],
      selectedAccountId: collection.selectedAccountId ?? newAccount.id,
    };
    saveAccountCollectionImmediately(updated);
    return updated;
  });
  return newAccount;
}

/**
 * Remove an account from the collection
 */
export function removeAccount(accountId: string): void {
  accountCollection.update((collection) => {
    const accounts = collection.accounts.filter((a) => a.id !== accountId);
    let selectedAccountId = collection.selectedAccountId;
    if (selectedAccountId === accountId) {
      selectedAccountId = accounts.length > 0 ? accounts[0].id : null;
    }
    const updated = { accounts, selectedAccountId };
    saveAccountCollectionImmediately(updated);
    return updated;
  });
}

/**
 * Update an account in the collection
 */
export function updateAccount(
  accountId: string,
  updates: Partial<AccountUserData>,
): void {
  accountCollection.update((collection) => {
    const accounts = collection.accounts.map((a) =>
      a.id === accountId ? { ...a, ...updates } : a,
    );
    const updated = { ...collection, accounts };
    autoSaveAccountCollection(updated);
    return updated;
  });
}

/**
 * Select an account
 */
export function selectAccount(accountId: string): void {
  accountCollection.update((collection) => {
    const updated = { ...collection, selectedAccountId: accountId };
    saveAccountCollectionImmediately(updated);
    return updated;
  });
}

/**
 * Get account by ID
 */
export function getAccountById(accountId: string): AccountUserData | undefined {
  let result: AccountUserData | undefined;
  accountCollection.subscribe((collection) => {
    result = collection.accounts.find((a) => a.id === accountId);
  })();
  return result;
}

/**
 * Export account collection as JSON string
 */
export function exportAccountCollection(data: AccountCollection): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Import account collection from JSON string
 */
export function importAccountCollection(
  json: string,
): AccountCollection | null {
  try {
    const parsed = JSON.parse(json) as AccountCollection;
    // Validate structure
    if (!Array.isArray(parsed.accounts)) {
      return null;
    }
    accountCollection.set(parsed);
    saveAccountCollectionImmediately(parsed);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Import a single account from JSON string (for backward compatibility)
 */
export function importSingleAccount(json: string): AccountUserData | null {
  try {
    const parsed = JSON.parse(json) as Partial<AccountUserData>;
    const newAccount: AccountUserData = {
      id: parsed.id ?? generateId(),
      account_id: parsed.account_id ?? "",
      user_id: parsed.user_id ?? "",
      user_name: parsed.user_name ?? "",
      user_email: parsed.user_email ?? "",
      user_country: parsed.user_country ?? "US",
      user_cluster: parsed.user_cluster ?? "other",
      is_admin: parsed.is_admin ?? false,
      is_guest: parsed.is_guest ?? false,
      is_view_only: parsed.is_view_only ?? false,
      user_kind: parsed.user_kind ?? null,
      account_name: parsed.account_name ?? "",
      account_slug: parsed.account_slug ?? "",
      account_tier: parsed.account_tier ?? null,
      account_max_users: parsed.account_max_users ?? null,
    };
    addAccount(newAccount);
    return newAccount;
  } catch {
    return null;
  }
}

// Legacy exports for backward compatibility
export function autoSaveAccountData(data: AccountUserData): void {
  updateAccount(data.id, data);
}

export function importAccountData(json: string): AccountUserData | null {
  return importSingleAccount(json);
}
