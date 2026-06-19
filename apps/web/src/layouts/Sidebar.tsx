import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Icon, CrestlyLogo, type IconName } from "@crestly/icons";
import { useAuth } from "@/lib/auth-store";
import { BrandDot } from "@/components/BrandDot";

type Tint = "mint" | "peach" | "rose" | "mustard" | "wheat" | "sky";

interface NavEntry {
  to: string;
  end?: boolean;
  label: string;
  icon: IconName;
  tint: Tint;
  perm?: string;
  badge?: number;
}
interface NavGroup {
  title?: string;
  items: NavEntry[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ to: "/", end: true, label: "Dashboard", icon: "dashboard", tint: "wheat", perm: "dashboard.view" }],
  },
  {
    title: "My Day",
    items: [
      { to: "/diary", label: "Daily Diary", icon: "diary", tint: "wheat", perm: "diary.log" },
      { to: "/leaves", label: "My Leaves", icon: "leaves", tint: "sky", perm: "leaves.apply" },
      { to: "/punch", label: "Punch In / Out", icon: "punch", tint: "mint", perm: "staff.punch" },
      { to: "/review-history", label: "Review History", icon: "review-history", tint: "mint" },
      { to: "/salary", label: "Salary", icon: "salary", tint: "mustard" },
      { to: "/staff-attendance", label: "Staff Attendance", icon: "staff-attendance", tint: "rose", perm: "staff.view_team" },
    ],
  },
  {
    title: "Records",
    items: [
      { to: "/attendance", label: "Attendance", icon: "attendance", tint: "sky", perm: "attendance.mark" },
      { to: "/classes", label: "Classes", icon: "classes", tint: "wheat", perm: "classes.view" },
      { to: "/exams", label: "Exams", icon: "exams", tint: "mustard", perm: "exams.view" },
      { to: "/families", label: "Families", icon: "families", tint: "rose" },
      { to: "/hostel", label: "Hostel", icon: "hostel", tint: "peach" },
      { to: "/streams", label: "Streams", icon: "streams", tint: "sky", perm: "students.view" },
      { to: "/students", label: "Students", icon: "students", tint: "mint", perm: "students.view" },
      { to: "/team", label: "Team", icon: "team", tint: "rose", perm: "team.view" },
      { to: "/timetable", label: "Timetable", icon: "timetable", tint: "sky", perm: "timetable.view" },
    ],
  },
  {
    title: "Admission",
    items: [
      { to: "/admissions", label: "Enquiries", icon: "admissions", tint: "wheat", perm: "admissions.view" },
      { to: "/admissions/followups", label: "Follow-ups", icon: "follow-ups", tint: "sky", perm: "admissions.view" },
    ],
  },
  {
    title: "Finance",
    items: [
      { to: "/daily-report", label: "Daily Report", icon: "daily-report", tint: "wheat", perm: "ledger.view" },
      { to: "/fee-ledger", label: "Fee Ledger", icon: "fee-ledger", tint: "mustard", perm: "fees.view" },
      { to: "/fee-structure", label: "Fee Structure", icon: "fee-structure", tint: "rose", perm: "fee_structure.view" },
      { to: "/ledger", label: "Expense Ledger", icon: "ledger", tint: "peach", perm: "ledger.view" },
      { to: "/vouchers", label: "Vouchers", icon: "vouchers", tint: "rose", perm: "vouchers.create" },
    ],
  },
  {
    title: "Logistics",
    items: [{ to: "/transport", label: "Transport", icon: "transport", tint: "sky" }],
  },
  {
    title: "HR",
    items: [
      { to: "/hr", label: "HR Dashboard", icon: "hr", tint: "rose", perm: "hr.dashboard" },
      { to: "/approvals", label: "Approvals", icon: "approvals", tint: "mint" },
      { to: "/promotion", label: "Promotion", icon: "promotion", tint: "mustard", perm: "students.promote" },
      { to: "/import", label: "Import", icon: "import", tint: "peach" },
      { to: "/notifications", label: "Notifications", icon: "notifications", tint: "wheat" },
      { to: "/shifts", label: "Duty Hours", icon: "shifts", tint: "sky", perm: "shifts.manage" },
      { to: "/holidays", label: "Holidays", icon: "holidays", tint: "mint" },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/settings", label: "Settings", icon: "settings", tint: "wheat" },
      { to: "/features", label: "Upgrade Plan", icon: "features", tint: "mustard" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Persistent collapsed-state                                          */
/* ------------------------------------------------------------------ */

const COLLAPSED_KEY = "crestly.sidebar.collapsed-groups";

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}
function persistCollapsed(s: Set<string>) {
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...s])); } catch { /* localStorage disabled — silent */ }
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

