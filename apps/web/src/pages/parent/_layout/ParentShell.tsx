import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CrestlyLogo, Icon, type IconName } from "@crestly/icons";
import { parentAuthStore, useParentAuth } from "@/lib/parent-auth-store";
import { parentApi } from "@/lib/parent-api";

/* ============================================================
   Parent shell — sticky dark topbar at top, bottom nav at the
   bottom, page content in between. Mounted on every /parent/*
   route (except /parent/login).

   The topbar shows the school logo + name (fetched from the
   public /parent/school-info), the bottom nav has the 6 PHP
   tabs (Home / Attendance / Exams / Fees / Contact / More).
   ============================================================ */

const NAV_TABS: { to: string; icon: IconName; label: string; end?: boolean }[] = [
  { to: "/parent",            icon: "dashboard",  label: "Home", end: true },
  { to: "/parent/attendance", icon: "attendance", label: "Attendance" },
  { to: "/parent/exams",      icon: "exams",      label: "Exams" },
  { to: "/parent/fees",       icon: "fee-ledger", label: "Fees" },
  { to: "/parent/contact",    icon: "phone",      label: "Contact" },
  { to: "/parent/more",       icon: "menu",       label: "More" },
];

export function ParentShell() {
  const { token } = useParentAuth();
  const navigate = useNavigate();

  // Bounce to login if the token vanished mid-session.
  if (!token) {
    navigate("/parent/login", { replace: true });
  }

  const { data: school } = useQuery({
    queryKey: ["parent", "school-info"],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => (await parentApi.get<{ name: string }>("/parent/school-info")).data,
  });
  const schoolName = school?.name?.trim() || "School";

  return (
    <>
      <style>{SHELL_CSS}</style>

      <header className="ps-top">
        <div className="ps-top__logo">
          <CrestlyLogo width={22} height={22} />
        </div>
        <div className="ps-top__id">
          <div className="ps-top__name">{schoolName}</div>
          <div className="ps-top__sub">PARENT PORTAL</div>
        </div>
        <button
          type="button"
          className="ps-top__logout"
          onClick={() => { parentAuthStore.clear(); navigate("/parent/login", { replace: true }); }}
          title="Log out"
          aria-label="Log out"
        >
          <Icon name="logout" size={15} />
        </button>
      </header>

      <main className="ps-main">
        <Outlet />
      </main>

      <nav className="ps-nav" aria-label="Parent portal navigation">
        {NAV_TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => "ps-nav__tab " + (isActive ? "is-on" : "")}
          >
            <Icon name={t.icon} size={18} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}

const SHELL_CSS = `
  /* Sticky dark topbar */
  .ps-top {
    position: sticky; top: 0; z-index: 30;
    display: flex; align-items: center; gap: 12px;
    padding: 12px 18px;
    background: var(--ink);
    color: var(--cream);
    box-shadow: 0 1px 0 rgba(255,255,255,.05);
  }
  .ps-top__logo {
    width: 36px; height: 36px;
    border-radius: 9px;
    background: var(--cream);
    color: var(--ink);
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .ps-top__id { flex: 1; min-width: 0; }
  .ps-top__name {
    font-family: var(--font-display, system-ui);
    font-weight: 800; font-size: 15px;
    line-height: 1.1; letter-spacing: -.01em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ps-top__sub {
    font-family: var(--font-mono, monospace);
    font-size: 9.5px; letter-spacing: .12em;
    color: rgba(248,240,226,.5);
    text-transform: uppercase;
  }
  .ps-top__logout {
    width: 32px; height: 32px; border-radius: 50%;
    background: rgba(255,255,255,.08);
    color: var(--cream);
    border: 0; cursor: pointer;
    display: grid; place-items: center;
  }
  .ps-top__logout:hover { background: rgba(255,255,255,.15); }

  /* Main scroll area, padded for the fixed bottom nav. */
  .ps-main {
    min-height: calc(100vh - 60px);
    padding-bottom: 88px;
    background: var(--cream);
  }

  /* Fixed bottom nav. */
  .ps-nav {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 30;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    background: var(--white);
    border-top: 1px solid var(--rule);
    box-shadow: 0 -8px 24px rgba(16,13,10,.04);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .ps-nav__tab {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 8px 4px 10px;
    font-size: 10.5px; font-weight: 600;
    color: var(--ink-60);
    text-decoration: none;
    position: relative;
    transition: color .15s ease;
  }
  .ps-nav__tab:hover { color: var(--ink); }
  .ps-nav__tab.is-on {
    color: var(--orange-deep, var(--orange));
  }
  .ps-nav__tab.is-on::before {
    content: "";
    position: absolute; top: 0; left: 25%; right: 25%; height: 2px;
    background: var(--orange);
    border-radius: 0 0 4px 4px;
  }

  /* Desktop: cap the bottom nav width so it floats centered. */
  @media (min-width: 720px) {
    .ps-nav {
      max-width: 560px;
      left: 50%; transform: translateX(-50%);
      bottom: 16px;
      border: 1px solid var(--rule);
      border-radius: 16px;
      box-shadow: 0 16px 36px rgba(16,13,10,.10);
    }
    .ps-main { padding-bottom: 110px; }
  }
`;
