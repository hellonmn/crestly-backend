import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { useParentHome } from "./hooks";

/** Home — list of kids with quick-action links into each major page. */
export function ParentHomePage() {
  const { data, isLoading } = useParentHome();
  const kids = data?.kids ?? [];

  return (
    <div className="ph">
      <header className="ph__welcome">
        <span className="label" style={{ color: "var(--orange-deep, var(--orange))" }}>WELCOME</span>
        <h1>{kids.length === 1 ? "Your child" : "Your children"}</h1>
        {data?.parentLabel && <p className="muted">{data.parentLabel}</p>}
      </header>

      {isLoading && <div className="muted">Loading…</div>}

      <div className="ph__grid">
        {kids.map((k) => (
          <article key={k.srNumber} className="ph__kid">
            <div className="ph__kid-head">
              <div className="ph__kid-avatar">{initials(k.studentName)}</div>
              <div className="ph__kid-body">
                <div className="ph__kid-name">{k.studentName}</div>
                <div className="muted body-s">
                  {k.classLabel} · SR {String(k.srNumber).padStart(4, "0")}
                  {k.isHostel && <> · <span className="pill pill--wheat" style={{ fontSize: 9 }}>HOSTEL</span></>}
                </div>
              </div>
            </div>
            <nav className="ph__actions">
              <Link to={`/parent/attendance?sr=${k.srNumber}`} className="ph__act">
                <Icon name="attendance" size={16} /><span>Attendance</span>
              </Link>
              <Link to={`/parent/exams?sr=${k.srNumber}`} className="ph__act">
                <Icon name="exams" size={16} /><span>Exam result</span>
              </Link>
              <Link to={`/parent/fees?sr=${k.srNumber}`} className="ph__act">
                <Icon name="fee-ledger" size={16} /><span>Fees</span>
              </Link>
              <Link to={`/parent/diary?sr=${k.srNumber}`} className="ph__act">
                <Icon name="diary" size={16} /><span>Diary</span>
              </Link>
              <Link to={`/parent/timetable?sr=${k.srNumber}`} className="ph__act">
                <Icon name="timetable" size={16} /><span>Timetable</span>
              </Link>
              <Link to={`/parent/contact?sr=${k.srNumber}`} className="ph__act">
                <Icon name="phone" size={16} /><span>Contact</span>
              </Link>
            </nav>
          </article>
        ))}
      </div>

      <style>{HOME_CSS}</style>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "?").slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

const HOME_CSS = `
  .ph { max-width: 720px; margin: 0 auto; padding: 22px 18px 32px; }
  .ph__welcome { margin-bottom: 22px; }
  .ph__welcome h1 {
    font-family: var(--font-display, system-ui);
    font-weight: 800; font-size: 26px;
    letter-spacing: -.02em; margin: 4px 0 4px;
  }
  .ph__welcome p { margin: 0; font-size: 13.5px; }

  .ph__grid { display: grid; grid-template-columns: 1fr; gap: 14px; }

  .ph__kid {
    background: var(--white); border: 1px solid var(--rule);
    border-radius: 14px; padding: 16px;
  }
  .ph__kid-head { display: flex; gap: 12px; align-items: center; }
  .ph__kid-avatar {
    width: 44px; height: 44px; border-radius: 50%;
    background: var(--tint-wheat, #fcebd6);
    color: var(--orange-deep, #b8410b);
    display: grid; place-items: center;
    font-weight: 800; font-size: 14px;
    flex-shrink: 0;
  }
  .ph__kid-body { flex: 1; min-width: 0; }
  .ph__kid-name { font-weight: 700; font-size: 15px; }

  .ph__actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-top: 14px;
  }
  .ph__act {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 10px 4px;
    background: var(--cream-soft);
    border-radius: 10px;
    color: var(--ink);
    text-decoration: none;
    font-size: 11px; font-weight: 600;
    transition: background .15s ease;
  }
  .ph__act:hover { background: var(--tint-wheat, #fcebd6); }
  .ph__act > svg { color: var(--orange-deep, var(--orange)); }
`;