export function Sidebar({ schoolName }: { schoolName: string }) {
  const { user } = useAuth();
  const session = "2025-26";  // TODO: hydrate from /api/sessions/current
  const location = useLocation();

  const can = (perm?: string) => !perm || (user?.permissions ?? []).includes(perm);
  const visibleGroups = useMemo(
    () => NAV_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) }))
      .filter((g) => g.items.length > 0),
    [user],  // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed());

  function toggleGroup(title: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      persistCollapsed(next);
      return next;
    });
  }

  // Auto-expand any group whose item is currently active so the user
  // never lands on a "I can see it's selected but the group is closed"
  // confusing state.
  useEffect(() => {
    const activeGroup = visibleGroups.find((g) =>
      g.title && g.items.some((i) => i.end ? location.pathname === i.to : location.pathname.startsWith(i.to))
    );
    if (activeGroup?.title && collapsed.has(activeGroup.title)) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(activeGroup.title!);
        persistCollapsed(next);
        return next;
      });
    }
  }, [location.pathname, visibleGroups]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className="app__nav nav--rich" id="app-nav">
      {/* Brand-block — mobile drawer only */}
      <Link to="/" className="nav-brand brand-block--mobile-only" style={{ textDecoration: "none", color: "inherit" }}>
        <div className="nav-brand__logo">
          <CrestlyLogo width={28} height={28} />
        </div>
        <div className="nav-brand__txt">
          <div className="nav-brand__name">{schoolName}<BrandDot /></div>
          <div className="nav-brand__sub">School ERP</div>
        </div>
      </Link>

      {/* Session chip — clickable shortcut to /sessions */}
      <Link to="/sessions" className="nav-session" style={{ textDecoration: "none", color: "inherit" }}>
        <span className="nav-session__icon">
          <Icon name="calendar" size={14} />
        </span>
        <span className="nav-session__body">
          <span className="nav-session__lbl">ACADEMIC SESSION</span>
          <span className="nav-session__val">{session}</span>
        </span>
        <Icon name="chev-right" size={14} />
      </Link>

      {/* Scrollable nav region */}
      <nav className="nav-scroll" aria-label="Main navigation">
        {visibleGroups.map((group, idx) => {
          const key = group.title ?? `g${idx}`;
          const isCollapsed = group.title ? collapsed.has(group.title) : false;
          return (
            <div key={key} className="nav-group">
              {group.title && (
                <button
                  type="button"
                  className="nav-group__head"
                  onClick={() => toggleGroup(group.title!)}
                  aria-expanded={!isCollapsed}
                >
                  <span className="nav-group__title">{group.title}</span>
                  <span className={`nav-group__chev ${isCollapsed ? "is-collapsed" : ""}`}>
                    <Icon name="chev-down" size={12} />
                  </span>
                </button>
              )}
              {!isCollapsed && (
                <div className="nav-group__items">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => `nav-row ${isActive ? "is-active" : ""}`}
                      style={{ textDecoration: "none" }}
                    >
                      <span className={`nav-row__icon icon-tint-${item.tint}`}>
                        <Icon name={item.icon} size={14} />
                      </span>
                      <span className="nav-row__label">{item.label}</span>
                      {item.badge && item.badge > 0 && (
                        <span className="nav-row__badge">{item.badge}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <style>{SIDEBAR_CSS}</style>
    </aside>
  );
}

/* ============================================================
   Scoped under .nav--rich so the new look doesn't fight with
   any existing .app__nav rules from @crestly/design.
   ============================================================ */

const SIDEBAR_CSS = `
  .nav--rich {
    padding: 14px 12px;
    gap: 10px;
    background: var(--white);
  }

  /* ── Brand (mobile drawer only) ─────────────────────────── */
  .nav--rich .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px 12px;
    border-bottom: 1px solid var(--rule);
    margin-bottom: 4px;
  }
  .nav--rich .nav-brand__logo {
    width: 36px; height: 36px;
    border-radius: 9px;
    background: var(--ink);
    color: var(--cream);
    display: inline-flex;
    align-items: center; justify-content: center;
  }
  .nav--rich .nav-brand__name {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 15px;
    color: var(--ink);
  }
  .nav--rich .nav-brand__sub {
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-60);
    margin-top: 1px;
  }

  /* ── Session chip ───────────────────────────────────────── */
  .nav--rich .nav-session {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    background: linear-gradient(135deg, var(--cream) 0%, var(--cream-soft) 100%);
    border: 1px solid var(--cream-deep);
    border-radius: 10px;
    color: var(--ink);
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .nav--rich .nav-session:hover {
    border-color: var(--orange);
    box-shadow: 0 0 0 3px rgba(242, 92, 25, 0.08);
  }
  .nav--rich .nav-session__icon {
    width: 32px; height: 32px;
    border-radius: 8px;
    background: var(--white);
    border: 1px solid var(--cream-deep);
    color: var(--orange);
    display: inline-flex;
    align-items: center; justify-content: center;
  }
  .nav--rich .nav-session__body {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.1;
  }
  .nav--rich .nav-session__lbl {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.14em;
    color: var(--ink-60);
  }
  .nav--rich .nav-session__val {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 15px;
    color: var(--ink);
    margin-top: 1px;
  }

  /* ── Scroll region ──────────────────────────────────────── */
  .nav--rich .nav-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0 -8px;
    padding: 0 8px 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--rule-strong) transparent;
  }
  .nav--rich .nav-scroll::-webkit-scrollbar { width: 6px; }
  .nav--rich .nav-scroll::-webkit-scrollbar-thumb {
    background: var(--rule);
    border-radius: 3px;
  }
  .nav--rich .nav-scroll::-webkit-scrollbar-thumb:hover { background: var(--rule-strong); }
  .nav--rich .nav-scroll::-webkit-scrollbar-track { background: transparent; }

  /* ── Group ──────────────────────────────────────────────── */
  .nav--rich .nav-group { display: flex; flex-direction: column; }
  .nav--rich .nav-group + .nav-group { margin-top: 8px; }

  .nav--rich .nav-group__head {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px 4px;
    border: 0;
    background: transparent;
    cursor: pointer;
    font: inherit;
    text-align: left;
    color: var(--ink-40);
    transition: color 120ms ease;
  }
  .nav--rich .nav-group__head:hover { color: var(--ink-80); }
  .nav--rich .nav-group__title {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .nav--rich .nav-group__chev {
    display: inline-flex;
    transition: transform 160ms ease;
    color: var(--ink-40);
  }
  .nav--rich .nav-group__chev.is-collapsed {
    transform: rotate(-90deg);
  }
  .nav--rich .nav-group__items { display: flex; flex-direction: column; gap: 1px; }

  /* ── Row ────────────────────────────────────────────────── */
  .nav--rich .nav-row {
    display: grid;
    grid-template-columns: 28px 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    color: var(--ink-80);
    position: relative;
    transition: background 80ms ease, color 80ms ease;
  }
  .nav--rich .nav-row:hover {
    background: var(--cream-soft);
    color: var(--ink);
  }
  .nav--rich .nav-row.is-active {
    background: var(--ink);
    color: var(--cream);
  }
  /* Subtle orange accent bar on the left when active */
  .nav--rich .nav-row.is-active::before {
    content: "";
    position: absolute;
    left: -4px;
    top: 6px; bottom: 6px;
    width: 3px;
    border-radius: 3px;
    background: var(--orange);
  }
  .nav--rich .nav-row__icon {
    width: 28px; height: 28px;
    border-radius: 7px;
    display: inline-flex;
    align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .nav--rich .nav-row.is-active .nav-row__icon {
    background: var(--orange) !important;
    color: #fff !important;
  }
  .nav--rich .nav-row__label {
    font-size: 13.5px;
    font-weight: 500;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .nav--rich .nav-row.is-active .nav-row__label { font-weight: 600; }

  .nav--rich .nav-row__badge {
    background: var(--orange-tint);
    color: var(--orange-deep);
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
    line-height: 1.5;
  }
  .nav--rich .nav-row.is-active .nav-row__badge {
    background: var(--orange);
    color: #fff;
  }

`;
