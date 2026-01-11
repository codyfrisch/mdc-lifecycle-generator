/** biome-ignore-all lint/correctness/useParseIntRadix: parseInt is used for user input where radix is implicit */
import {
  accountDataUpload,
  accountId,
  accountMaxUsers,
  accountName,
  accountSlug,
  accountTier,
  exportAccountDataBtn,
  importAccountDataBtn,
  userEmail,
  userId,
  userName,
} from "../dom-elements.js";
import {
  type AccountUserData,
  exportAccountData,
  importAccountData,
  loadAccountData,
  saveAccountData,
} from "../helpers/account-data.js";
import { showMessage } from "../helpers/messages.js";
import { updatePreview } from "./preview.js";

/**
 * Get account/user data from form inputs
 */
function getAccountDataFromForm(): AccountUserData {
  return {
    account_id: accountId.value || "",
    user_id: userId.value || "",
    user_name: userName.value || "",
    user_email: userEmail.value || "",
    account_name: accountName.value || "",
    account_slug: accountSlug.value || "",
    account_tier: accountTier.value === "" ? null : accountTier.value,
    account_max_users: accountMaxUsers.value
      ? parseInt(accountMaxUsers.value)
      : null,
  };
}

/**
 * Populate form inputs from account/user data
 */
function setAccountDataToForm(data: AccountUserData): void {
  accountId.value = data.account_id || "";
  userId.value = data.user_id || "";
  userName.value = data.user_name || "";
  userEmail.value = data.user_email || "";
  accountName.value = data.account_name || "";
  accountSlug.value = data.account_slug || "";
  accountTier.value = data.account_tier || "";
  accountMaxUsers.value = data.account_max_users?.toString() || "";
}

/**
 * Debounced auto-save timer
 */
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Auto-save account data with 2 second debounce
 */
function autoSaveAccountData() {
  // Clear existing timer
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  // Set new timer for 2 seconds
  autoSaveTimer = setTimeout(() => {
    const data = getAccountDataFromForm();
    saveAccountData(data);
    autoSaveTimer = null;
  }, 2000);
}

/**
 * Handle export account data
 */
function handleExportAccountData() {
  const data = getAccountDataFromForm();
  const json = exportAccountData(data);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "account-data.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showMessage("Account data exported", "success");
}

/**
 * Handle import account data
 */
function handleImportAccountData() {
  if (!accountDataUpload) return;
  accountDataUpload.click();
}

/**
 * Handle account data file upload
 */
function handleAccountDataUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result as string;
    if (text) {
      const data = importAccountData(text);
      if (data) {
        setAccountDataToForm(data);
        // Save immediately after import (programmatic changes don't trigger input events)
        saveAccountData(data);
        updatePreview();
        showMessage("Account data imported and saved", "success");
      } else {
        showMessage("Failed to parse account data JSON", "error");
      }
    }
  };
  reader.readAsText(file);
  // Reset input so same file can be selected again
  target.value = "";
}

/**
 * Setup event listeners for account data management
 */
export function setupAccountDataListeners() {
  // Auto-save on input changes (with debounce)
  const accountInputs = [
    accountId,
    userId,
    userName,
    userEmail,
    accountName,
    accountSlug,
    accountTier,
    accountMaxUsers,
  ];

  accountInputs.forEach((input) => {
    input.addEventListener("input", () => {
      autoSaveAccountData();
      updatePreview();
    });
    input.addEventListener("change", () => {
      autoSaveAccountData();
      updatePreview();
    });
  });

  if (exportAccountDataBtn) {
    exportAccountDataBtn.addEventListener("click", handleExportAccountData);
  }

  if (importAccountDataBtn) {
    importAccountDataBtn.addEventListener("click", handleImportAccountData);
  }

  if (accountDataUpload) {
    accountDataUpload.addEventListener("change", handleAccountDataUpload);
  }
}

/**
 * Load account data on initialization if available
 */
export function initializeAccountData() {
  const data = loadAccountData();
  if (data) {
    setAccountDataToForm(data);
  }
}
