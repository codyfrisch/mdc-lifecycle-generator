import type {
  LifecycleEventType,
  LifecyclePayload,
} from "../schema/payload.js";
import type { ConfigData, EventGenerationInput } from "../types.js";
import { getAppConfig, getPlanConfig } from "./config-loader.js";

/**
 * Generate a lifecycle event payload
 */
export function generateEvent(
  input: EventGenerationInput,
  config: ConfigData,
): LifecyclePayload {
  const appConfig = getAppConfig(config, input.app_id);
  if (!appConfig) {
    throw new Error(`App ${input.app_id} not found in config`);
  }

  const planConfig = input.plan_id
    ? getPlanConfig(
        config,
        input.app_id,
        input.plan_id,
        input.pricing_version || 1,
      )
    : null;

  const now = new Date();
  const timestamp = now.toISOString();

  // Generate version data
  const versionData = {
    major: 1,
    minor: 1,
    patch: 0,
    type: "minor" as const,
  };

  // Use renewal_date from input (can be null, undefined, or empty string)
  // Convert datetime-local format (YYYY-MM-DDTHH:mm) to ISO string if provided
  // Return null if empty, undefined, or invalid date
  let renewalDate: string | null = null;
  // Explicitly check that renewal_date exists and is not empty
  if (input.renewal_date && typeof input.renewal_date === "string") {
    const trimmed = input.renewal_date.trim();
    // Only process if we have a non-empty string
    if (trimmed.length > 0) {
      const date = new Date(trimmed);
      // Check if date is valid (Invalid Date has NaN for getTime())
      if (!Number.isNaN(date.getTime())) {
        renewalDate = date.toISOString();
      }
    }
  }

  // Calculate days_left based on renewal_date if provided
  // If renewal_date is null, days_left is 0
  const daysLeft = renewalDate
    ? Math.ceil(
        (new Date(renewalDate).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  // Build subscription data
  const subscription = planConfig
    ? {
        plan_id: planConfig.plan_id,
        renewal_date: renewalDate,
        is_trial: planConfig.isTrial,
        billing_period: (input.billing_period || "monthly") as
          | "monthly"
          | "yearly"
          | null,
        days_left: daysLeft ?? null,
        pricing_version: input.pricing_version || 1,
        max_units: planConfig.max_units ?? null,
      }
    : undefined;

  // Build event data
  const eventData = {
    app_id: input.app_id,
    app_name: appConfig.app_name,
    user_id: input.user_id || "1",
    user_email: input.user_email || "user@example.com",
    user_name: input.user_name || "Test User",
    user_cluster: "other",
    account_tier: (input.account_tier || "free") as
      | "free"
      | "pro"
      | "enterprise"
      | "standard"
      | null,
    account_max_users: input.account_max_users ?? null,
    account_id: input.account_id,
    account_name: input.account_name || "Test Account",
    account_slug: input.account_slug || "test",
    version_data: versionData,
    timestamp,
    subscription,
    user_country: "US",
    reason: input.reason ?? undefined,
  };

  const payload: LifecyclePayload = {
    type: input.event_type as LifecycleEventType,
    data: eventData,
  };

  // Return payload directly without Zod schema validation
  // (Schema has transform that converts null renewal_date to current date)
  return payload;
}
