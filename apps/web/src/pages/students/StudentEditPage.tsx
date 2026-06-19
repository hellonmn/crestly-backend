import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { useForm } from "react-hook-form";
import { PageHead } from "@/components/PageHead";
import { useSaveStudent, useStudentDetail } from "./hooks";
import { useClasses } from "@/pages/classes/hooks";
import { useFamilies } from "@/pages/families/hooks";
import { usePickupPoints } from "@/pages/transport/hooks";
import { getErrorMessage } from "@/lib/api";
import { StudentUpsertSchema, type StudentUpsert } from "@crestly/shared";

/* ============================================================
   Student create / edit form — ports erp/students/edit.php
   verbatim. Six numbered sections (Identity, Academic, Parents,
   Contact, Pickup + Family, Academic + Guardian + Extra Contacts)
   plus a Home section that's only relevant for hostellers.
   ============================================================ */

const blank: StudentUpsert = {
  studentName: "",
  fatherName: null,
  motherName: null,
  dob: null,
  age: null,
  gender: null,
  bloodGroup: null,
  address: null,
  class: "",
  section: "",
  schoolName: null,
  board: "CBSE",
  status: "active",
  stream: null,
  subStream: null,
  isHostel: false,
  fatherContact: null,
  fatherWhatsapp: null,
  motherContact: null,
  motherWhatsapp: null,
  callingNumber: null,
  whatsappNumber: null,
  localGuardianName: null,
  guardianRelation: null,
  localGuardianContact: null,
  localGuardianWhatsapp: null,
  localGuardianAddress: null,
  academicContactPerson: null,
  academicCallingNumber: null,
  academicWhatsappNumber: null,
  feeContactPerson: null,
  feeCallingNumber: null,
  feeWhatsappNumber: null,
  pickupPointId: null,
  pickupPointName: null,
  familyId: null,
  homeCity: null,
  homeState: null,
  homeAddress: null,
};

