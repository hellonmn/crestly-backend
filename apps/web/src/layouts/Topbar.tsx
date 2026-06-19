import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CrestlyLogo, Icon } from "@crestly/icons";
import { authStore, useAuth } from "@/lib/auth-store";
import { BrandDot } from "@/components/BrandDot";
import { useOpenSpotlight } from "@/components/Spotlight";

/**
 * Top app bar — fixed across every viewport, structured as:
 *
 *   [LOGO]  Crestly.            ───  [date pill]  [⌘K search]  [🔔]  [profile▾]
 *           school name
 */
export function Topbar({ schoolName }: { schoolName: string }) {
  const { user } = useAuth();
  const openSpotlight = useOpenSpotlight();

  const dateLabel = useMemo(() => {
    const d = new Date();
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short" }).format(d).toUpperCase();
  }, []);

  return (
    <header className="topbar topbar--rich">
      {/* ── Left: logo + brand stack ───────────────────────── */}
      <Link to="/" className="tb-brand" style={{ textDecoration: "none", color: "inherit" }}>
        <span className="tb-brand__logo">
          <CrestlyLogo width={34} height={34} />
        </span>
        <span className="tb-brand__txt">
          <span className="tb-brand__name">
            {schoolName}
            <BrandDot />
          </span>
          {/* Sub-line only when the school name isn't already "Crestly" —
              otherwise it just duplicates the brand and looks redundant. */}
          {schoolName.toLowerCase() !== "crestly" && (
            <span className="tb-brand__sub">School ERP</span>
          )}
        </span>
      </Link>

      {/* ── Spacer ─────────────────────────────────────────── */}
      <span className="tb-flex" />

      {user && (
        <>
          {/* Date pill — quick "what day is it" anchor */}
          <span className="tb-date" title="Today">
            <Icon name="calendar" size={13} />
            <span>{dateLabel}</span>
          </span>

          {/* Search trigger — looks like a real input, opens Cmd-K */}
          <button type="button" className="tb-search" onClick={openSpotlight} aria-label="Open search">
            <Icon name="search" size={14} />
            <span className="tb-search__label">Search students, vouchers, pages…</span>
            <span className="tb-search__kbd">
              <kbd>{isMac() ? "⌘" : "Ctrl"}</kbd>
              <kbd>K</kbd>
            </span>
          </button>

          {/* Notifications bell — placeholder count = 0; wire to /notifications */}
          <Link to="/notifications" className="tb-bell" aria-label="Notifications" title="Notifications">
            <Icon name="bell" size={18} />
          </Link>

          {/* Profile chip with dropdown */}
          <ProfileMenu name={user.name ?? "User"} roleName={user.roleName ?? null} userId={user.id ?? null} />
        </>
      )}

      {!user && (
        <Link to="/login" className="tb-login">
          <Icon name="users" size={14} />
          Log in
        </Link>
      )}

      <style>{TOPBAR_CSS}</style>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Profile menu                                                        */
/* ------------------------------------------------------------------ */

function ProfileMenu({
  name, roleName, userId,
}: {
  name: string;
  roleName: string | null;
  userId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canSettings = (user?.permissions ?? []).includes("settings.manage") ||
                       user?.roleSlug === "admin" || user?.roleSlug === "principal";

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function go(to: string) { setOpen(false); navigate(to); }
  function logout() {
    setOpen(false);
    if (!window.confirm("Log out?")) return;
    authStore.clear();
    navigate("/login", { replace: true });
  }

  const initials = (name.match(/\b\w/g) ?? []).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <div className="tb-prof" ref={ref}>
      <button
        type="button"
        className={`tb-prof__btn ${open ? "is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={name}
      >
        <span className="tb-prof__avi">{initials}</span>
        <span className="tb-prof__stack">
          <span className="tb-prof__name">{name}</span>
          {roleName && <span className="tb-prof__role">{roleName}</span>}
        </span>
        <span className="tb-prof__chev" aria-hidden="true">
          <Icon name="chev-down" size={14} />
        </span>
      </button>

      {open && (
        <div className="tb-prof__menu" role="menu">
          <div className="tb-prof__menu-head">
            <span className="tb-prof__avi" style={{ width: 44, height: 44, fontSize: 16 }}>{initials}</span>
            <div className="tb-prof__stack" style={{ minWidth: 0 }}>
              <span className="tb-prof__name" style={{ fontSize: 15 }}>{name}</span>
              {roleName && <span className="tb-prof__role">{roleName}</span>}
            </div>
          </div>

          <div className="tb-prof__sep" />

          {userId !== null && (
            <MenuItem icon="users" onClick={() => go(`/team/${userId}`)} label="My profile" sub="View your team record" />
          )}
          {canSettings && (
            <MenuItem icon="settings" onClick={() => go("/settings")} label="Settings" sub="School identity, geofence, punch" />
          )}
          <MenuItem icon="ledger" onClick={() => go("/sessions")} label="Sessions" sub="Switch academic year" />

          <div className="tb-prof__sep" />

          <MenuItem icon="logout" onClick={logout} label="Log out" sub="End this session" danger />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon, label, sub, onClick, danger,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  sub?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`tb-prof__item ${danger ? "is-danger" : ""}`}
      onClick={onClick}
    >
      <span className="tb-prof__item-ico">
        <Icon name={icon} size={14} />
      </span>
      <span className="tb-prof__item-txt">
        <span className="tb-prof__item-label">{label}</span>
        {sub && <span className="tb-prof__item-sub">{sub}</span>}
      </span>
    </button>
  );
}

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/* ============================================================
   Styles — scoped under .topbar--rich so they only apply to
   this richer redesign and don't clash with any existing
   .topbar__* rules from the design system.
   ============================================================ */

const TOPBAR_CSS = `
  /* ── Brand ─────────────────────────────────────────────── */
  .topbar--rich .tb-brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 4px 6px;
    border-radius: 10px;
    flex: 0 0 auto;
    transition: background 120ms ease;
  }
  .topbar--rich .tb-brand:hover { background: var(--cream-soft); }

  .topbar--rich .tb-brand__logo {
    display: inline-flex;
    align-items: center; justify-content: center;
    width: 38px; height: 38px;
    border-radius: 10px;
    background: var(--ink);
    color: var(--cream);
    flex-shrink: 0;
  }
  .topbar--rich .tb-brand__logo svg { display: block; }

  .topbar--rich .tb-brand__txt {
    display: flex; flex-direction: column;
    min-width: 0;
    line-height: 1.05;
  }
  .topbar--rich .tb-brand__name {
    font-family: var(--font-display);
    font-weight: 900;
    font-size: 19px;
    letter-spacing: -0.025em;
    color: var(--ink);
  }
  .topbar--rich .tb-brand__sub {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-60);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
  }

  .tb-flex { flex: 1; }

  /* ── Date pill ─────────────────────────────────────────── */
  .topbar--rich .tb-date {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--cream);
    border-radius: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    color: var(--ink-80);
  }

  /* ── Search ────────────────────────────────────────────── */
  .topbar--rich .tb-search {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    min-width: 280px;
    background: var(--cream-soft);
    border: 1px solid var(--rule);
    border-radius: 10px;
    color: var(--ink-60);
    cursor: text;
    font: inherit;
    font-size: 13px;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .topbar--rich .tb-search:hover {
    background: var(--white);
    border-color: var(--orange);
    color: var(--ink);
  }
  .topbar--rich .tb-search__label {
    flex: 1;
    text-align: left;
    color: var(--ink-60);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .topbar--rich .tb-search__kbd {
    display: inline-flex; gap: 2px;
  }
  .topbar--rich .tb-search__kbd kbd {
    background: var(--white);
    border: 1px solid var(--rule);
    border-radius: 4px;
    padding: 1px 6px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-60);
    line-height: 1;
  }

  /* ── Bell button ───────────────────────────────────────── */
  .topbar--rich .tb-bell {
    display: inline-flex;
    align-items: center; justify-content: center;
    width: 38px; height: 38px;
    border-radius: 10px;
    background: var(--cream-soft);
    border: 1px solid var(--rule);
    color: var(--ink-80);
    text-decoration: none;
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  }
  .topbar--rich .tb-bell:hover {
    background: var(--white);
    color: var(--ink);
    border-color: var(--orange);
  }

  /* ── Profile chip + menu ───────────────────────────────── */
  .topbar--rich .tb-prof { position: relative; }
  .topbar--rich .tb-prof__btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 5px 10px 5px 6px;
    background: var(--ink);
    border: 1px solid var(--ink);
    border-radius: 10px;
    cursor: pointer;
    color: var(--cream);
    font: inherit;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .topbar--rich .tb-prof__btn:hover,
  .topbar--rich .tb-prof__btn.is-open {
    background: var(--ink-90);
    border-color: var(--orange);
  }
  .topbar--rich .tb-prof__avi {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: var(--orange);
    color: #fff;
    display: inline-flex; align-items: center; justify-content: center;
    font-weight: 800;
    font-size: 13px;
    flex-shrink: 0;
  }
  .topbar--rich .tb-prof__stack {
    display: flex; flex-direction: column;
    min-width: 0;
    line-height: 1.15;
    text-align: left;
  }
  /* Inside the dark profile button — cream so it shows against ink. */
  .topbar--rich .tb-prof__btn .tb-prof__name {
    font-weight: 700;
    font-size: 13px;
    color: var(--cream);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
  }
  .topbar--rich .tb-prof__btn .tb-prof__role {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--cream-deep);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-top: 2px;
  }
  /* Inside the white dropdown menu — ink so it shows against white. */
  .topbar--rich .tb-prof__menu-head .tb-prof__name {
    font-weight: 700;
    font-size: 15px;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }
  .topbar--rich .tb-prof__menu-head .tb-prof__role {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-60);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-top: 2px;
  }
  .topbar--rich .tb-prof__chev {
    display: inline-flex;
    color: var(--cream-deep);
    transition: transform 120ms ease;
  }
  .topbar--rich .tb-prof__btn.is-open .tb-prof__chev { transform: rotate(180deg); }

  /* Menu */
  .topbar--rich .tb-prof__menu {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    min-width: 280px;
    background: var(--white);
    border: 1px solid var(--rule);
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(16,13,10,0.18), 0 4px 12px rgba(16,13,10,0.08);
    padding: 6px;
    z-index: 200;
    animation: tb-menu-in 120ms cubic-bezier(.2,.9,.3,1.1);
  }
  @keyframes tb-menu-in {
    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }
  .topbar--rich .tb-prof__menu-head {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 12px;
  }
  .topbar--rich .tb-prof__sep {
    height: 1px;
    background: var(--rule);
    margin: 4px 0;
  }
  .topbar--rich .tb-prof__item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 10px;
    background: transparent;
    border: 0;
    border-radius: 8px;
    color: var(--ink);
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: background 80ms ease;
  }
  .topbar--rich .tb-prof__item:hover { background: var(--cream-soft); }
  .topbar--rich .tb-prof__item.is-danger:hover {
    background: rgba(184, 53, 32, 0.06);
    color: var(--error);
  }
  .topbar--rich .tb-prof__item-ico {
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px;
    border-radius: 8px;
    background: var(--cream);
    color: var(--ink-60);
    flex-shrink: 0;
  }
  .topbar--rich .tb-prof__item.is-danger .tb-prof__item-ico {
    background: rgba(184, 53, 32, 0.1);
    color: var(--error);
  }
  .topbar--rich .tb-prof__item-txt { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
  .topbar--rich .tb-prof__item-label { font-weight: 600; font-size: 13px; }
  .topbar--rich .tb-prof__item-sub { font-size: 11px; color: var(--ink-60); margin-top: 1px; }

  /* ── Responsive collapse ───────────────────────────────── */
  @media (max-width: 1100px) {
    .topbar--rich .tb-search { min-width: 200px; }
    .topbar--rich .tb-search__label { font-size: 12px; }
  }
  @media (max-width: 900px) {
    .topbar--rich .tb-date { display: none; }
    .topbar--rich .tb-brand__sub { display: none; }
    .topbar--rich .tb-search__label { display: none; }
    .topbar--rich .tb-search { min-width: 0; padding: 8px 12px; gap: 8px; }
  }
  @media (max-width: 600px) {
    .topbar--rich .tb-search { padding: 8px; }
    .topbar--rich .tb-search__kbd { display: none; }
    .topbar--rich .tb-prof__stack { display: none; }
    .topbar--rich .tb-prof__chev { display: none; }
    .topbar--rich .tb-prof__btn { padding: 4px; }
    .topbar--rich .tb-bell { width: 34px; height: 34px; }
  }

  /* ── Login fallback (signed-out) ───────────────────────── */
  .tb-login {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 14px;
    background: var(--orange);
    color: #fff;
    border-radius: 10px;
    text-decoration: none;
    font-weight: 600;
    font-size: 13px;
  }
  .tb-login:hover { background: var(--orange-deep); }
`;
