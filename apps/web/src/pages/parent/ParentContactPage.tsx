import { useState } from "react";
import { KidPills, useActiveSr } from "./_layout/KidPills";
import { useMaskedCall, useParentContact, useParentHome } from "./hooks";
import { getParentErrorMessage } from "@/lib/parent-api";
import { Icon } from "@crestly/icons";
import type { ParentContactStaff } from "@crestly/shared";

export function ParentContactPage() {
  const { data: home } = useParentHome();
  const kids = home?.kids ?? [];
  const sr = useActiveSr(kids);
  const { data, isLoading } = useParentContact(sr);
  const call = useMaskedCall();
  const [flash, setFlash] = useState<string | null>(null);

  async function onCall(staffId: number) {
    setFlash(null);
    try {
      const r = await call.mutateAsync({ sr, staffId });
      setFlash(r.ok ? "Connecting your call… your phone will ring shortly." : (r.message ?? "Couldn't place the call."));
    } catch (e) {
      setFlash(getParentErrorMessage(e, "Couldn't place the call. Please use WhatsApp."));
    }
    setTimeout(() => setFlash(null), 5000);
  }

  const masked = data?.callingEnabled ?? false;
  const schoolWa = data?.schoolWhatsapp ?? null;

  return (
    <div className="pc">
      <h1 className="pc__title">Contact</h1>
      <KidPills kids={kids} />

      {data && (
        <div className={`pc__office ${data.office.isOpen ? "is-open" : ""}`}>
          <Icon name="clock" size={14} />
          <span>{data.office.label}</span>
        </div>
      )}

      {flash && <div className="banner banner--info" style={{ marginBottom: 12 }}>{flash}</div>}

      {isLoading && <div className="muted">Loading…</div>}

      {data && data.subjectTeachers.length > 0 && (
        <section className="pc__sec">
          <h2 className="pc__h">Subject teachers</h2>
          {data.subjectTeachers.map((t) => (
            <StaffRow key={t.id} s={t} masked={masked} schoolWa={schoolWa} onCall={onCall} calling={call.isPending} />
          ))}
        </section>
      )}

      {data && data.schoolChain.length > 0 && (
        <section className="pc__sec">
          <h2 className="pc__h">School office &amp; admin</h2>
          {data.schoolChain.map((t) => (
            <StaffRow key={t.id} s={t} masked={masked} schoolWa={schoolWa} onCall={onCall} calling={call.isPending} />
          ))}
        </section>
      )}

      <div className="pc__help muted body-s">
        <Icon name="info" size={13} />
        {masked
          ? " Calls connect through the school line — numbers stay private. Outside calling hours, use WhatsApp."
          : " Call buttons work during office hours. WhatsApp messages are read 24/7."}
      </div>

      <style>{PC_CSS}</style>
    </div>
  );
}

function StaffRow({
  s, masked, schoolWa, onCall, calling,
}: {
  s: ParentContactStaff;
  masked: boolean;
  schoolWa: string | null;
  onCall: (staffId: number) => void;
  calling: boolean;
}) {
  // WhatsApp target: school number when masked, else the staffer's personal one.
  const waNumber = masked ? schoolWa : s.whatsapp;
  const canCall = s.canCallNow && (masked || !!s.phone);

  return (
    <div className="pc__staff">
      <div className="pc__avi">{initials(s.name)}</div>
      <div className="pc__body">
        <div className="muted body-s">{s.roleLabel}</div>
        <div className="pc__name">{s.name}</div>
        {(s.designation || s.subjects?.length) && (
          <div className="muted body-s">
            {s.designation}
            {s.subjects && s.subjects.length > 0 && <> · {s.subjects.join(", ")}</>}
          </div>
        )}
        {!s.canCallNow && s.callStart && s.callEnd && (
          <div className="muted body-s">Calls: {s.callStart}–{s.callEnd}</div>
        )}
      </div>
      <div className="pc__btns">
        {masked ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={!canCall || calling}
            title={canCall ? "Call (number stays private)" : "Calling closed — use WhatsApp"}
            onClick={() => onCall(s.id)}
          >
            <Icon name="phone" size={13} />
          </button>
        ) : canCall && s.phone ? (
          <a className="btn btn--ghost btn--sm" href={`tel:${s.phone}`} title={s.phone}><Icon name="phone" size={13} /></a>
        ) : (
          <button type="button" className="btn btn--ghost btn--sm" disabled title="Calling closed — use WhatsApp"><Icon name="phone" size={13} /></button>
        )}
        {waNumber && (
          <a
            className="btn btn--ghost btn--sm"
            href={`https://wa.me/${waNumber.replace(/\D/g, "")}`}
            target="_blank" rel="noopener noreferrer"
            title="WhatsApp"
          >
            <Icon name="whatsapp" size={13} />
          </a>
        )}
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

const PC_CSS = `
  .pc { max-width: 720px; margin: 0 auto; padding: 22px 18px 32px; }
  .pc__title { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 22px; letter-spacing: -.02em; margin: 0 0 14px; }
  .pc__office {
    display: inline-flex; align-items: center; gap: 7px;
    background: var(--cream-soft); color: var(--ink-60);
    padding: 7px 12px; border-radius: 999px; font-size: 12px; font-weight: 600;
    margin-bottom: 14px;
  }
  .pc__office.is-open { background: #dcfce7; color: #166534; }
  .pc__h { font-family: var(--font-mono, monospace); font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-60); margin: 0 0 10px; }
  .pc__sec { margin-bottom: 18px; }
  .pc__staff {
    display: flex; gap: 12px; align-items: center;
    background: var(--white); border: 1px solid var(--rule); border-radius: 12px;
    padding: 12px; margin-bottom: 8px;
  }
  .pc__avi {
    width: 38px; height: 38px; border-radius: 50%;
    background: var(--tint-wheat, #fcebd6); color: var(--orange-deep, #b8410b);
    display: grid; place-items: center; font-weight: 800; font-size: 12px; flex-shrink: 0;
  }
  .pc__body { flex: 1; min-width: 0; }
  .pc__name { font-weight: 700; font-size: 14px; }
  .pc__btns { display: flex; gap: 6px; flex-shrink: 0; }
  .pc__help {
    margin-top: 16px;
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--cream-soft); padding: 10px 14px; border-radius: 10px;
  }
`;
