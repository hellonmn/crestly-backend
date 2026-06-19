import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { useSaveVoucher, useVoucher } from "./hooks";
import { usePickableTeam } from "@/pages/team/hooks";
import { getErrorMessage } from "@/lib/api";
import { VoucherCreateSchema, type VoucherCreateInput } from "@crestly/shared";

/* ------------------------------------------------------------------ */
/* Canonical category list — mirrors erp/lib/vouchers.php :: voucher_categories() */
/* ------------------------------------------------------------------ */

const VOUCHER_CATEGORIES = [
  "Salaries", "Rent", "Electricity", "Water", "Internet",
  "Books", "Stationery", "Lab Equipment", "Sports Equipment",
  "Maintenance", "Cleaning", "Repairs",
  "Transport Fuel", "Vehicle Maintenance",
  "Marketing", "Events", "Travel",
  "Professional Fees", "Legal", "Audit",
  "Software / IT", "Miscellaneous",
];

function money(n: number): string { return `₹${n.toLocaleString("en-IN")}`; }
function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  if (a >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2).replace(/\.?0+$/, "")} L`;
  if (a >= 1_000)       return `₹${(n / 1_000).toFixed(1).replace(/\.?0+$/, "")} K`;
  return money(n);
}
function today(): string { return new Date().toISOString().slice(0, 10); }
function thisMonth(): string {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function VoucherEditPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const voucherId = id ? Number(id) : undefined;
  const isNew = voucherId === undefined;
  const navigate = useNavigate();

  const { data: existing, isLoading } = useVoucher(voucherId);
  const save = useSaveVoucher(voucherId);
  const { data: team } = usePickableTeam();

  // Form state — initialized from query string prefill (add mode) or `existing`.
  const [title, setTitle]               = useState(isNew ? (params.get("title") ?? "") : "");
  const [description, setDescription]   = useState("");
  const [category, setCategory]         = useState(isNew ? (params.get("category") ?? "") : "");
  const [amount, setAmount]             = useState(isNew ? (params.get("amount") ?? "") : "");
  const [vendorName, setVendorName]     = useState("");
  const [vendorContact, setVendorContact] = useState("");
  const [voucherDate, setVoucherDate]   = useState(isNew ? (params.get("voucher_date") ?? today()) : today());
  const [isCreditBill, setIsCreditBill] = useState(false);
  const [salaryUserId, setSalaryUserId] = useState<string>(isNew ? (params.get("salary_user_id") ?? "") : "");
  const [salaryMonth, setSalaryMonth]   = useState(isNew ? (params.get("salary_month") ?? thisMonth()) : "");
  const [notes, setNotes]               = useState("");
  const [approverUserIds, setApproverUserIds] = useState<number[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalErr, setGlobalErr]     = useState<string | null>(null);

  // Mark <body> so the sticky CTA reserves bottom space on mobile.
  useEffect(() => {
    document.body.classList.add("has-sticky-cta");
    return () => { document.body.classList.remove("has-sticky-cta"); };
  }, []);

  // Hydrate state from `existing` once it loads.
  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setDescription(existing.description ?? "");
    setCategory(existing.category ?? "");
    setAmount(String(existing.amount));
    setVendorName(existing.vendorName ?? "");
    setVendorContact(existing.vendorContact ?? "");
    setVoucherDate(existing.voucherDate);
    setIsCreditBill(existing.isCreditBill);
    setSalaryUserId(existing.salaryUserId ? String(existing.salaryUserId) : "");
    setSalaryMonth(existing.salaryMonth ?? "");
    setNotes(existing.notes ?? "");
    setApproverUserIds(existing.approvers.map((a) => a.approverUserId));
  }, [existing]);

  // Eligible approvers — admin / principal / accountant only.
  const approverCandidates = (team?.items ?? []).filter((m) =>
    m.roleSlug === "admin" || m.roleSlug === "principal" || m.roleSlug === "accountant"
  );

  // Salary attribution — only shown when category="Salaries".
  const showSalaryBlock = category === "Salaries";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalErr(null);
    const errs: Record<string, string> = {};

    if (!title.trim())                            errs.title = "Required.";
    if (title.length > 160)                       errs.title = "Max 160 chars.";
    const amt = Number(amount.replace(/[^0-9]/g, ""));
    if (!amt || amt <= 0)                         errs.amount = "Enter amount > 0.";
    if (!voucherDate || !/^\d{4}-\d{2}-\d{2}$/.test(voucherDate)) errs.voucher_date = "Invalid date.";
    if (description.length > 1000)                errs.description = "Max 1000 chars.";
    if (notes.length > 500)                       errs.notes = "Max 500 chars.";
    if (approverUserIds.length === 0)             errs.approvers = "Pick at least one approver.";
    if (showSalaryBlock) {
      if (!salaryUserId)                          errs.salary_user_id = "Pick the staff this salary is for.";
      if (!/^\d{4}-\d{2}$/.test(salaryMonth))     errs.salary_month   = "Pick the salary month (YYYY-MM).";
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      // Scroll the first error into view so the user sees the highlighted field.
      const first = Object.keys(errs)[0];
      if (first) document.getElementById(first)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setFieldErrors({});

    const input: VoucherCreateInput = {
      title: title.trim(),
      description: description.trim() || null,
      category: category || null,
      amount: amt,
      vendorName: vendorName.trim() || null,
      vendorContact: vendorContact.replace(/\D+/g, "") || null,
      salaryUserId: showSalaryBlock ? Number(salaryUserId) : null,
      salaryMonth: showSalaryBlock ? salaryMonth : null,
      voucherDate,
      isCreditBill,
      notes: notes.trim() || null,
      approverUserIds,
    };

    const parsed = VoucherCreateSchema.safeParse(input);
    if (!parsed.success) {
      setGlobalErr(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      return;
    }
    try {
      const saved = await save.mutateAsync(parsed.data);
      // TODO: upload `files[]` via /vouchers/:id/attachments — left for the
      // file-upload pipeline pass since the existing single-file endpoint
      // already works from the detail page.
      navigate(`/vouchers/${saved.id}`, { replace: true });
    } catch (e) {
      setGlobalErr(getErrorMessage(e, "Could not save voucher"));
    }
  }

  if (!isNew && isLoading) {
    return (
      <>
        <PageHead group="FINANCE" meta="VOUCHERS" title="Loading…" />
        <div className="card"><Skeleton.Title width="50%" /></div>
      </>
    );
  }

  return (
    <>
      <style>{EDIT_CSS}</style>

      <PageHead
        group="FINANCE"
        meta={`VOUCHERS · ${isNew ? "NEW" : (existing?.voucherNo ?? "EDIT")}`}
        title={isNew ? "New voucher" : "Edit voucher"}
        lede="Once submitted, listed approvers get a notification. They open the voucher to approve or reject."
        actions={
          <Link
            to={isNew ? "/vouchers" : `/vouchers/${voucherId}`}
            className="btn btn--ghost btn--sm"
          >
            <Icon name="chev-right" size={14} style={{ transform: "rotate(180deg)" }} /> Back
          </Link>
        }
      />

      {globalErr && (
        <div className="banner banner--error">
          <Icon name="alert" size={16} /><span><b>Save failed:</b> {globalErr}</span>
        </div>
      )}
      {Object.keys(fieldErrors).length > 0 && !globalErr && (
        <div className="banner banner--warn">
          <Icon name="alert" size={16} />
          <span>
            <b>Check the highlighted fields</b> — {Object.keys(fieldErrors).length} issue
            {Object.keys(fieldErrors).length > 1 ? "s" : ""}.
          </span>
        </div>
      )}

      <form
        id="vo-form"
        className="card"
        style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24 }}
        onSubmit={onSubmit}
        noValidate
      >
        {/* ===== Section 01 — What's the expense ===== */}
        <Section num="01" title="What's the expense?">
          <div className="form-grid">
            <div className={`field span-2 ${fieldErrors.title ? "field--error" : ""}`}>
              <label className="field__label field__label--req" htmlFor="title">Title</label>
              <input
                id="title"
                className="input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                required
              />
              {fieldErrors.title && <span className="field__error">{fieldErrors.title}</span>}
            </div>

            <div className={`field ${fieldErrors.amount ? "field--error" : ""}`}>
              <label className="field__label field__label--req" htmlFor="amount">Amount (₹)</label>
              <input
                id="amount"
                className="input"
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                required
              />
              {fieldErrors.amount && <span className="field__error">{fieldErrors.amount}</span>}
            </div>

            <div className={`field ${fieldErrors.voucher_date ? "field--error" : ""}`}>
              <label className="field__label field__label--req" htmlFor="voucher_date">Expense date</label>
              <input
                id="voucher_date"
                className="input"
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                max={today()}
              />
              {fieldErrors.voucher_date && <span className="field__error">{fieldErrors.voucher_date}</span>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="category">Category</label>
              <select
                id="category"
                className="select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">— pick —</option>
                {VOUCHER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Salary attribution block — conditional */}
            {showSalaryBlock && (
              <div
                className="field span-2 vo-salary-block"
                style={{
                  background: "var(--cream-soft)",
                  border: "1px dashed var(--rule)",
                  borderRadius: "var(--r-3)",
                  padding: "14px 16px",
                }}
              >
                <div className="label" style={{ marginBottom: 10, color: "var(--orange)" }}>
                  SALARY ATTRIBUTION
                </div>
                <div className="form-grid">
                  <div className={`field ${fieldErrors.salary_user_id ? "field--error" : ""}`}>
                    <label className="field__label field__label--req" htmlFor="salary_user_id">Staff member</label>
                    <select
                      id="salary_user_id"
                      className="select"
                      value={salaryUserId}
                      onChange={(e) => setSalaryUserId(e.target.value)}
                    >
                      <option value="">— pick staff —</option>
                      {(team?.items ?? []).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                          {u.designation && ` · ${u.designation}`}
                          {u.monthlySalary && u.monthlySalary > 0 && ` · ${compact(u.monthlySalary)}/mo`}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.salary_user_id && (
                      <span className="field__error">{fieldErrors.salary_user_id}</span>
                    )}
                  </div>
                  <div className={`field ${fieldErrors.salary_month ? "field--error" : ""}`}>
                    <label className="field__label field__label--req" htmlFor="salary_month">For month</label>
                    <input
                      id="salary_month"
                      className="input"
                      type="month"
                      value={salaryMonth}
                      onChange={(e) => setSalaryMonth(e.target.value)}
                      max={thisMonth()}
                    />
                    {fieldErrors.salary_month && (
                      <span className="field__error">{fieldErrors.salary_month}</span>
                    )}
                  </div>
                  <div className="field span-2">
                    <span className="field__hint">
                      Links this voucher to a specific staff member &amp; month — the Ledger uses it to compute &ldquo;paid vs due salary&rdquo;.
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className={`field span-2 ${fieldErrors.description ? "field--error" : ""}`}>
              <label className="field__label" htmlFor="description">Description (optional)</label>
              <textarea
                id="description"
                className="input input--area"
                rows={2}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {fieldErrors.description && <span className="field__error">{fieldErrors.description}</span>}
            </div>
          </div>
        </Section>

        {/* ===== Section 02 — Vendor & payment plan ===== */}
        <Section num="02" title="Vendor & payment plan">
          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="vendor_name">Vendor / payee</label>
              <input
                id="vendor_name"
                className="input"
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                maxLength={160}
                placeholder="e.g. Asia Stationers"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="vendor_contact">Vendor phone</label>
              <input
                id="vendor_contact"
                className="input"
                type="tel"
                inputMode="numeric"
                value={vendorContact}
                onChange={(e) => setVendorContact(e.target.value)}
                maxLength={20}
                placeholder="9876543210"
              />
            </div>
            <div className="field span-2">
              <label className="check" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={isCreditBill}
                  onChange={(e) => setIsCreditBill(e.target.checked)}
                />
                <span>This is a <b>credit bill</b> — payment will be made later.</span>
              </label>
              <span className="field__hint">
                After approval, the voucher stays as &ldquo;approved · unpaid&rdquo;. Mark paid when payment is actually made.
              </span>
            </div>
          </div>
        </Section>

        {/* ===== Section 03 — Approvers ===== */}
        <Section
          num="03"
          title="Approvers"
          rightHint="All selected must approve · any reject = rejected"
        >
          {approverCandidates.length === 0 ? (
            <div className="banner banner--warn">
              <Icon name="alert" size={16} />
              <span>No users have the <code className="mono">vouchers.approve</code> permission. Ask Admin to grant it.</span>
            </div>
          ) : (
            <>
              <div className={`approver-grid ${fieldErrors.approvers ? "field--error" : ""}`}>
                {approverCandidates.map((u) => {
                  const checked = approverUserIds.includes(u.id);
                  return (
                    <label key={u.id} className="approver-pick">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setApproverUserIds((prev) =>
                            e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id),
                          )
                        }
                      />
                      <span className="approver-pick__body">
                        <span className="approver-pick__name">{u.name}</span>
                        <span className="approver-pick__role">
                          {u.roleName ?? "—"}
                          {u.designation && ` · ${u.designation}`}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {fieldErrors.approvers && (
                <span className="field__error" style={{ marginTop: 8, display: "inline-block" }}>
                  {fieldErrors.approvers}
                </span>
              )}
            </>
          )}
        </Section>

        {/* ===== Section 04 — Supporting documents ===== */}
        <Section
          num="04"
          title="Supporting documents"
          rightHint="PDF, JPG, PNG · max 10 MB each"
        >
          <input
            type="file"
            className="input"
            multiple
            accept="application/pdf,image/*"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {files.map((f, i) => (
                <span key={i} className="chip" style={{ fontSize: 11, padding: "3px 10px" }}>
                  {f.name} · {Math.round(f.size / 1024)} KB
                </span>
              ))}
            </div>
          )}
          {existing && existing.attachments.length > 0 && (
            <>
              <div className="muted body-s" style={{ marginTop: 10 }}>Already attached:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {existing.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={`/uploads/${a.filePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chip"
                    style={{ fontSize: 11, padding: "3px 10px" }}
                  >
                    {a.originalName ?? a.filePath.split("/").pop()}
                  </a>
                ))}
              </div>
            </>
          )}
          <span className="field__hint" style={{ marginTop: 8, display: "inline-block" }}>
            File upload from this form is wired in a follow-up pass; for now use the &ldquo;Attach&rdquo; chip on the voucher detail page after saving.
          </span>
        </Section>

        {/* ===== Section 05 — Internal notes ===== */}
        <Section num="05" title="Internal notes (optional)">
          <textarea
            id="notes"
            className={`input input--area ${fieldErrors.notes ? "field--error" : ""}`}
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the approver should know"
          />
          {fieldErrors.notes && <span className="field__error">{fieldErrors.notes}</span>}
        </Section>

        {/* Desktop action row */}
        <div className="m-hide" style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: "1px solid var(--rule-soft)", alignItems: "center" }}>
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : isNew ? "Submit for approval" : "Save changes"}
          </button>
          <Link
            to={isNew ? "/vouchers" : `/vouchers/${voucherId}`}
            className="btn btn--ghost"
          >Cancel</Link>
        </div>
      </form>

      {/* Mobile sticky CTA */}
      <div className="m-sticky-cta m-show">
        <Link
          to={isNew ? "/vouchers" : `/vouchers/${voucherId}`}
          className="btn btn--ghost"
        >Cancel</Link>
        <button type="submit" form="vo-form" className="btn btn--primary" disabled={save.isPending}>
          {save.isPending ? "Saving…" : isNew ? "Submit" : "Save"}
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Section helper                                                      */
/* ------------------------------------------------------------------ */

