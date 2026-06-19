import { z } from "zod";

export const WaSettingsSchema = z.object({
  enabled: z.boolean(),
  accessToken: z.string().nullable(),         // masked when returned
  phoneNumberId: z.string().nullable(),
  wabaId: z.string().nullable(),
  apiVersion: z.string().default("v22.0"),
  displayNumber: z.string().nullable(),
  defaultCountry: z.string().default("91"),
});
export type WaSettings = z.infer<typeof WaSettingsSchema>;

export const WaSettingsUpdateSchema = WaSettingsSchema.partial();
export type WaSettingsUpdate = z.infer<typeof WaSettingsUpdateSchema>;

export const WaTemplateSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  language: z.string(),
  category: z.string().nullable(),
  status: z.string().nullable(),
  bodyText: z.string().nullable(),
  headerText: z.string().nullable(),
  footerText: z.string().nullable(),
  variableCount: z.number().int(),
  metaId: z.string().nullable(),
  fetchedAt: z.string().nullable(),
});
export type WaTemplate = z.infer<typeof WaTemplateSchema>;

export const WaActionBindingSchema = z.object({
  actionKey: z.string(),
  templateName: z.string(),
  templateLang: z.string(),
  recipientField: z.string().nullable(),
  variableMap: z.record(z.string(), z.unknown()),
  isEnabled: z.boolean(),
});
export type WaActionBinding = z.infer<typeof WaActionBindingSchema>;

export const WaBindingUpsertSchema = z.object({
  actionKey: z.string().min(1).max(80),
  templateName: z.string().min(1).max(120),
  templateLang: z.string().default("en"),
  recipientField: z.string().nullable().optional(),
  variableMap: z.record(z.string(), z.unknown()).default({}),
  isEnabled: z.boolean().default(true),
});
export type WaBindingUpsertInput = z.infer<typeof WaBindingUpsertSchema>;

export const WaTestInputSchema = z.object({
  toPhone: z.string().min(10).max(20),
});
export type WaTestInput = z.infer<typeof WaTestInputSchema>;

export const WaLogEntrySchema = z.object({
  id: z.number().int(),
  actionKey: z.string().nullable(),
  templateName: z.string().nullable(),
  toPhone: z.string(),
  status: z.enum(["queued", "sent", "failed"]),
  metaMessageId: z.string().nullable(),
  errorMessage: z.string().nullable(),
  variables: z.record(z.string(), z.unknown()),
  context: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});
export type WaLogEntry = z.infer<typeof WaLogEntrySchema>;

/** Settings-page stat tiles. */
export const WaStatsSchema = z.object({
  enabled: z.boolean(),
  phoneNumberIdSet: z.boolean(),
  templatesCount: z.number().int().nonnegative(),
  templatesApproved: z.number().int().nonnegative(),
  bindingsActive: z.number().int().nonnegative(),
  sent24h: z.number().int().nonnegative(),
  failed24h: z.number().int().nonnegative(),
});
export type WaStats = z.infer<typeof WaStatsSchema>;

/** Action keys that the app can dispatch. Mirrors the PHP catalog. */
export const WA_ACTIONS = [
  "fee.payment.received",
  "fee.reminder",
  "voucher.pending_approval",
  "voucher.paid",
  "student.absent",
  "salary.paid",
] as const;
export type WaActionKey = (typeof WA_ACTIONS)[number];

/**
 * Action catalog — drives the Templates & Bindings UI. Each action
 * lists its dispatch-context fields (for the dynamic variable map)
 * and the recipient-phone fields available on that event. Keep in
 * sync with erp/lib/whatsapp.php :: wa_action_catalogue().
 */
export interface WaActionDef {
  label: string;
  description: string;
  /** Field → human label, for the dynamic variable-mapping dropdown. */
  fields: Record<string, string>;
  /** Field → human label, for the "Recipient field" dropdown. */
  recipientOptions: Record<string, string>;
}

export const WA_ACTION_CATALOG: Record<WaActionKey, WaActionDef> = {
  "fee.payment.received": {
    label: "Fee payment received (receipt)",
    description: "Sent to the parent every time a payment is recorded in fee ledger.",
    fields: {
      student_name:  "Student's full name",
      class:         "Class (e.g. 6th)",
      section:       "Section (A/B/C)",
      amount:        "Amount paid (₹)",
      paid_on:       "Payment date",
      method:        "Payment method (cash/upi/…)",
      receipt_no:    "Receipt number",
      remaining_due: "Balance after this payment",
      school_name:   "School name (from settings)",
    },
    recipientOptions: {
      father_whatsapp:        "Father · WhatsApp",
      mother_whatsapp:        "Mother · WhatsApp",
      father_contact:         "Father · contact",
      mother_contact:         "Mother · contact",
      local_guardian_contact: "Local guardian",
    },
  },
  "fee.reminder": {
    label: "Fee reminder (balance due)",
    description: "Manual nudge from student profile / fee ledger when balance is outstanding.",
    fields: {
      student_name: "Student's full name",
      class:        "Class (e.g. 6th)",
      section:      "Section",
      due_amount:   "Outstanding balance (₹)",
      session_code: "Academic session (e.g. 2025-26)",
      school_name:  "School name",
    },
    recipientOptions: {
      father_whatsapp:        "Father · WhatsApp",
      mother_whatsapp:        "Mother · WhatsApp",
      father_contact:         "Father · contact",
      mother_contact:         "Mother · contact",
      local_guardian_contact: "Local guardian",
    },
  },
  "voucher.pending_approval": {
    label: "Voucher pending your approval",
    description: "Sent to each approver when a new voucher is raised.",
    fields: {
      voucher_no:  "Voucher number",
      title:       "Voucher title",
      amount:      "Amount (₹)",
      created_by:  "Raised by",
      school_name: "School name",
    },
    recipientOptions: {
      approver_phone: "Approver · phone",
    },
  },
  "voucher.paid": {
    label: "Voucher marked paid",
    description: "Sent to voucher creator + approvers after payment.",
    fields: {
      voucher_no:  "Voucher number",
      title:       "Voucher title",
      amount:      "Amount (₹)",
      paid_on:     "Paid date",
      method:      "Payment method",
      school_name: "School name",
    },
    recipientOptions: {
      recipient_phone: "Recipient · phone",
    },
  },
  "student.absent": {
    label: "Student marked absent",
    description: "Sent to parents on absent days.",
    fields: {
      student_name: "Student name",
      class:        "Class",
      section:      "Section",
      date:         "Date",
      school_name:  "School name",
    },
    recipientOptions: {
      father_whatsapp: "Father · WhatsApp",
      mother_whatsapp: "Mother · WhatsApp",
      father_contact:  "Father · contact",
      mother_contact:  "Mother · contact",
    },
  },
  "salary.paid": {
    label: "Salary credited",
    description: "Sent to staff when monthly salary is paid out.",
    fields: {
      staff_name:  "Staff name",
      amount:      "Net amount (₹)",
      month:       "Month (e.g. May 2026)",
      school_name: "School name",
    },
    recipientOptions: {
      staff_phone: "Staff · phone",
    },
  },
};
