/** biome-ignore-all lint/correctness/useParseIntRadix: not applicable */
import { get } from "svelte/store";
import { getAppConfig } from "../../core/config-loader.js";
import { generateEvent } from "../../core/event-generator.js";
import { sendWebhook } from "../../core/http-sender.js";
import { signLifecycleJwt } from "../../core/jwt-signer.js";
import type { SubscriptionPeriodType } from "../../schema/enums.ts";
import { lifecyclePayload } from "../../schema/payload.js";
import type { EventGenerationInput } from "../../types.js";
import { getConfig } from "../config-state.js";
import {
  accountId,
  accountMaxUsers,
  accountName,
  accountSlug,
  accountTier,
  billingPeriod,
  clientSecret,
  eventType,
  planId,
  pricingVersion,
  reason,
  renewalDate,
  sendWebhookBtn,
  userEmail,
  userId,
  userName,
} from "../dom-elements.js";
import { generateClientId } from "../helpers/client-id.js";
import { addToHistory, showMessage } from "../helpers/messages.js";
import { accountCollection } from "../stores/account-data-store.js";
import { resetAutoLockTimer } from "../stores/secrets-store.js";
import { updatePreview } from "../ui/preview.js";

/**
 * Send webhook handler
 */
export async function handleSendWebhook() {
  const config = getConfig();
  if (!config) {
    showMessage("Please load config first", "error");
    return;
  }

  if (!config.webhook_url) {
    showMessage("Webhook URL not found in config", "error");
    return;
  }

  if (!clientSecret.value) {
    showMessage("Please enter client secret", "error");
    return;
  }

  try {
    // Log the raw value from the datetime-local input for debugging
    console.log("Renewal Date Input - Raw value:", renewalDate.value);
    console.log("Renewal Date Input - Type:", typeof renewalDate.value);
    console.log(
      "Renewal Date Input - Length:",
      renewalDate.value?.length ?? "null/undefined",
    );

    // Explicitly check for empty datetime-local input (empty string means no date selected)
    const renewalDateValue = renewalDate.value?.trim();
    const renewalDateInput =
      renewalDateValue && renewalDateValue.length > 0 ? renewalDateValue : null;

    console.log("Renewal Date Input - After processing:", renewalDateInput);

    // Try to get account data from store if account_id matches
    const accountFromStore = get(accountCollection).accounts.find(
      (a) => a.account_id === accountId.value,
    );

    const input: EventGenerationInput = {
      event_type: eventType.value,
      app_id: config.app_id,
      account_id: accountId.value,
      plan_id: planId.value || undefined,
      pricing_version: pricingVersion.value
        ? parseInt(pricingVersion.value)
        : undefined,
      billing_period: (billingPeriod.value?.trim() || undefined) as
        | SubscriptionPeriodType
        | undefined,
      renewal_date: renewalDateInput,
      user_id: userId.value || accountFromStore?.user_id || undefined,
      user_name: userName.value || accountFromStore?.user_name || undefined,
      user_email: userEmail.value || accountFromStore?.user_email || undefined,
      user_country: accountFromStore?.user_country || undefined,
      user_cluster: accountFromStore?.user_cluster || undefined,
      account_name:
        accountName.value || accountFromStore?.account_name || undefined,
      account_slug:
        accountSlug.value || accountFromStore?.account_slug || undefined,
      account_tier:
        accountTier.value === ""
          ? null
          : accountTier.value || accountFromStore?.account_tier || null,
      account_max_users: accountMaxUsers.value
        ? parseInt(accountMaxUsers.value)
        : accountFromStore?.account_max_users || undefined,
      reason: reason.value || undefined,
    };

    const event = generateEvent(input, config);

    // Validate lifecycle payload before sending
    const payloadValidation = lifecyclePayload.safeParse(event);
    if (!payloadValidation.success) {
      const errorDetails = payloadValidation.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      console.error(
        "Lifecycle payload validation failed:",
        payloadValidation.error,
      );
      showMessage(`Invalid payload data: ${errorDetails}`, "error");
      return;
    }

    const appConfig = getAppConfig(config, config.app_id);

    if (!appConfig) {
      showMessage("App not found in config", "error");
      return;
    }

    // Generate client_id from app_id (MD5 hash format)
    // In production, this would come from app config
    const clientId = generateClientId(config.app_id);

    const jwt = await signLifecycleJwt(event, clientSecret.value, clientId, {
      is_admin: accountFromStore?.is_admin ?? false,
      is_guest: accountFromStore?.is_guest ?? false,
      is_view_only: accountFromStore?.is_view_only ?? false,
      user_kind: accountFromStore?.user_kind ?? null,
    });

    const result = await sendWebhook(config.webhook_url, event, jwt);

    if (result.success) {
      showMessage(
        `Webhook sent successfully! Status: ${result.status}`,
        "success",
      );

      // Add to history
      addToHistory(event.type, result);
      updatePreview();

      // Reset auto-lock timer on successful webhook send
      resetAutoLockTimer();
    } else {
      showMessage(
        `Webhook failed! Status: ${result.status}, Error: ${result.error || result.body}`,
        "error",
      );
    }
  } catch (error) {
    showMessage(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
  }
}

/**
 * Setup event listener for send webhook button
 */
export function setupSendWebhookListener() {
  sendWebhookBtn.addEventListener("click", handleSendWebhook);
}
