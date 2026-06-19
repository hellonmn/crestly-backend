/* ============================================================
   wa.me deep-link helpers.

   Opens WhatsApp (web on desktop, app on mobile) with a phone
   number + prefilled message. Pure client-side — no API call,
   no template configuration needed. Great for ad-hoc:
     - "Share this receipt with the parent"
     - "Send this marksheet"
     - "Send a custom fee reminder"

   For automated dispatches (bulk reminders, payment confirma-
   tions) keep using the existing WhatsApp Cloud API path —
   this is for the human-initiated share moments.
   ============================================================ */

/** Normalise an Indian-style phone to wa.me format (digits only, +91 default). */
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Already includes country code (e.g. 919876543210).
  if (digits.length >= 11 && digits.length <= 15) return digits;
  // Local 10-digit India number — prefix +91.
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export interface WhatsappShareInput {
  /** Recipient phone (any format — we strip non-digits). Optional —
   *  if omitted, opens the WhatsApp chooser so the user can pick a contact. */
  phone?: string | null;
  /** Message body. URL-encoded automatically. */
  message: string;
}

/** Open WhatsApp with a prefilled message. Returns the URL so the caller
 *  can also offer a copy-link UI if they want. */
export function openWhatsappShare({ phone, message }: WhatsappShareInput): string {
  const text = encodeURIComponent(message.trim());
  const cleaned = normalisePhone(phone);
  const url = cleaned
    ? `https://wa.me/${cleaned}?text=${text}`
    : `https://wa.me/?text=${text}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return url;
}

/* ─────────────────── Message templates ─────────────────── */

/** Format an Indian Rupee amount with thousands separators. */
function rs(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Receipt confirmation message. */
export function receiptMessage(p: {
  studentName: string;
  className: string;
  receiptNo: string;
  amountRs: number;
  paidOn: string;          // 'YYYY-MM-DD'
  method?: string | null;
  pendingRs?: number | null;
}): string {
  const date = formatDate(p.paidOn);
  return [
    `🧾 Fee receipt for ${p.studentName} (${p.className})`,
    ``,
    `Receipt: ${p.receiptNo}`,
    `Amount: ${rs(p.amountRs)}${p.method ? `  · ${p.method}` : ""}`,
    `Paid on: ${date}`,
    p.pendingRs != null && p.pendingRs > 0
      ? `\nPending balance: ${rs(p.pendingRs)}`
      : `\nFully cleared. Thank you!`,
  ].join("\n");
}

/** Fee reminder message. */
export function feeReminderMessage(p: {
  studentName: string;
  className: string;
  pendingRs: number;
  dueLabel?: string;       // "due by 30 May", optional
}): string {
  return [
    `Dear Parent,`,
    ``,
    `Fee payment for ${p.studentName} (${p.className}) is pending: ${rs(p.pendingRs)}.`,
    p.dueLabel ? `\nDue: ${p.dueLabel}` : "",
    ``,
    `Kindly clear at the school office or via the link shared earlier.`,
    `— School Office`,
  ].filter(Boolean).join("\n");
}

/** Marksheet share message. */
export function marksheetMessage(p: {
  studentName: string;
  termName: string;
  totalObtained: number;
  totalMax: number;
  percentage: number;
}): string {
  return [
    `📊 ${p.termName} marksheet for ${p.studentName}`,
    ``,
    `Total: ${p.totalObtained} / ${p.totalMax}  (${p.percentage}%)`,
    ``,
    `The full marksheet has been shared by the school.`,
  ].join("\n");
}

/** Student profile snapshot (handy when forwarding to a colleague). */
export function studentSummaryMessage(p: {
  studentName: string;
  srNumber: number;
  className: string;
  fatherName?: string | null;
  phone?: string | null;
}): string {
  const lines = [
    `📋 ${p.studentName}`,
    `SR #${p.srNumber} · ${p.className}`,
  ];
  if (p.fatherName) lines.push(`Father: ${p.fatherName}`);
  if (p.phone)      lines.push(`Phone:  ${p.phone}`);
  return lines.join("\n");
}

function formatDate(iso: string): string {
  // 'YYYY-MM-DD' → '24 May 2026'. Falls back to raw string on parse error.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