function Section({
  num, title, rightHint, children,
}: {
  num: string; title: string; rightHint?: string; children: React.ReactNode;
}) {
  return (
    <div className="form-section">
      <div
        className="form-section__head"
        style={{
          display: "flex", alignItems: "baseline", gap: 10,
          paddingBottom: 10,
          borderBottom: "1px solid var(--rule-soft)",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <span
          className="form-section__num"
          style={{
            background: "var(--ink)", color: "var(--cream)",
            width: 24, height: 24, borderRadius: 6,
            display: "inline-grid", placeItems: "center",
            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
          }}
        >{num}</span>
        <h3
          className="form-section__title"
          style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, flex: 1 }}
        >{title}</h3>
        {rightHint && <span className="muted body-s">{rightHint}</span>}
      </div>
      {children}
    </div>
  );
}

const EDIT_CSS = `
  .approver-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }
  .approver-pick {
    display: grid; grid-template-columns: 22px 1fr; gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--rule); border-radius: var(--r-3);
    background: var(--white); cursor: pointer;
    transition: background var(--t-fast), border-color var(--t-fast);
  }
  .approver-pick:hover { background: var(--cream-soft); }
  .approver-pick input { width: 18px; height: 18px; accent-color: var(--orange); }
  .approver-pick:has(input:checked) {
    background: var(--orange-tint); border-color: var(--orange);
  }
  .approver-pick__name { font-weight: 600; font-size: 13px; display: block; }
  .approver-pick__role { font-size: 11px; color: var(--ink-60); display: block; margin-top: 2px; }
  .approver-grid.field--error .approver-pick { border-color: var(--error); }

  .field--error .input,
  .field--error .select { border-color: var(--error); }
  .field__error {
    color: var(--error); font-size: 11.5px; margin-top: 4px; display: inline-block;
  }
  .field__hint {
    color: var(--ink-60); font-size: 11.5px; line-height: 1.4;
  }
  .field__label--req::after {
    content: ' *'; color: var(--error); font-weight: 700;
  }
`;
