/**
 * Configuration types for plan and app data
 */

export type PlanConfig = {
  plan_id: string;
  isFree: boolean;
  isTrial: boolean;
  plan_index: number; // Order for upgrade/downgrade comparison
  max_units?: number | null;
};

export type PricingVersionData = {
  plans: Record<string, PlanConfig>;
  freePlan?: string | null;
  trialPlan?: string | null;
};

export type PricingVersionDataMap = Record<string, PricingVersionData>;

export type AppConfig = {
  app_id: string;
  app_name: string;
  webhook_url: string;
  pricing_version: PricingVersionDataMap; // Pricing versions are scoped to the app
};

export type ConfigData = AppConfig;

/**
 * Subscription type and billing period types
 */
export type SubscriptionType = "paid" | "trial" | "free";

import type { SubscriptionPeriodType } from "./schema/enums.ts";

/**
 * Event generation input types
 */

export type EventGenerationInput = {
  event_type: string;
  app_id: string;
  account_id: string;
  plan_id?: string;
  pricing_version?: number;
  billing_period?: SubscriptionPeriodType;
  renewal_date?: string | null; // ISO datetime string or null
  user_id?: string;
  user_name?: string;
  user_email?: string;
  account_name?: string;
  account_slug?: string;
  account_tier?: string | null;
  account_max_users?: number | null;
  reason?: string | null;
};
