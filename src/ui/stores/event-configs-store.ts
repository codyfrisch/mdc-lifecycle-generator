import type { Readable, Writable } from "svelte/store";
import { derived, get, writable } from "svelte/store";

/**
 * Event configuration - a complete test scenario
 * Scoped to an app+account combination
 */
export type EventConfiguration = {
  id: string;
  name: string;
  appId: string;
  accountId: string;
  event_type: string;
  pricing_version: string;
  plan_id: string;
  billing_period: string;
  renewal_date: string;
  reason: string;
  created_at: string;
  updated_at: string;
};

/**
 * Collection of event configurations with selected app/account context
 */
export type EventConfigCollection = {
  configs: EventConfiguration[];
  selectedConfigId: string | null;
  selectedAppId: string | null;
  selectedAccountId: string | null;
};

const STORAGE_KEY = "lifecycle_webhook_event_configs";

function generateId(): string {
  return `config_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a default event configuration for the given app/account
 */
export function createDefaultConfig(
  appId: string,
  accountId: string,
): EventConfiguration {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: "New Configuration",
    appId,
    accountId,
    event_type: "install",
    pricing_version: "",
    plan_id: "",
    billing_period: "monthly",
    renewal_date: "",
    reason: "",
    created_at: now,
    updated_at: now,
  };
}

const defaultCollection: EventConfigCollection = {
  configs: [],
  selectedConfigId: null,
  selectedAppId: null,
  selectedAccountId: null,
};

/**
 * Save collection to localStorage
 */
function saveToStorage(data: EventConfigCollection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save event configs to localStorage:", error);
  }
}

/**
 * Load collection from localStorage
 */
function loadFromStorage(): EventConfigCollection | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as EventConfigCollection;
  } catch {
    return null;
  }
}

/**
 * Event config collection store
 */
export const eventConfigCollection: Writable<EventConfigCollection> =
  writable<EventConfigCollection>(defaultCollection);

/**
 * Derived store for the currently selected config
 */
export const selectedEventConfig: Readable<EventConfiguration | null> = derived(
  eventConfigCollection,
  ($collection) => {
    if (!$collection.selectedConfigId) {
      return null;
    }
    return (
      $collection.configs.find((c) => c.id === $collection.selectedConfigId) ??
      null
    );
  },
);

/**
 * Derived store for configs filtered by selected app+account
 */
export const filteredConfigs: Readable<EventConfiguration[]> = derived(
  eventConfigCollection,
  ($collection) => {
    if (!$collection.selectedAppId || !$collection.selectedAccountId) {
      return [];
    }
    return $collection.configs.filter(
      (c) =>
        c.appId === $collection.selectedAppId &&
        c.accountId === $collection.selectedAccountId,
    );
  },
);

/**
 * Derived store for the selected app ID
 */
export const configSelectedAppId: Readable<string | null> = derived(
  eventConfigCollection,
  ($collection) => $collection.selectedAppId,
);

/**
 * Derived store for the selected account ID
 */
export const configSelectedAccountId: Readable<string | null> = derived(
  eventConfigCollection,
  ($collection) => $collection.selectedAccountId,
);

/**
 * Initialize event configs from localStorage
 */
export function initializeEventConfigs(): void {
  const saved = loadFromStorage();
  if (saved) {
    // Ensure new fields exist for backwards compatibility
    eventConfigCollection.set({
      ...defaultCollection,
      ...saved,
    });
  } else {
    eventConfigCollection.set(defaultCollection);
  }
}

/**
 * Select an app for the configuration context
 */
export function selectConfigApp(appId: string): void {
  eventConfigCollection.update((collection) => {
    // When app changes, reset config selection to first matching or null
    const matchingConfigs = collection.configs.filter(
      (c) => c.appId === appId && c.accountId === collection.selectedAccountId,
    );
    const selectedConfigId =
      matchingConfigs.length > 0 ? matchingConfigs[0].id : null;

    const updated = {
      ...collection,
      selectedAppId: appId,
      selectedConfigId,
    };
    saveToStorage(updated);
    return updated;
  });
}

/**
 * Select an account for the configuration context
 */
export function selectConfigAccount(accountId: string): void {
  eventConfigCollection.update((collection) => {
    // When account changes, reset config selection to first matching or null
    const matchingConfigs = collection.configs.filter(
      (c) => c.appId === collection.selectedAppId && c.accountId === accountId,
    );
    const selectedConfigId =
      matchingConfigs.length > 0 ? matchingConfigs[0].id : null;

    const updated = {
      ...collection,
      selectedAccountId: accountId,
      selectedConfigId,
    };
    saveToStorage(updated);
    return updated;
  });
}

/**
 * Add a new configuration for the current app/account context
 */
export function addConfig(
  config?: EventConfiguration,
): EventConfiguration | null {
  const collection = get(eventConfigCollection);
  if (!collection.selectedAppId || !collection.selectedAccountId) {
    return null;
  }

  const newConfig =
    config ??
    createDefaultConfig(collection.selectedAppId, collection.selectedAccountId);

  eventConfigCollection.update((col) => {
    const updated = {
      ...col,
      configs: [...col.configs, newConfig],
      selectedConfigId: newConfig.id,
    };
    saveToStorage(updated);
    return updated;
  });
  return newConfig;
}

/**
 * Update a configuration
 */
export function updateConfig(
  configId: string,
  updates: Partial<EventConfiguration>,
): void {
  eventConfigCollection.update((collection) => {
    const configs = collection.configs.map((c) =>
      c.id === configId
        ? { ...c, ...updates, updated_at: new Date().toISOString() }
        : c,
    );
    const updated = { ...collection, configs };
    saveToStorage(updated);
    return updated;
  });
}

/**
 * Remove a configuration
 */
export function removeConfig(configId: string): void {
  eventConfigCollection.update((collection) => {
    const configs = collection.configs.filter((c) => c.id !== configId);
    let selectedConfigId = collection.selectedConfigId;
    if (selectedConfigId === configId) {
      // Select next config in the same app/account scope
      const scopedConfigs = configs.filter(
        (c) =>
          c.appId === collection.selectedAppId &&
          c.accountId === collection.selectedAccountId,
      );
      selectedConfigId = scopedConfigs.length > 0 ? scopedConfigs[0].id : null;
    }
    const updated = { ...collection, configs, selectedConfigId };
    saveToStorage(updated);
    return updated;
  });
}

/**
 * Duplicate a configuration
 */
export function duplicateConfig(configId: string): EventConfiguration | null {
  const collection = get(eventConfigCollection);
  const original = collection.configs.find((c) => c.id === configId);
  if (!original) {
    return null;
  }

  const now = new Date().toISOString();
  const duplicate: EventConfiguration = {
    ...original,
    id: generateId(),
    name: `${original.name} (Copy)`,
    created_at: now,
    updated_at: now,
  };

  addConfig(duplicate);
  return duplicate;
}

/**
 * Select a configuration
 */
export function selectConfig(configId: string): void {
  eventConfigCollection.update((collection) => {
    const updated = { ...collection, selectedConfigId: configId };
    saveToStorage(updated);
    return updated;
  });
}

/**
 * Clear old event form storage key (cleanup from old implementation)
 */
export function clearOldEventFormStorage(): void {
  try {
    localStorage.removeItem("lifecycle_webhook_event_form");
  } catch {
    // Ignore errors
  }
}

/**
 * Export event configs for backup
 */
export function exportEventConfigs(): EventConfigCollection {
  return get(eventConfigCollection);
}

/**
 * Import event configs from backup
 */
export function importEventConfigs(data: EventConfigCollection): void {
  // Merge with existing - add new configs, skip duplicates by ID
  eventConfigCollection.update((collection) => {
    const existingIds = new Set(collection.configs.map((c) => c.id));
    const newConfigs = data.configs.filter((c) => !existingIds.has(c.id));
    const merged: EventConfigCollection = {
      ...collection,
      configs: [...collection.configs, ...newConfigs],
    };
    saveToStorage(merged);
    return merged;
  });
}
