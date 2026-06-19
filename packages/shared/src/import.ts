import { z } from "zod";

export const ImportTypeSchema = z.enum(["students", "staff"]);
export type ImportType = z.infer<typeof ImportTypeSchema>;

export const ImportRowStatusSchema = z.enum(["insert", "update", "skip", "error"]);
export type ImportRowStatus = z.infer<typeof ImportRowStatusSchema>;

export const ImportPreviewRowSchema = z.object({
  rowNumber: z.number().int(),
  status: ImportRowStatusSchema,
  identifier: z.string(),                          // 'SR 1234' or phone for staff
  summary: z.string(),                             // short human description
  errors: z.array(z.string()).default([]),
  diff: z.record(z.string(), z.object({
    from: z.string().nullable(),
    to: z.string().nullable(),
  })).optional(),
});
export type ImportPreviewRow = z.infer<typeof ImportPreviewRowSchema>;

export const ImportPreviewRequestSchema = z.object({
  type: ImportTypeSchema,
  /** Base64-encoded CSV file content. */
  csvBase64: z.string().min(1),
});
export type ImportPreviewRequest = z.infer<typeof ImportPreviewRequestSchema>;

export const ImportPreviewResponseSchema = z.object({
  type: ImportTypeSchema,
  totalRows: z.number().int(),
  toInsert: z.number().int(),
  toUpdate: z.number().int(),
  toSkip: z.number().int(),
  errors: z.number().int(),
  rows: z.array(ImportPreviewRowSchema),
  /** Opaque token to pass back to the commit endpoint so the server reuses the same parsed rows. */
  token: z.string(),
});
export type ImportPreviewResponse = z.infer<typeof ImportPreviewResponseSchema>;

export const ImportCommitRequestSchema = z.object({
  token: z.string().min(1),
});
export type ImportCommitRequest = z.infer<typeof ImportCommitRequestSchema>;

export const ImportCommitResponseSchema = z.object({
  added: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
  errored: z.number().int(),
});
export type ImportCommitResponse = z.infer<typeof ImportCommitResponseSchema>;
