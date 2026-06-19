import { useState } from "react";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { Modal } from "@/components/Modal";
import {
  useFinalizePromotion, usePromoteSection, usePromotionOverview, usePromotionSection,
} from "./hooks";
import { getErrorMessage } from "@/lib/api";
import type { PromoteOneInput } from "@crestly/shared";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export function PromotionPage() {
  const { data: overview, isLoading } = usePromotionOverview();
  const [section, setSection] = useState<{ class: string; section: string } | null>(null);
  const finalizeM = useFinalizePromotion();
  const [confirmText, setConfirmText] = useState("");
  const [finalizeResult, setFinalizeResult] = useState<string | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  async function onFinalize() {
    if (confirmText !== "SWITCH") {
      setFinalizeError("Type SWITCH to confirm.");
      return;
    }
    setFinalizeError(null);
    setFinalizeResult(null);
    try {
      const r = await finalizeM.mutateAsync();
      setFinalizeResult(`Promoted ${r.promoted} · Held back ${r.heldBack} · Graduated ${r.graduated}. New session is now current.`);
      setConfirmText("");
    } catch (e) {
      setFinalizeError(getErrorMessage(e, "Could not finalize."));
    }
  }

  return (
    <>
      <PageHead
        group="HR"
        title="Promote Students"
        lede={overview ? `From ${overview.fromSession} → To ${overview.toSession}` : "Loading…"}
      />

      {finalizeResult && <div className="banner banner--success"><Icon name="check" size={16} /><span>{finalizeResult}</span></div>}
      {finalizeError && <div className="banner banner--error"><Icon name="alert" size={16} /><span>{finalizeError}</span></div>}

      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile tint="mustard" icon="users" label="ACTIVE" value={String(overview?.totals.active ?? "—")} delta="students" />
        <StatTile tint="mint" icon="check" label="DECIDED" value={String(overview?.totals.decided ?? "—")} delta="" />
        <StatTile tint="wheat" icon="alert" label="PENDING" value={String(overview?.totals.pending ?? "—")} delta="" />
        <StatTile tint="rose" icon="rupee" label="DUES CARRIED" value={overview ? fmt(overview.totals.duesCarried) : "—"} delta="" />
      </div>

      {!isLoading && overview && (
        <div className="card">
          <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>Sections</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Class · Section</th>
                <th>Pending</th>
                <th>Promoted</th>
                <th>Held back</th>
                <th>Graduated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {overview.sections.map((s) => (
                <tr key={`${s.classSlug}-${s.sectionCode}`}>
                  <td><span className="cls-pill">{s.classSlug}-{s.sectionCode}</span></td>
                  <td className="mono">{s.pending}</td>
                  <td className="mono">{s.promoted}</td>
                  <td className="mono">{s.heldBack}</td>
                  <td className="mono">{s.graduated}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={() => setSection({ class: s.classSlug, section: s.sectionCode })}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section && <SectionEditor section={section} onClose={() => setSection(null)} />}

      <div className="card">
        <div className="display-s" style={{ marginBottom: 8, fontSize: 18 }}>Finalize &amp; switch session</div>
        <p className="muted body-s">
          When every active student has a decision, type <b>SWITCH</b> to apply the new class/section
          to every promoted student, mark graduates inactive, and flip <code className="mono">{overview?.toSession}</code> to current.
        </p>
        <div className="form-grid form-grid--2">
          <div className="field">
            <label className="field__label">Type SWITCH to confirm</label>
            <input className="input mono" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              className="btn btn--danger"
              disabled={confirmText !== "SWITCH" || finalizeM.isPending || (overview?.totals.pending ?? 1) > 0}
              onClick={onFinalize}
            >
              {finalizeM.isPending ? "Switching…" : "Finalize & switch"}
            </button>
          </div>
        </div>
        {(overview?.totals.pending ?? 0) > 0 && (
          <p className="muted body-s" style={{ marginTop: 8 }}>
            <Icon name="alert" size={12} /> {overview?.totals.pending} student(s) still need a decision.
          </p>
        )}
      </div>
    </>
  );
}

function SectionEditor({ section, onClose }: { section: { class: string; section: string }; onClose: () => void }) {
  const { data: roster } = usePromotionSection(section);
  const promote = usePromoteSection();
  const [defaultToClass, setDefaultToClass] = useState("");
  const [decisions, setDecisions] = useState<Record<number, PromoteOneInput>>({});

  function setDecision(srNumber: number, patch: Partial<PromoteOneInput>) {
    setDecisions((prev) => ({
      ...prev,
      [srNumber]: { ...(prev[srNumber] ?? { srNumber, action: "promote" }), ...patch, srNumber },
    }));
  }

  async function onSubmit() {
    const finalDecisions: PromoteOneInput[] = (roster ?? []).map((r) => ({
      srNumber: r.srNumber,
      action: decisions[r.srNumber]?.action ?? "promote",
      toClass: decisions[r.srNumber]?.toClass ?? defaultToClass,
      toSection: decisions[r.srNumber]?.toSection ?? section.section,
    }));
    try {
      await promote.mutateAsync({
        class: section.class,
        section: section.section,
        defaultToClass: defaultToClass || null,
        defaultToSection: section.section,
        decisions: finalDecisions,
      });
      onClose();
    } catch (e) { alert(getErrorMessage(e, "Failed to save")); }
  }

  return (
    <Modal
      open
      title={`Promote · Section ${section.class}-${section.section}`}
      onClose={onClose}
      size="lg"
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={onSubmit} disabled={promote.isPending}>
            {promote.isPending ? "Saving…" : "Save section decisions"}
          </button>
        </>
      }
    >
      <div className="form-grid form-grid--2" style={{ marginBottom: 12 }}>
        <div className="field">
          <label className="field__label">Default "to class" for everyone promoted</label>
          <input className="input mono" value={defaultToClass} onChange={(e) => setDefaultToClass(e.target.value)} placeholder="e.g. 11" />
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>SR</th>
            <th>Student</th>
            <th>Action</th>
            <th>To class</th>
            <th>To section</th>
            <th>Outstanding due</th>
          </tr>
        </thead>
        <tbody>
          {roster?.map((r) => {
            const dec = decisions[r.srNumber] ?? { srNumber: r.srNumber, action: "promote" as const };
            return (
              <tr key={r.srNumber}>
                <td className="td-sr mono">{r.srNumber}</td>
                <td className="td-name">{r.studentName}</td>
                <td>
                  <select
                    className="select"
                    value={dec.action}
                    onChange={(e) => setDecision(r.srNumber, { action: e.target.value as PromoteOneInput["action"] })}
                  >
                    <option value="promote">Promote</option>
                    <option value="hold_back">Hold back</option>
                    <option value="graduate">Graduate</option>
                  </select>
                </td>
                <td>
                  <input
                    className="input input--sm mono"
                    value={dec.toClass ?? defaultToClass}
                    onChange={(e) => setDecision(r.srNumber, { toClass: e.target.value })}
                    disabled={dec.action !== "promote"}
                    style={{ width: 80 }}
                  />
                </td>
                <td>
                  <input
                    className="input input--sm mono"
                    value={dec.toSection ?? section.section}
                    onChange={(e) => setDecision(r.srNumber, { toSection: e.target.value })}
                    disabled={dec.action !== "promote"}
                    style={{ width: 80 }}
                  />
                </td>
                <td className="mono">{r.outstandingDue > 0 ? `₹${r.outstandingDue}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Modal>
  );
}

