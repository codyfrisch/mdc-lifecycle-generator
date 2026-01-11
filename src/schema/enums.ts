import { z } from "zod";
import { SubscriptionPeriodType as MondaySubscriptionPeriodType } from "./monday-schema.js";

export const accountTier = z.enum(["free", "pro", "enterprise", "standard"]);

export type AccountTier = z.infer<typeof accountTier>;

export const subscriptionPeriodType = z
  .enum(MondaySubscriptionPeriodType)
  .nullish();

export type SubscriptionPeriodType = z.infer<typeof subscriptionPeriodType>;
