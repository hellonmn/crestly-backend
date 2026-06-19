import { KidPills, useActiveSr } from "./_layout/KidPills";
import { useParentContact, useParentHome } from "./hooks";
import { Icon } from "@crestly/icons";
import type { ParentContactStaff } from "@crestly/shared";

export function ParentContactPage() {
  const { data: home } = useParentHome();
  const kids = home?.kids ?? [];
  const sr = useActiveSr(kids);
  const { data, isLoading } = useParentContact(sr);

  return (
    <div className="pc">
      <h1 className="pc__title">Contact</h1>
      <KidPills kids={kids} />

      {isLoading && <div className="muted">Loading…</div>}

      {data && data.subjectTeachers.length > 0 && (
        <section className="pc__sec">
          <h2 className="pc__h">Subject teachers</h2>
          {data.subjectTeachers.map((t) => <StaffRow key={t.id} s={t} />)}
        </section>
      )}

      {data && data.schoolChain.length > 0 && (
        <section className="pc__sec">
          <h2 className="pc__h">School office &amp; admin</h2>
          {data.schoolChain.map((t) => <StaffRow key={t.id} s={t} />)}
        </section>
      )}

      <div className="pc__help muted body-s">
        <Icon name="info" size={13} /> Office is typically open Mon–Fri 8 AM – 4 PM. WhatsApp messages are read 24/7.
      </div>

      <style>{PC_CSS}</style>
    </div>
  );
}

function StaffRow({ s }: { s: ParentContactStaff }) {
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
      </div>
      <div className="pc__btns">
        {s.phone && (
          <a className="btn btn--ghost btn--sm" href={`tel:${s.phone}`} title={s.phone}>
            <Icon name="phone" size={13} />
          </a>
        )}
        {s.whatsapp && (
          <a className="btn btn--ghost btn--sm"
             href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`}
             target="_blank" rel="noopener noreferrer"
             title={`WhatsApp ${s.whatsapp}`}>
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
  .pc__h { font-family: var(--font-mono, monospace); font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-60); margin: 0 0 10px; }
  .pc__sec { margin-bottom: 18px; }
  .pc__staff {
    display: flex; gap: 12px; align-items: center;
    background: var(--white); border: 1px solid var(--rule); border-radius: 12px;
    padding: 12px;
    margin-bottom: 8px;
  }
  .pc__avi {
    width: 38px; height: 38px; border-radius: 50%;
    background: var(--tint-wheat, #fcebd6); color: var(--orange-deep, #b8410b);
    display: grid; place-items: center;
    font-weight: 800; font-size: 12px;
    flex-shrink: 0;
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
