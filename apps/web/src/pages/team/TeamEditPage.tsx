import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { useForm } from "react-hook-form";
import { PageHead } from "@/components/PageHead";
import { useRoles, useSaveTeamMember, useSetTeamPassword, useTeamMember } from "./hooks";
import { getErrorMessage } from "@/lib/api";
import { TeamUpsertSchema, type TeamUpsert } from "@crestly/shared";

const blank: TeamUpsert = {
  employeeId: null,
  name: "",
  designation: null,
  department: null,
  gender: null,
  dob: null,
  dateOfJoining: null,
  experienceYears: null,
  qualification: null,
  employmentType: null,
  classTeacherOf: null,
  reportsTo: null,
  reportingUserId: null,
  geofencePickupId: null,
  whatsapp: null,
  emergencyContact: null,
  address: null,
  bloodGroup: null,
  monthlySalary: null,
  email: null,
  phone: null,
  roleId: null,
  status: "active",
};

export function TeamEditPage() {
  const { id } = useParams<{ id: string }>();
  const userId = id ? Number(id) : undefined;
  const isNew = userId === undefined;
  const navigate = useNavigate();

  const { data: existing, isLoading } = useTeamMember(userId);
  const save = useSaveTeamMember(userId);
  const setPassword = userId !== undefined ? useSetTeamPassword(userId) : null;
  const { data: roles } = useRoles();

  const form = useForm<TeamUpsert>({ defaultValues: blank });

  useEffect(() => {
    if (existing) {
      form.reset({
        employeeId: existing.employeeId,
        name: existing.name,
        designation: existing.designation,
        department: existing.department,
        gender: existing.gender,
        dob: existing.dob,
        dateOfJoining: existing.dateOfJoining,
        experienceYears: existing.experienceYears,
        qualification: existing.qualification,
        employmentType: existing.employmentType,
        classTeacherOf: existing.classTeacherOf,
        reportsTo: existing.reportsTo,
        reportingUserId: existing.reportingUserId,
        geofencePickupId: existing.geofencePickupId,
        whatsapp: existing.whatsapp,
        emergencyContact: existing.emergencyContact,
        address: existing.address,
        bloodGroup: existing.bloodGroup,
        monthlySalary: existing.monthlySalary,
        email: existing.email,
        phone: existing.phone,
        roleId: existing.roleId,
        status: existing.status,
      });
    }
  }, [existing, form]);

  async function onSubmit(values: TeamUpsert) {
    const parsed = TeamUpsertSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((i) =>
        form.setError(i.path[0] as keyof TeamUpsert, { message: i.message }),
      );
      return;
    }
    try {
      const saved = await save.mutateAsync(parsed.data);
      navigate(`/team/${saved.id}`, { replace: true });
    } catch (err) {
      form.setError("root", { message: getErrorMessage(err, "Could not save member") });
    }
  }

  async function onSetPassword() {
    if (!setPassword) return;
    const pw = window.prompt("New password (min 8 chars):");
    if (!pw) return;
    try {
      await setPassword.mutateAsync(pw);
      alert("Password updated.");
    } catch (err) {
      alert(getErrorMessage(err, "Failed to update password"));
    }
  }

  if (!isNew && isLoading) return <p className="muted">Loading…</p>;

  return (
    <>
      <PageHead
        group="TEAM"
        title={isNew ? "Add a new member" : `Edit · ${existing?.name ?? ""}`}
        actions={
          <Link to={isNew ? "/team" : `/team/${userId}`} className="btn btn--ghost btn--sm">
            <Icon name="chev-left" size={14} /> Back
          </Link>
        }
      />

      <form className="card" onSubmit={form.handleSubmit(onSubmit)}>
        <Section num="01" title="Identity">
          <div className="form-grid form-grid--2">
            <Field label="Full name *">
              <input className="input" {...form.register("name")} required />
            </Field>
            <Field label="Phone (login) *">
              <input className="input" inputMode="tel" {...form.register("phone")} required />
            </Field>
            <Field label="Email">
              <input className="input" type="email" {...form.register("email")} />
            </Field>
            <Field label="Employee ID">
              <input className="input" {...form.register("employeeId")} />
            </Field>
          </div>
        </Section>

        <Section num="02" title="Role & access">
          <div className="form-grid form-grid--2">
            <Field label="Role">
              <select className="select" {...form.register("roleId", { setValueAs: (v) => (v ? Number(v) : null) })}>
                <option value="">— select —</option>
                {roles?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select className="select" {...form.register("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section num="03" title="Employment">
          <div className="form-grid form-grid--3">
            <Field label="Designation"><input className="input" {...form.register("designation")} /></Field>
            <Field label="Department"><input className="input" {...form.register("department")} /></Field>
            <Field label="Employment type"><input className="input" {...form.register("employmentType")} /></Field>
            <Field label="Class teacher of"><input className="input" {...form.register("classTeacherOf")} /></Field>
            <Field label="Reports to"><input className="input" {...form.register("reportsTo")} /></Field>
            <Field label="Date of joining"><input className="input" type="date" {...form.register("dateOfJoining")} /></Field>
            <Field label="Experience (years)">
              <input className="input" type="number" {...form.register("experienceYears", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })} />
            </Field>
            <Field label="Qualification"><input className="input" {...form.register("qualification")} /></Field>
            <Field label="Monthly salary (₹)">
              <input className="input" type="number" inputMode="numeric" {...form.register("monthlySalary", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })} />
            </Field>
          </div>
        </Section>

        <Section num="04" title="Personal & contact">
          <div className="form-grid form-grid--3">
            <Field label="Gender">
              <select className="select" {...form.register("gender")}>
                <option value="">—</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Date of birth"><input className="input" type="date" {...form.register("dob")} /></Field>
            <Field label="Blood group"><input className="input" {...form.register("bloodGroup")} /></Field>
            <Field label="WhatsApp"><input className="input" {...form.register("whatsapp")} /></Field>
            <Field label="Emergency contact"><input className="input" {...form.register("emergencyContact")} /></Field>
            <Field label="Address" fullWidth>
              <textarea className="input input--area" {...form.register("address")} />
            </Field>
          </div>
        </Section>

        {form.formState.errors.root?.message && (
          <div className="banner banner--error" style={{ marginTop: 16 }}>
            <span>{form.formState.errors.root.message}</span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 20 }}>
          <div>
            {!isNew && (
              <button type="button" className="btn btn--ghost" onClick={onSetPassword}>
                <Icon name="settings" size={14} /> Set / reset password
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={save.isPending}>
              {save.isPending ? "Saving…" : isNew ? "Create member" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="form-section">
      <div className="form-section__head">
        <span className="form-section__num">{num}</span>
        <span className="form-section__title">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, fullWidth, children }: { label: string; fullWidth?: boolean; children: React.ReactNode }) {
  return (
    <div className="field" style={fullWidth ? { gridColumn: "1 / -1" } : undefined}>
      <label className="field__label">{label}</label>
      {children}
    </div>
  );
}
