/** biome-ignore-all lint/correctness/useParseIntRadix: parseInt is used for user input where radix is implicit */
import { generateEvent } from "../../core/event-generator.js";
import type { SubscriptionPeriodType } from "../../schema/enums.ts";
import type { EventGenerationInput } from "../../types.js";
import { signLifecycleJwt } from "../browser/jwt-signer.js";
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
      user_id: userId.value || undefined,
      user_name: userName.value || undefined,
      user_email: userEmail.value || undefined,
      account_name: accountName.value || undefined,
      account_slug: accountSlug.value || undefined,
      account_tier: accountTier.value === "" ? null : accountTier.value || null,
      account_max_users: accountMaxUsers.value
        ? parseInt(accountMaxUsers.value)
        : undefined,
      reason: reason.value || undefined,
    };

    const event = generateEvent(input, config);

    previewEvent.textContent = JSON.stringify(event, null, 2);

    if (clientSecret.value) {
      const clientId = generateClientId(config.app_id);
      signLifecycleJwt(event, clientSecret.value, clientId)
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
