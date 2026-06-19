import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { useForm } from "react-hook-form";
import { PageHead } from "@/components/PageHead";
import { useEnquiry, useSaveEnquiry } from "./hooks";
import { useClasses } from "@/pages/classes/hooks";
import { usePickableTeam } from "@/pages/team/hooks";
import { getErrorMessage } from "@/lib/api";
import { EnquiryUpsertSchema, type EnquiryUpsertInput } from "@crestly/shared";

/* ============================================================
   Admissions create / edit form — ports the shared add/edit
   field block (adm_form_fields()) from erp/admissions/index.php.
   Two numbered sections + bottom action row.
   ============================================================ */

const blank: EnquiryUpsertInput = {
  childName: "",
  parentName: null,
  phone: "",
  email: null,
  classSeeking: null,
  source: "walk_in",
  sourceDetail: null,
  status: "new",
  followUpDate: null,
  assignedTo: null,
  city: null,
  notes: null,
};

export function EnquiryEditPage() {
  const { id } = useParams<{ id: string }>();
  const enquiryId = id ? Number(id) : undefined;
  const isNew = enquiryId === undefined;
  const navigate = useNavigate();

  const { data: existing, isLoading } = useEnquiry(enquiryId);
  const { data: classes } = useClasses();
  const { data: team }    = usePickableTeam();
  const save = useSaveEnquiry(enquiryId);

  const form = useForm<EnquiryUpsertInput>({ defaultValues: blank });

  useEffect(() => {
    if (existing) {
      form.reset({
        childName: existing.childName,
        parentName: existing.parentName,
        phone: existing.phone,
        email: existing.email,
        classSeeking: existing.classSeeking,
        source: existing.source,
        sourceDetail: existing.sourceDetail,
        status: existing.status,
        followUpDate: existing.followUpDate,
        assignedTo: existing.assignedTo,
        city: existing.city,
        notes: existing.notes,
      });
    }
  }, [existing, form]);

  async function onSubmit(raw: EnquiryUpsertInput) {
    const values = coerceBlanks(raw);
    const parsed = EnquiryUpsertSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((i) =>
        form.setError(i.path[0] as keyof EnquiryUpsertInput, { message: i.message }),
      );
      return;
    }
    try {
      const saved = await save.mutateAsync(parsed.data);
      navigate(`/admissions/${saved.id}`, { replace: true });
    } catch (err) {
      form.setError("root", { message: getErrorMessage(err, "Could not save enquiry") });
    }
  }

  if (!isNew && isLoading) return <p className="muted">Loading…</p>;

  const errors = form.formState.errors;
  const errCount = Object.keys(errors).filter((k) => k !== "root").length;

  return (
    <>
      <PageHead
        group="ADMISSION"
        meta={isNew ? "NEW" : `ENQ-${String(enquiryId).padStart(4, "0")}`}
        title={isNew ? "New enquiry" : `Edit · ${existing?.childName ?? ""}`}
        actions={
          <Link
            to={isNew ? "/admissions" : `/admissions/${enquiryId}`}
            className="btn btn--ghost btn--sm"
          >
            <Icon name="chev-left" size={14} /> Back
          </Link>
        }
      />

      {errCount > 0 && (
        <div className="banner banner--warn">
          <Icon name="alert" size={16} />
          <span>
            <b>Check the highlighted fields</b> — {errCount} issue{errCount > 1 ? "s" : ""}.
          </span>
        </div>
      )}

      <form
        id="enq-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="card"
        style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 28 }}
      >

        {/* 01 IDENTITY */}
        <Section num="01" title="Identity">
          <div className="form-grid">
            <Field label="Child name" required error={errors.childName?.message}>
              <input className="input" {...form.register("childName", { required: "Required" })} maxLength={120} required />
            </Field>
            <Field label="Parent name">
              <input className="input" {...form.register("parentName")} maxLength={120} />
            </Field>
            <Field label="Phone" required error={errors.phone?.message}>
              <input
                className="input"
                type="tel"
                inputMode="numeric"
                {...form.register("phone", { required: "Required" })}
                maxLength={20}
                placeholder="9876543210"
                required
              />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input className="input" type="email" {...form.register("email")} maxLength={120} />
            </Field>
            <Field label="Class sought">
              <select className="select" {...form.register("classSeeking")}>
                <option value="">— select —</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.slug}>{c.slug}</option>
                ))}
              </select>
            </Field>
            <Field label="City">
              <input className="input" {...form.register("city")} maxLength={80} />
            </Field>
          </div>
        </Section>

        {/* 02 PIPELINE */}
        <Section num="02" title="Pipeline" muted="Where this lead sits in the funnel and who owns it.">
          <div className="form-grid">
            <Field label="Source">
              <select className="select" {...form.register("source")}>
                <option value="walk_in">Walk-in</option>
                <option value="phone">Phone</option>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="social">Social</option>
                <option value="newspaper">Newspaper</option>
                <option value="hoarding">Hoarding</option>
                <option value="event">Event</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Source detail" hint="Referrer name, campaign…">
              <input className="input" {...form.register("sourceDetail")} maxLength={160} />
            </Field>
            <Field label="Status">
              <select className="select" {...form.register("status")}>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="visit_scheduled">Visit scheduled</option>
                <option value="visited">Visited</option>
                <option value="application">Application</option>
                <option value="admitted">Admitted</option>
                <option value="lost">Lost</option>
              </select>
            </Field>
            <Field label="Assign to">
              <select
                className="select"
                {...form.register("assignedTo", {
                  setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                })}
              >
                <option value="">Unassigned</option>
                {(team?.items ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Follow-up date">
              <input className="input" type="date" {...form.register("followUpDate")} />
            </Field>
            <Field label="Notes" wide>
              <textarea className="input input--area" rows={2} {...form.register("notes")} />
            </Field>
          </div>
        </Section>

        {form.formState.errors.root?.message && (
          <div className="banner banner--error">
            <Icon name="alert" size={16} />
            <span>{form.formState.errors.root.message}</span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            paddingTop: 8,
            borderTop: "1px solid var(--rule-soft)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : isNew ? "Save enquiry" : "Save changes"}
          </button>
          <Link
            to={isNew ? "/admissions" : `/admissions/${enquiryId}`}
            className="btn btn--ghost"
          >
            Cancel
          </Link>
          <div style={{ flex: 1 }} />
          <span className="muted body-s">
            {isNew ? "Owner sees this enquiry in their queue on save." : "Changes are visible immediately."}
          </span>
        </div>
      </form>
    </>
  );
}

function Section({
  num, title, muted, children,
}: {
  num: string;
  title: string;
  muted?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-section">
      <div className="form-section__head">
        <span className="form-section__num">{num}</span>
        <h3 className="form-section__title">{title}</h3>
        {muted && <span className="muted body-s">{muted}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label, required, hint, error, wide, children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`field ${wide ? "span-2" : ""} ${error ? "field--error" : ""}`}
      style={wide ? { gridColumn: "1 / -1" } : undefined}
    >
      <label className={`field__label ${required ? "field__label--req" : ""}`}>{label}</label>
      {children}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}

function coerceBlanks(input: EnquiryUpsertInput): EnquiryUpsertInput {
  const out: Record<string, unknown> = { ...input };
  for (const k of Object.keys(out)) {
    if (out[k] === "") out[k] = null;
  }
  return out as EnquiryUpsertInput;
}