export function StudentEditPage() {
  const { srNumber } = useParams<{ srNumber: string }>();
  const sr = srNumber ? Number(srNumber) : undefined;
  const isNew = sr === undefined;
  const navigate = useNavigate();

  const { data: existing, isLoading } = useStudentDetail(sr);
  const { data: classes } = useClasses();
  const { data: pickupPoints } = usePickupPoints();
  const { data: familiesResp } = useFamilies({ page: 1, pageSize: 200 });
  const save = useSaveStudent(sr);

  const form = useForm<StudentUpsert>({ defaultValues: blank });
  const isHostel = form.watch("isHostel");

  useEffect(() => {
    if (!existing) return;
    form.reset({
      srNumber: existing.srNumber,
      studentName: existing.studentName,
      fatherName: existing.fatherName,
      motherName: existing.motherName,
      dob: existing.dob,
      age: existing.age,
      gender: existing.gender,
      bloodGroup: existing.bloodGroup,
      address: existing.address,
      class: existing.class,
      section: existing.section,
      schoolName: existing.schoolName,
      board: existing.board,
      status: existing.status,
      stream: existing.stream,
      subStream: existing.subStream,
      isHostel: existing.isHostel,
      fatherContact: existing.fatherContact,
      fatherWhatsapp: existing.fatherWhatsapp,
      motherContact: existing.motherContact,
      motherWhatsapp: existing.motherWhatsapp,
      callingNumber: existing.callingNumber,
      whatsappNumber: existing.whatsappNumber,
      localGuardianName: existing.localGuardianName,
      guardianRelation: existing.guardianRelation,
      localGuardianContact: existing.localGuardianContact,
      localGuardianWhatsapp: existing.localGuardianWhatsapp,
      localGuardianAddress: existing.localGuardianAddress,
      academicContactPerson: existing.academicContactPerson,
      academicCallingNumber: existing.academicCallingNumber,
      academicWhatsappNumber: existing.academicWhatsappNumber,
      feeContactPerson: existing.feeContactPerson,
      feeCallingNumber: existing.feeCallingNumber,
      feeWhatsappNumber: existing.feeWhatsappNumber,
      pickupPointId: existing.pickupPointId,
      pickupPointName: existing.pickupName,
      familyId: existing.familyId,
      homeCity: existing.hostel?.homeCity ?? null,
      homeState: existing.hostel?.homeState ?? null,
      homeAddress: existing.hostel?.homeAddress ?? null,
    });
  }, [existing, form]);

  const sectionOptions = useMemo(() => {
    // Existing sections distinct values would be ideal — fall back to canonical A-E.
    return ["A", "B", "C", "D", "E"];
  }, []);

  async function onSubmit(raw: StudentUpsert) {
    // react-hook-form fields are strings; coerce empty strings → null for the
    // optional fields so Zod validators don't fail on "" vs null.
    const values = coerceBlanks(raw);
    const parsed = StudentUpsertSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((i) =>
        form.setError(i.path[0] as keyof StudentUpsert, { message: i.message }),
      );
      return;
    }
    try {
      const saved = await save.mutateAsync(parsed.data);
      navigate(`/students/${saved.srNumber}`, { replace: true });
    } catch (err) {
      form.setError("root", { message: getErrorMessage(err, "Could not save student") });
    }
  }

  if (!isNew && isLoading) return <p className="muted">Loading…</p>;

  const errors = form.formState.errors;
  const errCount = Object.keys(errors).filter((k) => k !== "root").length;

  return (
    <>
      <PageHead
        group="STUDENTS"
        meta={isNew ? "ADD" : `SR ${String(sr).padStart(4, "0")}`}
        title={isNew ? "Add a new student" : `Edit · ${existing?.studentName ?? ""}`}
        actions={
          <Link to={isNew ? "/students" : `/students/${sr}`} className="btn btn--ghost btn--sm">
            <Icon name="chev-left" size={14} /> Back
          </Link>
        }
      />

      {errCount > 0 && (
        <div className="banner banner--warn">
          <Icon name="alert" size={16} />
          <span><b>Check the highlighted fields</b> — {errCount} issue{errCount > 1 ? "s" : ""}.</span>
        </div>
      )}

      <form
        id="student-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="card"
        style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 28 }}
      >

        {/* 01 IDENTITY */}
        <Section num="01" title="Identity">
          <div className="form-grid">
            {isNew && (
              <Field label="SR number (admission roll)" hint="Leave blank to auto-assign next SR." error={errors.srNumber?.message}>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  // setValueAs (not valueAsNumber) so an empty string becomes
                  // `undefined` — letting the schema's .optional() pass —
                  // instead of `NaN`, which Zod rejects with the unfriendly
                  // "Expected number, received nan" message.
                  {...form.register("srNumber", {
                    setValueAs: (v) =>
                      v === "" || v === null || v === undefined ? undefined : Number(v),
                  })}
                />
              </Field>
            )}
            <Field label="Student name" required wide={!isNew} error={errors.studentName?.message}>
              <input className="input" {...form.register("studentName", { required: "Required" })} maxLength={120} required />
            </Field>
            <Field label="Date of birth" error={errors.dob?.message}>
              <input className="input" type="date" {...form.register("dob")} />
            </Field>
            <Field label="Age (years)" hint="Leave blank to derive from DOB." error={errors.age?.message}>
              <input
                className="input"
                type="number"
                min={0}
                max={30}
                {...form.register("age", { setValueAs: (v) => (v === "" ? null : Number(v)) })}
                placeholder="auto from DOB"
              />
            </Field>
            <Field label="Gender" error={errors.gender?.message}>
              <select className="select" {...form.register("gender")}>
                <option value="">—</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Address" wide>
              <textarea
                className="input input--area"
                rows={2}
                {...form.register("address")}
                placeholder="House, area, city, pincode"
              />
            </Field>
          </div>
        </Section>

        {/* 02 ACADEMIC */}
        <Section num="02" title="Academic">
          <div className="form-grid form-grid--3">
            <Field label="Class" required error={errors.class?.message}>
              <select className="select" {...form.register("class", { required: "Required" })} required>
                <option value="">—</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.slug}>{c.slug}</option>
                ))}
              </select>
            </Field>
            <Field label="Section" required error={errors.section?.message}>
              <input
                className="input"
                {...form.register("section", { required: "Required" })}
                list="sections-list"
                style={{ textTransform: "uppercase" }}
                maxLength={8}
                required
              />
              <datalist id="sections-list">
                {sectionOptions.map((s) => <option key={s} value={s} />)}
              </datalist>
            </Field>
            <Field label="Board">
              <input className="input" {...form.register("board")} maxLength={32} />
            </Field>
            <Field label="Previous school" wide>
              <input className="input" {...form.register("schoolName")} maxLength={120} />
            </Field>
            <Field label="Status">
              <select className="select" {...form.register("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* 03 PARENTS */}
        <Section num="03" title="Parents">
          <div className="form-grid">
            <Field label="Father name">
              <input className="input" {...form.register("fatherName")} maxLength={120} />
            </Field>
            <Field label="Mother name">
              <input className="input" {...form.register("motherName")} maxLength={120} />
            </Field>
          </div>
        </Section>

        {/* 04 CONTACT */}
        <Section num="04" title="Contact numbers" muted="10-digit Indian numbers, +91 added automatically.">
          <div className="form-grid">
            <Field label="Father · phone" error={errors.fatherContact?.message}>
              <input className="input" type="tel" inputMode="numeric" {...form.register("fatherContact")} maxLength={20} placeholder="9876543210" />
            </Field>
            <Field label="Mother · phone" error={errors.motherContact?.message}>
              <input className="input" type="tel" inputMode="numeric" {...form.register("motherContact")} maxLength={20} placeholder="9876543210" />
            </Field>
            <Field label="Calling number" hint="Used for school calls. Defaults to father's number." error={errors.callingNumber?.message}>
              <input className="input" type="tel" inputMode="numeric" {...form.register("callingNumber")} maxLength={20} placeholder="defaults to father" />
            </Field>
            <Field label="WhatsApp number" hint="Used for fee receipts & notices. Defaults to mother's number." error={errors.whatsappNumber?.message}>
              <input className="input" type="tel" inputMode="numeric" {...form.register("whatsappNumber")} maxLength={20} placeholder="defaults to mother" />
            </Field>
          </div>
        </Section>

        {/* 05 PICKUP + FAMILY */}
        <Section num="05" title="Pickup & family">
          <div className="form-grid">
            <Field label="Pickup point" hint="Distance determines the transport slab." error={errors.pickupPointId?.message}>
              <select
                className="select"
                {...form.register("pickupPointId", {
                  setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                })}
              >
                <option value="">— Self pickup —</option>
                {(pickupPoints?.items ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.distanceKm != null ? ` · ${p.distanceKm.toFixed(1)} km` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sibling family" hint="Sibling discount auto-applies on save (12% / 18%)." error={errors.familyId?.message}>
              <select
                className="select"
                {...form.register("familyId", {
                  setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                })}
              >
                <option value="">— None (only child) —</option>
                {(familiesResp?.items ?? []).map((f) => (
                  <option key={f.familyId} value={f.familyId}>
                    Family #{f.familyId} · {f.fatherName ?? "—"}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* 06 ACADEMIC, GUARDIAN & EXTRA CONTACTS */}
        <Section
          num="06"
          title="Academic, guardian & extra contacts"
          muted="For 11th/12th streams, local guardian, and academic/fee point-of-contact."
        >
          <div className="form-grid">
            <Field label="Stream">
              <input className="input" {...form.register("stream")} maxLength={16} placeholder="Science / Commerce" />
            </Field>
            <Field label="Sub-stream">
              <input className="input" {...form.register("subStream")} maxLength={16} placeholder="PCM / PCB" />
            </Field>
            <Field label="Accommodation">
              <select
                className="select"
                value={form.watch("isHostel") ? "1" : "0"}
                onChange={(e) => form.setValue("isHostel", e.target.value === "1")}
              >
                <option value="0">Day Scholar</option>
                <option value="1">Hosteller</option>
              </select>
            </Field>
            <Field label="Blood group">
              <input className="input" {...form.register("bloodGroup")} maxLength={8} placeholder="O+" />
            </Field>
            <Field label="Local guardian">
              <input className="input" {...form.register("localGuardianName")} maxLength={120} />
            </Field>
            <Field label="Guardian relation">
              <input className="input" {...form.register("guardianRelation")} maxLength={60} placeholder="Chacha, Nana…" />
            </Field>
            <Field label="Guardian · phone">
              <input className="input" type="tel" inputMode="numeric" {...form.register("localGuardianContact")} maxLength={20} />
            </Field>
            <Field label="Guardian · WhatsApp">
              <input className="input" type="tel" inputMode="numeric" {...form.register("localGuardianWhatsapp")} maxLength={20} />
            </Field>
            <Field label="Pickup point (text)" hint="Free-text stop name from import (separate from the slab dropdown).">
              <input className="input" {...form.register("pickupPointName")} maxLength={120} />
            </Field>
            <Field label="Academic contact">
              <input className="input" {...form.register("academicContactPerson")} maxLength={120} />
            </Field>
            <Field label="Academic · phone">
              <input className="input" type="tel" inputMode="numeric" {...form.register("academicCallingNumber")} maxLength={20} />
            </Field>
            <Field label="Fee contact">
              <input className="input" {...form.register("feeContactPerson")} maxLength={120} />
            </Field>
            <Field label="Fee · phone">
              <input className="input" type="tel" inputMode="numeric" {...form.register("feeCallingNumber")} maxLength={20} />
            </Field>
          </div>
        </Section>

        {/* 07 HOME (boarders only) */}
        {isHostel && (
          <Section num="07" title="Home (hostellers)">
            <div className="form-grid">
              <Field label="Home city">
                <input className="input" {...form.register("homeCity")} maxLength={80} />
              </Field>
              <Field label="Home state">
                <input className="input" {...form.register("homeState")} maxLength={80} />
              </Field>
              <Field label="Home address" wide>
                <textarea className="input input--area" rows={2} {...form.register("homeAddress")} />
              </Field>
              <Field label="Local guardian address" wide>
                <textarea className="input input--area" rows={2} {...form.register("localGuardianAddress")} />
              </Field>
            </div>
          </Section>
        )}

        {form.formState.errors.root?.message && (
          <div className="banner banner--error" style={{ marginTop: 8 }}>
            <Icon name="alert" size={16} />
            <span>{form.formState.errors.root.message}</span>
          </div>
        )}

        {/* ACTIONS */}
        <div
          style={{
            display: "flex", gap: 10, paddingTop: 8, borderTop: "1px solid var(--rule-soft)",
            alignItems: "center", flexWrap: "wrap",
          }}
        >
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : isNew ? "Add student" : "Save changes"}
          </button>
          <Link
            to={isNew ? "/students" : `/students/${sr}`}
            className="btn btn--ghost"
          >
            Cancel
          </Link>
          <div style={{ flex: 1 }} />
          <span className="muted body-s">
            {isNew ? "Next SR will be assigned automatically." : `SR ${String(sr).padStart(4, "0")}`}
          </span>
        </div>
      </form>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Bits                                                                */
/* ------------------------------------------------------------------ */

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

/** Empty strings from the form → null for optional Zod fields. */
function coerceBlanks(input: StudentUpsert): StudentUpsert {
  const out: Record<string, unknown> = { ...input };
  for (const k of Object.keys(out)) {
    if (out[k] === "") out[k] = null;
  }
  return out as StudentUpsert;
}
