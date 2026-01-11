/**
 * Centralized DOM element references
 */

export const tabConfig = document.getElementById(
  "tab-config",
) as HTMLButtonElement;
export const tabAccountUserConfig = document.getElementById(
  "tab-account-user-config",
) as HTMLButtonElement;
export const tabManageLifecycle = document.getElementById(
  "tab-manage-lifecycle",
) as HTMLButtonElement;
export const configPanel = document.getElementById(
  "config-panel",
) as HTMLDivElement;
export const accountUserConfigPanel = document.getElementById(
  "account-user-config-panel",
) as HTMLDivElement;
export const manageLifecyclePanel = document.getElementById(
  "manage-lifecycle-panel",
) as HTMLDivElement;
export const configUpload = document.getElementById(
  "config-upload",
) as HTMLInputElement;
export const appConfigId = document.getElementById(
  "app-config-id",
) as HTMLInputElement | null;
export const appConfigName = document.getElementById(
  "app-config-name",
) as HTMLInputElement | null;
export const appConfigWebhookUrl = document.getElementById(
  "app-config-webhook-url",
) as HTMLInputElement | null;
export const pricingVersionsList = document.getElementById(
  "pricing-versions-list",
) as HTMLDivElement | null;
export const addPricingVersionBtn = document.getElementById(
  "add-pricing-version",
) as HTMLButtonElement | null;
export const newPricingVersion = document.getElementById(
  "new-pricing-version",
) as HTMLInputElement | null;
export const pricingVersionError = document.getElementById(
  "pricing-version-error",
) as HTMLDivElement | null;
export const activePricingVersion = document.getElementById(
  "active-pricing-version",
) as HTMLSelectElement | null;
export const plansList = document.getElementById(
  "plans-list",
) as HTMLDivElement | null;
export const addPlanBtn = document.getElementById(
  "add-plan",
) as HTMLButtonElement | null;
export const newPlanId = document.getElementById(
  "new-plan-id",
) as HTMLInputElement | null;
export const newPlanIsFree = document.getElementById(
  "new-plan-is-free",
) as HTMLInputElement | null;
export const newPlanIsTrial = document.getElementById(
  "new-plan-is-trial",
) as HTMLInputElement | null;
export const newPlanIndex = document.getElementById(
  "new-plan-index",
) as HTMLInputElement | null;
export const newPlanMaxUnits = document.getElementById(
  "new-plan-max-units",
) as HTMLInputElement | null;
export const planError = document.getElementById(
  "plan-error",
) as HTMLDivElement | null;
export const generatedConfig = document.getElementById(
  "generated-config",
) as HTMLDivElement | null;
export const copyConfigBtn = document.getElementById(
  "copy-config",
) as HTMLButtonElement | null;
export const downloadConfigBtn = document.getElementById(
  "download-config",
) as HTMLButtonElement | null;
export const resetConfigBtn = document.getElementById(
  "reset-config",
) as HTMLButtonElement | null;
export const eventType = document.getElementById(
  "event-type",
) as HTMLSelectElement;
export const accountId = document.getElementById(
  "account-id",
) as HTMLInputElement;
export const pricingVersion = document.getElementById(
  "pricing-version",
) as HTMLSelectElement;
export const planId = document.getElementById("plan-id") as HTMLSelectElement;
export const billingPeriod = document.getElementById(
  "billing-period",
) as HTMLSelectElement;
export const renewalDate = document.getElementById(
  "renewal-date",
) as HTMLInputElement;
export const clientSecret = document.getElementById(
  "client-secret",
) as HTMLInputElement;
export const userId = document.getElementById("user-id") as HTMLInputElement;
export const userName = document.getElementById(
  "user-name",
) as HTMLInputElement;
export const userEmail = document.getElementById(
  "user-email",
) as HTMLInputElement;
export const accountName = document.getElementById(
  "account-name",
) as HTMLInputElement;
export const accountSlug = document.getElementById(
  "account-slug",
) as HTMLInputElement;
export const accountTier = document.getElementById(
  "account-tier",
) as HTMLSelectElement;
export const accountMaxUsers = document.getElementById(
  "account-max-users",
) as HTMLInputElement;
export const reason = document.getElementById("reason") as HTMLInputElement;
export const previewEvent = document.getElementById(
  "preview-event",
) as HTMLDivElement;
export const previewJwt = document.getElementById(
  "preview-jwt",
) as HTMLDivElement;
export const sendWebhookBtn = document.getElementById(
  "send-webhook",
) as HTMLButtonElement;
export const responseMessage = document.getElementById(
  "response-message",
) as HTMLDivElement;
export const history = document.getElementById("history") as HTMLDivElement;
export const exportAccountDataBtn = document.getElementById(
  "export-account-data",
) as HTMLButtonElement | null;
export const importAccountDataBtn = document.getElementById(
  "import-account-data",
) as HTMLButtonElement | null;
export const accountDataUpload = document.getElementById(
  "account-data-upload",
) as HTMLInputElement | null;
