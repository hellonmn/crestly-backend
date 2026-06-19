import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { useApplyLeave, useLeaveTypes } from "./hooks";
import { getErrorMessage } from "@/lib/api";
import { LeaveApplySchema, type HalfDay, type LeaveApplyInput } from "@crestly/shared";

export function LeaveApplyPage() {
  const navigate = useNavigate();
  const { data: types } = useLeaveTypes();
  const apply = useApplyLeave();

  const [leaveTypeId, setLeaveTypeId] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [halfDay, setHalfDay] = useState<HalfDay>("none");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Live day count (skips Sundays).
  let days = 0;
  if (fromDate && toDate && fromDate <= toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const cursor = new Date(from);
    while (cursor <= to) {
      if (cursor.getUTCDay() !== 0) days++;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (days === 1 && halfDay !== "none") days = 0.5;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const input: LeaveApplyInput = {
      leaveTypeId: Number(leaveTypeId),
      fromDate, toDate, halfDay,
      reason: reason.trim() || null,
    };
    const parsed = LeaveApplySchema.safeParse(input);
    if (!parsed.success) {
      setErr(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      return;
    }
    try {
      await apply.mutateAsync(parsed.data);
      navigate("/leaves", { replace: true });
    } catch (e) {
      setErr(getErrorMessage(e, "Could not submit"));
    }
  }

  return (
    <>
      <PageHead
        group="LEAVES"
        title="Apply leave"
        actions={
          <Link to="/leaves" className="btn btn--ghost btn--sm">
            <Icon name="chev-left" size={14} /> Back
          </Link>
        }
      />

      <form className="card" onSubmit={onSubmit}>
        <div className="form-section">
          <div className="form-section__head"><span className="form-section__num">01</span><span className="form-section__title">Leave type</span></div>
          <div className="form-grid form-grid--2">
            <div className="field">
              <label className="field__label">Type *</label>
              <select className="select" value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} required>
                <option value="">— pick —</option>
                {types?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.shortCode})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Half-day?</label>
              <select className="select" value={halfDay} onChange={(e) => setHalfDay(e.target.value as HalfDay)}>
                <option value="none">No (full day)</option>
                <option value="first_half">First half only</option>
                <option value="second_half">Second half only</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__head"><span className="form-section__num">02</span><span className="form-section__title">Dates</span></div>
          <div className="form-grid form-grid--2">
            <div className="field">
              <label className="field__label">From *</label>
              <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
            </div>
            <div className="field">
              <label className="field__label">To *</label>
              <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <div className="muted body-s">
                Total: <b>{days}</b> day{days === 1 ? "" : "s"} (Sundays skipped)
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__head"><span className="form-section__num">03</span><span className="form-section__title">Reason &amp; documents</span></div>
          <textarea className="input input--area" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason…" />
          <p className="muted body-s" style={{ marginTop: 8 }}>
            Mention any supporting document in the reason — file uploads aren't wired here yet.
          </p>
        </div>

        {err && <div className="banner banner--error"><span>{err}</span></div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={apply.isPending}>
            {apply.isPending ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </form>
    </>
  );
}
