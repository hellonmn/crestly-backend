import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { api, getErrorMessage } from "@/lib/api";
import type { PartnerSchoolDetail, PartnerSchoolStatus, SchoolUpsert } from "@crestly/shared";

const blank: SchoolUpsert = {
  name: "", slug: "", status: "onboarding",
  dbHost: "localhost", dbName: "", dbUser: "",
  dbPassword: "", contactPerson: null, contactPhone: null, contactEmail: null,
  city: null, state: null, address: null, board: null,
  brandColor: null, logoPath: null, plan: null, notes: null,
};

export function SchoolEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const schoolId = isNew ? undefined : Number(id);
  const navigate = useNavigate();

  const { data: existing } = useQuery({
    queryKey: ["super", "school", schoolId],
    enabled: schoolId !== undefined,
    queryFn: async () => (await api.get<PartnerSchoolDetail>(`/superadmin/schools/${schoolId}`)).data,
  });

  const [form, setForm] = useState<SchoolUpsert>(blank);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name, slug: existing.slug, status: existing.status,
        dbHost: existing.dbHost, dbName: existing.dbName, dbUser: existing.dbUser,
        dbPassword: null,
        contactPerson: existing.contactPerson, contactPhone: existing.contactPhone, contactEmail: existing.contactEmail,
        city: existing.city, state: existing.state, address: existing.address, board: existing.board,
        brandColor: existing.brandColor, logoPath: existing.logoPath,
        plan: existing.plan, notes: existing.notes,
      });
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: async (input: SchoolUpsert) => {
      if (schoolId) return (await api.put<PartnerSchoolDetail>(`/superadmin/schools/${schoolId}`, input)).data;
      return (await api.post<PartnerSchoolDetail>("/superadmin/schools", input)).data;
    },
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await save.mutateAsync(form);
      navigate(`/schools/${r.id}`, { replace: true });
    } catch (e) { setErr(getErrorMessage(e, "Save failed")); }
  }

  function bind<K extends keyof SchoolUpsert>(key: K) {
    return {
      value: (form[key] ?? "") as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [key]: (e.target.value || null) as SchoolUpsert[K] })),
    };
  }

  return (
    <>
      <PageHead
        group="TENANTS"
        title={isNew ? "Onboard a school" : `Edit · ${existing?.name ?? ""}`}
        actions={
          <Link to={isNew ? "/schools" : `/schools/${schoolId}`} className="btn btn--ghost btn--sm">
            <Icon name="chev-left" size={14} /> Back
          </Link>
        }
      />

      <form className="card" onSubmit={onSubmit}>
        <div className="form-section">
          <div className="form-section__head"><span className="form-section__num">01</span><span className="form-section__title">Identity</span></div>
          <div className="form-grid form-grid--2">
            <Field label="Name *"><input className="input" {...bind("name")} required /></Field>
            <Field label="Slug *"><input className="input mono" {...bind("slug")} required placeholder="my-school" /></Field>
            <Field label="Status">
              <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PartnerSchoolStatus })}>
                <option value="onboarding">Onboarding</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </Field>
            <Field label="Plan"><input className="input" {...bind("plan")} placeholder="Founding partner" /></Field>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__head"><span className="form-section__num">02</span><span className="form-section__title">Database</span></div>
          <div className="form-grid form-grid--2">
            <Field label="DB host *"><input className="input mono" {...bind("dbHost")} required /></Field>
            <Field label="DB name *"><input className="input mono" {...bind("dbName")} required /></Field>
            <Field label="DB user *"><input className="input mono" {...bind("dbUser")} required /></Field>
            <Field label={isNew ? "DB password *" : "DB password (leave blank to keep)"}>
              <input
                className="input mono" type="password"
                value={form.dbPassword ?? ""}
                onChange={(e) => setForm({ ...form, dbPassword: e.target.value || null })}
                required={isNew}
              />
              <span className="field__hint">Encrypted at rest using PLATFORM_KEY.</span>
            </Field>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__head"><span className="form-section__num">03</span><span className="form-section__title">Contact</span></div>
          <div className="form-grid form-grid--2">
            <Field label="Contact person"><input className="input" {...bind("contactPerson")} /></Field>
            <Field label="Phone"><input className="input mono" {...bind("contactPhone")} /></Field>
            <Field label="Email"><input className="input" type="email" {...bind("contactEmail")} /></Field>
            <Field label="Board"><input className="input" {...bind("board")} placeholder="CBSE / ICSE / State…" /></Field>
            <Field label="City"><input className="input" {...bind("city")} /></Field>
            <Field label="State"><input className="input" {...bind("state")} /></Field>
            <Field label="Address" fullWidth><textarea className="input input--area" {...bind("address")} /></Field>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__head"><span className="form-section__num">04</span><span className="form-section__title">Branding</span></div>
          <div className="form-grid form-grid--2">
            <Field label="Brand colour (hex)"><input className="input mono" {...bind("brandColor")} placeholder="#F25C19" /></Field>
            <Field label="Logo path"><input className="input mono" {...bind("logoPath")} placeholder="/uploads/brand/…" /></Field>
            <Field label="Internal notes" fullWidth><textarea className="input input--area" {...bind("notes")} rows={3} /></Field>
          </div>
        </div>

        {err && <div className="banner banner--error"><Icon name="alert" size={14} /><span>{err}</span></div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : isNew ? "Create school" : "Save changes"}
          </button>
        </div>
      </form>
    </>
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
