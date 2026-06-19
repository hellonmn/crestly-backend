import { z } from "zod";

/* ============================================================
   Global spotlight-search payload — used by Cmd+K from anywhere
   in the app. The API endpoint fans out across the major
   entities (students / team / families / vouchers / receipts /
   admissions / pickup-points) and returns the top N matches per
   category, plus a single combined `total` so the UI can show
   "showing 24 of 81".
   ============================================================ */

export const SearchHitKindSchema = z.enum([
  "student",
  "team",
  "family",
  "voucher",
  "receipt",
  "admission",
  "pickup",
  "page",
]);
export type SearchHitKind = z.infer<typeof SearchHitKindSchema>;

export const SearchHitSchema = z.object({
  kind: SearchHitKindSchema,
  /** Type-prefixed unique key for React keys ("student-1234"). */
  key: z.string(),
  /** Primary label — what the user typed or recognises. */
  title: z.string(),
  /** Secondary line — class/section, designation, amount, status etc. */
  subtitle: z.string().nullable(),
  /** Internal route to navigate to on Enter/click. */
  href: z.string(),
  /** Optional chip text — "10-A", "₹2.5L", "PENDING", etc. */
  meta: z.string().nullable().optional(),
});
export type SearchHit = z.infer<typeof SearchHitSchema>;

export const SearchGroupSchema = z.object({
  kind: SearchHitKindSchema,
  label: z.string(),               // "Students", "Team", …
  /** When non-null, the UI shows a "View all in X" footer link. */
  viewAllHref: z.string().nullable(),
  hits: z.array(SearchHitSchema),
});
export type SearchGroup = z.infer<typeof SearchGroupSchema>;

export const SearchResponseSchema = z.object({
  q: z.string(),
  total: z.number().int().nonnegative(),
  groups: z.array(SearchGroupSchema),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(80),
  /** Max hits PER GROUP. */
  limit: z.coerce.number().int().min(1).max(20).default(6),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
