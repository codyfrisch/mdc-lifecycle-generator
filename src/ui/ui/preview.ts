/** biome-ignore-all lint/correctness/useParseIntRadix: parseInt is used for user input where radix is implicit */
import { get } from "svelte/store";
import { generateEvent } from "../../core/event-generator.js";
import { signLifecycleJwt } from "../../core/jwt-signer.js";
import type { SubscriptionPeriodType } from "../../schema/enums.ts";
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
  previewEvent,
  previewJwt,
  pricingVersion,
  reason,
  renewalDate,
  userEmail,
  userId,
  userName,
} from "../dom-elements.js";
import { generateClientId } from "../helpers/client-id.js";
import { accountCollection } from "../stores/account-data-store.js";

/**
 * Update the preview display
 */
export function updatePreview() {
  const config = getConfig();
  if (!config || !accountId.value) {
    previewEvent.textContent =
      "Select event type and fill in details to see preview...";
    previewJwt.style.display = "none";
    return;
  }

  try {
    // Explicitly check for empty datetime-local input (empty string means no date selected)
    const renewalDateValue = renewalDate.value?.trim();
    const renewalDateInput =
      renewalDateValue && renewalDateValue.length > 0 ? renewalDateValue : null;

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

    previewEvent.textContent = JSON.stringify(event, null, 2);

    if (clientSecret.value) {
      const clientId = generateClientId(config.app_id);
      // Get account data from store if available
      const accountFromStore = get(accountCollection).accounts.find(
        (a) => a.account_id === accountId.value,
      );

      signLifecycleJwt(event, clientSecret.value, clientId, {
        is_admin: accountFromStore?.is_admin ?? false,
        is_guest: accountFromStore?.is_guest ?? false,
        is_view_only: accountFromStore?.is_view_only ?? false,
        user_kind: accountFromStore?.user_kind ?? null,
      })
        .then((jwt) => {
          previewJwt.style.display = "block";
          previewJwt.textContent = `JWT: ${jwt}`;
        })
        .catch((error) => {
          previewJwt.style.display = "block";
          previewJwt.textContent = `JWT Error: ${error}`;
        });
    } else {
      previewJwt.style.display = "none";
    }
  } catch (error) {
    previewEvent.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    previewJwt.style.display = "none";
  }
}

/**
 * Setup event listeners for preview updates
 */
export function setupPreviewListeners() {
  [
    eventType,
    accountId,
    pricingVersion,
    planId,
    billingPeriod,
    renewalDate,
    clientSecret,
    userId,
    userName,
    userEmail,
    accountName,
    accountSlug,
    accountTier,
    accountMaxUsers,
    reason,
  ].forEach((el) => {
    el.addEventListener("change", updatePreview);
    el.addEventListener("input", updatePreview);
  });
}
