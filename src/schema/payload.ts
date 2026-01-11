import { z } from "zod/v4";
import { accountTier } from "./enums.js";
import { accountId, appId, mondaySlug, userId } from "./ids.js";
import { subscriptionSchema } from "./subscription.js";

const LIFECYCLE_EVENT_TYPE = [
  "install",
  "uninstall",
  "app_subscription_created",
  "app_subscription_changed",
  "app_subscription_cancelled_by_user",
  "app_subscription_renewed",
  "app_trial_subscription_started",
  "app_trial_subscription_ended",
  "app_subscription_cancelled",
  "app_subscription_cancellation_revoked_by_user",
  "app_subscription_renewal_attempt_failed",
  "app_subscription_renewal_failed",
] as const;

export const lifecycleEventType = z.enum(LIFECYCLE_EVENT_TYPE);

export const lifecycleData = z.object({
  account_id: accountId,
  account_max_users: z.int().nullable().default(null),
  account_name: z.string(),
  account_slug: mondaySlug,
  account_tier: accountTier.nullable(),
  app_id: appId,
  reason: z.string().nullish(),
  subscription: subscriptionSchema.optional(),
  timestamp: z.iso.datetime({ offset: true }),
  user_cluster: z.string().nullable().default(null), //TODO define enum but not string?
  user_country: z.string().nullable().default(null),
  user_email: z.email(),
  user_id: userId,
  user_name: z.string(),
  version_data: z.object({
    major: z.number().int().nonnegative(),
    minor: z.number().int().nonnegative(),
    patch: z.number().int().nonnegative(),
    type: z.enum(["major", "minor"]),
  }),
});

export const lifecyclePayload = z.object({
  data: lifecycleData,
  type: lifecycleEventType,
});

/**
 * @description
 * A preprocessed version of the lifecycle payload schema that automatically converts
 * incoming data from JSON string to an object and normalizes it to camelCase.
 * This is used for internal processing.
 */

export type LifecyclePayload = z.infer<typeof lifecyclePayload>;
export type LifecycleData = z.infer<typeof lifecycleData>;
export type LifecycleEventType = z.infer<typeof lifecycleEventType>;
