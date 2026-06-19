import { useState } from "react";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { Modal } from "@/components/Modal";
import { useFeeStructure, useSaveFeeStructure, useTransportSlabs } from "./hooks";
import { getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import type { FeeStructureRow } from "@crestly/shared";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export function FeeStructurePage() {
  const { user } = useAuth();
  const canManage = (user?.permissions ?? []).includes("fee_structure.manage");
  const { data, isLoading } = useFeeStructure();
  const { data: slabs } = useTransportSlabs();
  const [editing, setEditing] = useState<FeeStructureRow | null>(null);

  const avg = data && data.length > 0
    ? Math.round(data.reduce((s, r) => s + r.tuitionYearly, 0) / data.length)
    : 0;

  return (
    <>
      <PageHead
        group="FINANCE"
        title="Fee Structure"
        lede="Master rates per class — recurring annual fees + one-time joining fees + transport slabs."
      />

      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile tint="mustard" icon="classes" label="CLASSES" value={String(data?.length ?? "—")} delta="" />
        <StatTile tint="rose" icon="rupee" label="AVG TUITION" value={fmt(avg)} delta="yearly" />
        <StatTile tint="sky" icon="transport" label="TRANSPORT SLABS" value={String(slabs?.length ?? "—")} delta="" />
        <StatTile tint="wheat" icon="users" label="STUDENTS" value={data ? String(data.reduce((s, r) => s + r.studentCount, 0)) : "—"} delta="all classes" />
      </div>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Tuition</th>
              <th>Annual</th>
              <th>Activity</th>
              <th>Exam</th>
              <th>Recurring</th>
              <th>One-time</th>
              <th>Students</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "var(--ink-40)" }}>Loading…</td></tr>
            )}
            {data?.map((r) => (
              <tr key={r.class}>
                <td><span className="cls-pill">{r.class}</span></td>
                <td className="mono">{fmt(r.tuitionYearly)}</td>
                <td className="mono">{fmt(r.annualCharges)}</td>
                <td className="mono">{fmt(r.activityFee)}</td>
                <td className="mono">{fmt(r.examFee)}</td>
                <td className="mono">{fmt(r.recurringTotal)}</td>
                <td className="mono muted">{fmt(r.oneTimeTotal)}</td>
                <td className="mono">{r.studentCount}</td>
                <td style={{ textAlign: "right" }}>
                  {canManage && (
                    <button className="btn btn--ghost btn--sm" onClick={() => setEditing(r)}>
                      <Icon name="edit" size={14} /> Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {slabs && slabs.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="display-s" style={{ marginBottom: 16 }}>Transport slabs</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Slab</th>
                <th>Range</th>
                <th>Yearly</th>
                <th>Quarterly</th>
                <th>Monthly</th>
              </tr>
            </thead>
            <tbody>
              {slabs.map((s) => (
                <tr key={s.slab}>
                  <td><span className="cls-pill">{s.slab}</span></td>
                  <td className="muted">{s.distanceRange}</td>
                  <td className="mono">{fmt(s.yearlyFee)}</td>
                  <td className="mono">{fmt(s.quarterlyFee)}</td>
                  <td className="mono">{fmt(s.monthlyFee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <EditModal row={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function EditModal({ row, onClose }: { row: FeeStructureRow; onClose: () => void }) {
  const save = useSaveFeeStructure();
  const [form, setForm] = useState({
    tuitionYearly: row.tuitionYearly,
    annualCharges: row.annualCharges,
    activityFee: row.activityFee,
    examFee: row.examFee,
    registrationFee: row.registrationFee,
    admissionFee: row.admissionFee,
    cautionMoney: row.cautionMoney,
  });
  const [error, setError] = useState<string | null>(null);

  function bind(key: keyof typeof form) {
    return {
      value: String(form[key]),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: Number(e.target.value || 0) })),
    };
  }

  const recurring = form.tuitionYearly + form.annualCharges + form.activityFee + form.examFee;
  const oneTime = form.registrationFee + form.admissionFee + form.cautionMoney;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({ class: row.class, ...form });
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, "Failed to save"));
    }
  }

  return (
    <Modal
      open
      title={`Edit fee structure · ${row.class}`}
      onClose={onClose}
      size="lg"
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="fs-edit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="fs-edit" onSubmit={onSubmit} className="form-grid form-grid--2">
        <div className="label" style={{ gridColumn: "1 / -1", color: "var(--ink-40)", marginTop: 4 }}>RECURRING YEARLY</div>
        <Field label="Tuition (₹)"><input className="input mono" type="number" {...bind("tuitionYearly")} /></Field>
        <Field label="Annual charges (₹)"><input className="input mono" type="number" {...bind("annualCharges")} /></Field>
        <Field label="Activity fee (₹)"><input className="input mono" type="number" {...bind("activityFee")} /></Field>
        <Field label="Exam fee (₹)"><input className="input mono" type="number" {...bind("examFee")} /></Field>
        <Field label="Recurring total" fullWidth>
          <input className="input mono" value={fmt(recurring)} disabled />
        </Field>

        <div className="label" style={{ gridColumn: "1 / -1", color: "var(--ink-40)", marginTop: 8 }}>ONE-TIME JOINING</div>
        <Field label="Registration (₹)"><input className="input mono" type="number" {...bind("registrationFee")} /></Field>
        <Field label="Admission (₹)"><input className="input mono" type="number" {...bind("admissionFee")} /></Field>
        <Field label="Caution money (₹)"><input className="input mono" type="number" {...bind("cautionMoney")} /></Field>
        <Field label="One-time total" fullWidth>
          <input className="input mono" value={fmt(oneTime)} disabled />
        </Field>
        <Field label="First-year total" fullWidth>
          <input className="input mono" value={fmt(recurring + oneTime)} disabled />
        </Field>

        {error && <div className="banner banner--error" style={{ gridColumn: "1 / -1" }}><span>{error}</span></div>}
      </form>
    </Modal>
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
