import * as jose from "jose";
import type { LifecycleJwtDat } from "../../schema/jwt.js";
import type { LifecyclePayload } from "../../schema/payload.js";

/**
 * Sign a JWT for lifecycle webhook (browser-compatible)
 */
export async function signLifecycleJwt(
  payload: LifecyclePayload,
  clientSecret: string,
  clientId: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Build JWT dat payload
  const jwtDat: LifecycleJwtDat = {
    account_id: payload.data.account_id,
    app_id: payload.data.app_id,
    app_version_id: null,
    client_id: clientId,
    install_id: null,
    is_admin: true,
    is_guest: false,
    is_view_only: false,
    slug: payload.data.account_slug,
    user_id: payload.data.user_id,
    user_kind: null,
    subscription: payload.data.subscription?.renewal_date
      ? {
          plan_id: payload.data.subscription.plan_id,
          renewal_date: payload.data.subscription.renewal_date,
          is_trial: payload.data.subscription.is_trial,
          billing_period: payload.data.subscription.billing_period || undefined,
          days_left: payload.data.subscription.days_left || undefined,
          pricing_version: payload.data.subscription.pricing_version,
          max_units: payload.data.subscription.max_units ?? null,
        }
      : undefined,
  };

  // Build JWT payload
  const jwtPayload = {
    iat: now,
    exp: now + 3600, // 1 hour expiration
    dat: jwtDat,
  };

  // Sign JWT
  const secret = new TextEncoder().encode(clientSecret);
  const jwt = await new jose.SignJWT(jwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(secret);

  return jwt;
}
