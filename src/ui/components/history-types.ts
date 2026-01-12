import type { LifecycleJwt } from "../../schema/jwt.js";
import type { LifecyclePayload } from "../../schema/payload.js";

export type HistoryItem = {
  eventType: string;
  time: string;
  timestamp: number; // Unix timestamp in milliseconds for age calculation
  status: string;
  configName: string;
  event: LifecyclePayload;
  jwtPayload: LifecycleJwt;
  webhookUrl: string;
};
