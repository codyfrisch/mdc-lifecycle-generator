import { z } from "zod";
import { accountId, appId, mondaySlug, userId } from "./ids.js";
import { jwtPayloadSchema } from "./jwt-base.js";
import { subscriptionSchema } from "./subscription.js";
export const lifecycleJwtDat = z.object({
  account_id: accountId,
  app_id: appId,
  app_version_id: appId.nullable(),
  client_id: z
    .string()
    .regex(/^[a-f0-9]{32}$/, { message: "client_id must be an MD5 string" }),
  install_id: appId.nullable(),
  is_admin: z.boolean(),
  is_guest: z.boolean(),
  is_view_only: z.boolean(),
  slug: mondaySlug,
  subscription: subscriptionSchema.optional(),
  user_id: userId,
  user_kind: z.string().nullable().default(null),
});

export const lifecycleJwt = z.object({
  ...jwtPayloadSchema.shape,
  dat: lifecycleJwtDat,
});

export type LifecycleJwt = z.infer<typeof lifecycleJwt>;
export type LifecycleJwtDat = z.infer<typeof lifecycleJwtDat>;
