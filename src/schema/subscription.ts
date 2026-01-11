import { z } from "zod";
import { subscriptionPeriodType } from "./enums.js";

export const subscriptionSchema = z.object({
  billing_period: subscriptionPeriodType.nullable(), //null if no subscription.
  days_left: z.number().nullish(), //not truly optional but irrelevant
  is_trial: z.boolean(),
  max_units: z.number().nullable().catch(null), //null for integration apps.
  plan_id: z.string(),
  pricing_version: z.number().catch(1), //default because at one time monday did not send pricing_version on free plans
  renewal_date: z.iso.datetime({ offset: true }).nullable(), // default first of next month UTC
});

export type Subscription = z.infer<typeof subscriptionSchema>;
