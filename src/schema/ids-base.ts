import { z } from "zod";

// Monday.com IDs are currently numeric but may become alphanumeric
// Using string validation with digit pattern for future compatibility
// z.coerce.string() handles both number and string inputs
// JavaScript may add + prefix to positive numbers when coerced

// Base schema for positive-only IDs (accounts, boards, items, etc.)
export const positiveIdSchema = z.coerce
  .string()
  .regex(/^\+?\d+$/, "Must be a positive string of digits (can have + prefix)");

export const stringPositiveIdSchema = z.string().regex(/^\d+$/);

// Base schema for IDs that can be negative (users, some special cases)
export const signedIdSchema = z.coerce
  .string()
  .regex(/^[+-]?\d+$/, "Must be a string of digits (can have + or - prefix)");

export const stringSignedIdSchema = z.string().regex(/^[+-]?\d+$/);
// Called a "guid" because it does not conform to UUID standards (no dashes)
export const mondayGuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/i,
  );

// Base schema for alphanumeric IDs with underscores (groups, columns, etc.)
export const alphanumericIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_]+$/, "Must be alphanumeric with underscores only");

export const mondaySlug = z.string().regex(/^[a-z0-9-]+$/);
