import { derived, type Readable, type Writable, writable } from "svelte/store";
import type { PricingVersionDataMap } from "../../types.js";

export type AppData = {
  id: string;
  app_id: string;
  client_id: string;
  app_name: string;
  webhook_url: string;
  pricing_version: PricingVersionDataMap;
};

export type AppCollection = {
  apps: AppData[];
  selectedAppId: string | null;
};

const STORAGE_KEY = "lifecycle_webhook_apps_collection";

function generateId(): string {
  return `app_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createDefaultApp(): AppData {
  return {
    id: generateId(),
    app_id: "",
    client_id: "",
    app_name: "",
    webhook_url: "",
    pricing_version: {},
  };
}

const defaultCollection: AppCollection = {
  apps: [],
  selectedAppId: null,
};

/**
 * App collection store
 */
export const appCollection: Writable<AppCollection> =
  writable<AppCollection>(defaultCollection);

/**
 * Derived store for the currently selected app
 */
export const selectedApp: Readable<AppData | null> = derived(
  appCollection,
  ($collection) => {
    if (!$collection.selectedAppId) {
      return null;
    }
    return (
      $collection.apps.find((a) => a.id === $collection.selectedAppId) ?? null
    );
  },
);

/**
 * Active pricing version for the selected app
 */
export const activePricingVersion: Writable<string | null> = writable<
  string | null
>(null);

/**
 * Save app collection to localStorage
 */
function saveToStorage(data: AppCollection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save apps collection to localStorage:", error);
  }
}

/**
 * Load app collection from localStorage
 */
function loadFromStorage(): AppCollection | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Try migrating from old single-app config format
      const oldKey = "lifecycle_webhook_config";
      const oldStored = localStorage.getItem(oldKey);
      if (oldStored) {
        const oldData = JSON.parse(oldStored) as {
          app_id?: string;
          app_name?: string;
          webhook_url?: string;
          pricing_version?: PricingVersionDataMap;
        };
        if (oldData.app_id) {
          const migratedApp: AppData = {
            id: generateId(),
            app_id: oldData.app_id || "",
            client_id: "",
            app_name: oldData.app_name || "",
            webhook_url: oldData.webhook_url || "",
            pricing_version: oldData.pricing_version || {},
          };
          const migratedCollection: AppCollection = {
            apps: [migratedApp],
            selectedAppId: migratedApp.id,
          };
          saveToStorage(migratedCollection);
          localStorage.removeItem(oldKey);
          return migratedCollection;
        }
      }
      return null;
    }
    return JSON.parse(stored) as AppCollection;
  } catch {
    return null;
  }
}

/**
 * Initialize apps collection from localStorage
 */
export function initializeAppsData(): void {
  const saved = loadFromStorage();
  if (saved) {
    appCollection.set(saved);
    // Set active pricing version to highest for selected app
    if (saved.selectedAppId) {
      const app = saved.apps.find((a) => a.id === saved.selectedAppId);
      if (app?.pricing_version) {
        const versions = Object.keys(app.pricing_version);
        if (versions.length > 0) {
          const sorted = versions.sort((a, b) => Number(b) - Number(a));
          activePricingVersion.set(sorted[0]);
        }
      }
    }
  } else {
    appCollection.set(defaultCollection);
  }
}

/**
 * Add a new app to the collection
 */
export function addApp(app?: AppData): AppData {
  const newApp = app ?? createDefaultApp();
  appCollection.update((collection) => {
    const updated = {
      ...collection,
      apps: [...collection.apps, newApp],
      selectedAppId: collection.selectedAppId ?? newApp.id,
    };
    saveToStorage(updated);
    return updated;
  });
  return newApp;
}

/**
 * Remove an app from the collection
 */
export function removeApp(appId: string): void {
  appCollection.update((collection) => {
    const apps = collection.apps.filter((a) => a.id !== appId);
    let selectedAppId = collection.selectedAppId;
    if (selectedAppId === appId) {
      selectedAppId = apps.length > 0 ? apps[0].id : null;
    }
    const updated = { apps, selectedAppId };
    saveToStorage(updated);
    return updated;
  });
}

/**
 * Update an app in the collection
 */
export function updateApp(appId: string, updates: Partial<AppData>): void {
  appCollection.update((collection) => {
    const apps = collection.apps.map((a) =>
      a.id === appId ? { ...a, ...updates } : a,
    );
    const updated = { ...collection, apps };
    saveToStorage(updated);
    return updated;
  });
}

/**
 * Select an app
 */
export function selectApp(appId: string): void {
  appCollection.update((collection) => {
    const updated = { ...collection, selectedAppId: appId };
    saveToStorage(updated);

    // Update active pricing version for the new selected app
    const app = collection.apps.find((a) => a.id === appId);
    if (app?.pricing_version) {
      const versions = Object.keys(app.pricing_version);
      if (versions.length > 0) {
        const sorted = versions.sort((a, b) => Number(b) - Number(a));
        activePricingVersion.set(sorted[0]);
      } else {
        activePricingVersion.set(null);
      }
    } else {
      activePricingVersion.set(null);
    }

    return updated;
  });
}

/**
 * Add a pricing version to the selected app
 */
export function addPricingVersion(version: string): boolean {
  let success = false;
  appCollection.update((collection) => {
    if (!collection.selectedAppId) return collection;

    const apps = collection.apps.map((app) => {
      if (app.id === collection.selectedAppId) {
        if (version in app.pricing_version) {
          return app; // Already exists
        }
        success = true;
        return {
          ...app,
          pricing_version: {
            ...app.pricing_version,
            [version]: {
              plans: {},
              freePlan: null,
              trialPlan: null,
            },
          },
        };
      }
      return app;
    });

    const updated = { ...collection, apps };
    saveToStorage(updated);

    // Set as active if first version
    const selectedApp = apps.find((a) => a.id === collection.selectedAppId);
    if (selectedApp && Object.keys(selectedApp.pricing_version).length === 1) {
      activePricingVersion.set(version);
    }

    return updated;
  });
  return success;
}

/**
 * Remove a pricing version from the selected app
 */
export function removePricingVersion(version: string): void {
  appCollection.update((collection) => {
    if (!collection.selectedAppId) return collection;

    const apps = collection.apps.map((app) => {
      if (app.id === collection.selectedAppId) {
        const { [version]: _, ...remaining } = app.pricing_version;
        return {
          ...app,
          pricing_version: remaining,
        };
      }
      return app;
    });

    const updated = { ...collection, apps };
    saveToStorage(updated);
    return updated;
  });
}

/**
 * Export app collection as JSON string
 * NOTE: This intentionally excludes secrets (client_secret, etc.)
 * Secrets are stored separately in an encrypted store and are not exported.
 */
export function exportAppCollection(data: AppCollection): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Import app collection from JSON string
 * NOTE: Imported apps will not have secrets - those must be re-entered manually.
 * Secrets are stored separately in an encrypted store for security.
 */
export function importAppCollection(json: string): AppCollection | null {
  try {
    const parsed = JSON.parse(json) as AppCollection;
    if (!Array.isArray(parsed.apps)) {
      return null;
    }
    appCollection.set(parsed);
    saveToStorage(parsed);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Import a single app from JSON string
 */
export function importSingleApp(json: string): AppData | null {
  try {
    const parsed = JSON.parse(json) as Partial<AppData>;
    const newApp: AppData = {
      id: parsed.id ?? generateId(),
      app_id: parsed.app_id ?? "",
      client_id: parsed.client_id ?? "",
      app_name: parsed.app_name ?? "",
      webhook_url: parsed.webhook_url ?? "",
      pricing_version: parsed.pricing_version ?? {},
    };
    addApp(newApp);
    return newApp;
  } catch {
    return null;
  }
}
