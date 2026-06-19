import { Link, useNavigate } from "react-router-dom";
import { Icon, type IconName } from "@crestly/icons";
import { parentAuthStore, useParentAuth } from "@/lib/parent-auth-store";
import { useParentHome, useParentMoreInfo } from "./hooks";

export function ParentMorePage() {
  const { parentLabel } = useParentAuth();
  const { data: home } = useParentHome();
  const { data: info } = useParentMoreInfo();
  const navigate = useNavigate();

  // First kid is shown as the default identity badge — for multi-child
  // parents the "Father / Mother / Guardian" label is implied.
  const firstKid = home?.kids?.[0];

  function logout() {
    parentAuthStore.clear();
    navigate("/parent/login", { replace: true });
  }

  return (
    <div className="pm">
      <h1 className="pm__title">More</h1>
      <p className="muted body-s pm__lede">Account, school info, and settings.</p>

      <section className="pm__id">
        <div className="pm__avi">{firstKid ? initials(firstKid.studentName) : "?"}</div>
        <div className="pm__id-body">
          <div className="muted body-s">PARENT</div>
          <div className="pm__name">{parentLabel ?? "Logged in"}</div>
        </div>
      </section>

      <h2 className="pm__h">ACADEMICS</h2>
      <div className="pm__list">
        <MenuLink
          to={firstKid ? `/parent/diary?sr=${firstKid.srNumber}` : "/parent/diary"}
          icon="diary"
          title="Diary & Homework"
          subtitle="What was taught + today's homework"
        />
        <MenuLink
          to={firstKid ? `/parent/timetable?sr=${firstKid.srNumber}` : "/parent/timetable"}
          icon="timetable"
          title="Class Timetable"
          subtitle="Weekly period-wise schedule"
        />
      </div>

      <h2 className="pm__h">SCHOOL</h2>
      <div className="pm__list">
        {info?.address && (
          <MenuLink
            href={info.mapsLink ?? "#"}
            icon="map-pin"
            title={info.schoolName}
            subtitle={info.address}
            tone="rose"
            external
          />
        )}
        {info?.officeHours && (
          <MenuLink
            icon="clock"
            title="Office hours"
            subtitle={info.officeHours}
            tone="wheat"
          />
        )}
        {info?.affiliation && (
          <MenuLink
            icon="library"
            title="Affiliation"
            subtitle={info.affiliation}
            tone="mint"
          />
        )}
      </div>

      <h2 className="pm__h">ACCOUNT</h2>
      <div className="pm__list">
        <button type="button" className="pm__item pm__item--danger" onClick={logout}>
          <span className="pm__ico" style={{ background: "rgba(220, 38, 38, .12)", color: "#dc2626" }}>
            <Icon name="logout" size={15} />
          </span>
          <span className="pm__item-body">
            <span className="pm__item-t" style={{ color: "#dc2626" }}>Sign out</span>
            <span className="muted body-s">End this session on this device</span>
          </span>
        </button>
      </div>

      <footer className="pm__credit muted body-s">
        Powered by <b>Shadowbiz Startups</b> · v1.0
      </footer>

      <style>{PM_CSS}</style>
    </div>
  );
}

function MenuLink({
  to, href, icon, title, subtitle, tone, external,
}: {
  to?: string;
  href?: string;
  icon: IconName;
  title: string;
  subtitle: string;
  tone?: "rose" | "wheat" | "mint";
  external?: boolean;
}) {
  const toneStyle = {
    rose:   { background: "rgba(220, 38, 38, .10)",  color: "#dc2626" },
    wheat:  { background: "var(--tint-wheat, #fcebd6)", color: "var(--orange-deep, #b8410b)" },
    mint:   { background: "rgba(22, 163, 74, .10)",   color: "#16a34a" },
  } as const;
  const ico = tone ? toneStyle[tone] : { background: "var(--cream-soft)", color: "var(--orange-deep, var(--orange))" };

  const inner = (
    <>
      <span className="pm__ico" style={ico}>
        <Icon name={icon} size={15} />
      </span>
      <span className="pm__item-body">
        <span className="pm__item-t">{title}</span>
        <span className="muted body-s">{subtitle}</span>
      </span>
      <Icon name="chev-right" size={13} />
    </>
  );

  if (href) {
    return (
      <a className="pm__item" href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
        {inner}
      </a>
    );
  }
  return <Link className="pm__item" to={to ?? "#"}>{inner}</Link>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

const PM_CSS = `
  .pm { max-width: 720px; margin: 0 auto; padding: 22px 18px 32px; }
  .pm__title { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 22px; letter-spacing: -.02em; margin: 0 0 4px; }
  .pm__lede { margin: 0 0 18px; }

  .pm__id {
    display: flex; gap: 12px; align-items: center;
    background: var(--white); border: 1px solid var(--rule); border-radius: 14px;
    padding: 14px; margin-bottom: 18px;
  }
  .pm__avi {
    width: 56px; height: 56px; border-radius: 14px;
    background: var(--orange);
    color: var(--cream);
    display: grid; place-items: center;
    font-weight: 800; font-size: 18px;
    flex-shrink: 0;
  }
  .pm__name { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 17px; }

  .pm__h {
    font-family: var(--font-mono, monospace);
    font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--ink-40);
    margin: 18px 0 8px; padding-left: 4px;
  }

  .pm__list { background: var(--white); border: 1px solid var(--rule); border-radius: 14px; overflow: hidden; }
  .pm__item {
    display: flex; align-items: center; gap: 12px;
    padding: 14px;
    color: var(--ink); text-decoration: none;
    border: 0; background: var(--white); width: 100%;
    cursor: pointer; font: inherit; text-align: left;
    border-bottom: 1px solid var(--rule-soft);
  }
  .pm__item:last-child { border-bottom: 0; }
  .pm__item:hover { background: var(--cream-soft); }
  .pm__ico {
    width: 34px; height: 34px; border-radius: 8px;
    display: grid; place-items: center; flex-shrink: 0;
  }
  .pm__item-body { flex: 1; min-width: 0; }
  .pm__item-t { display: block; font-weight: 700; font-size: 13.5px; }
  .pm__item > svg:last-child { color: var(--ink-40); flex-shrink: 0; }

  .pm__credit {
    margin-top: 24px; padding-top: 18px;
    border-top: 1px solid var(--rule-soft);
    text-align: center;
    font-family: var(--font-mono, monospace); font-size: 10.5px; letter-spacing: .04em;
  }
  .pm__credit b { color: var(--ink-60); font-weight: 600; }
`;
