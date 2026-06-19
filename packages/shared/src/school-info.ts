import { z } from "zod";

/**
 * The `school_info` table is a single KV store. We surface it as a typed
 * record on the API so the settings UI can edit known keys with proper
 * validation, while still allowing unknown keys to round-trip.
 *
 * Known keys map to the same names PHP uses in settings/index.php so the
 * existing data is read without any rewrite.
 */

/**
 * Key names exactly match `erp/settings/index.php`'s `$KEYS` array — the
 * existing PHP-written rows in `school_info` are read/written under these
 * names by every service (marksheet, receipt, staff-attendance, geofence,
 * punch cooldown). Do not invent new key names without a backfill migration.
 */
export const SCHOOL_INFO_KEYS = [
  // General
  "School Name",
  "Address",
  "Board",
  "Time Zone",
  // Geofence
  "Latitude",
  "Longitude",
  "Google Maps Link",
  "Geofence Radius School M",
  "Geofence Radius Driver M",
  // Punch policy
  "Punch Out Cooldown Min",
] as const;

export type SchoolInfoKey = (typeof SCHOOL_INFO_KEYS)[number];

export const SchoolInfoSchema = z.object({
  values: z.record(z.string(), z.string().nullable()),
});
export type SchoolInfo = z.infer<typeof SchoolInfoSchema>;

export const SchoolInfoUpdateSchema = z.object({
  patch: z.record(z.string().min(1).max(64), z.string().nullable()),
});
export type SchoolInfoUpdate = z.infer<typeof SchoolInfoUpdateSchema>;
