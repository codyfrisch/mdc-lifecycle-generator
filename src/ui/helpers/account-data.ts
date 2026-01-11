/**
 * Account/User data management
 */

export type AccountUserData = {
  account_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  account_name: string;
  account_slug: string;
  account_tier: string | null;
  account_max_users: number | null;
};

const STORAGE_KEY = "lifecycle_webhook_account_data";

/**
 * Save account/user data to localStorage
 */
export function saveAccountData(data: AccountUserData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save account data to localStorage:", error);
  }
}

/**
 * Load account/user data from localStorage
 */
export function loadAccountData(): AccountUserData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as AccountUserData;
  } catch {
    return null;
  }
}

/**
 * Export account/user data as JSON string
 */
export function exportAccountData(data: AccountUserData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Import account/user data from JSON string
 */
export function importAccountData(json: string): AccountUserData | null {
  try {
    return JSON.parse(json) as AccountUserData;
  } catch {
    return null;
  }
}
