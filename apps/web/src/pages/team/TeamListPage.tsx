import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { StatTile } from "@/components/StatTile";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useTeamList } from "./hooks";
import { useAuth } from "@/lib/auth-store";
import type { TeamMember } from "@crestly/shared";

/* ============================================================
   Team list page — ports erp/team/index.php verbatim.
   Stat tiles · search + department + status filters · department
   pill tabs · members table with avatar, designation, last-login,
   action buttons. Departments hydrate from the API response so the
   pills update as members are added / moved.
   ============================================================ */

function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}
function phoneDisplay(s: string | null): string {
  if (!s) return "—";
  const d = s.replace(/\D+/g, "").replace(/^91/, "").slice(-10);
  if (d.length !== 10) return s;
  return `${d.slice(0, 5)} ${d.slice(5)}`;
}
function fmtLastLogin(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${date} · ${time}`;
}

export function TeamListPage() {
  const { user } = useAuth();
  const canManage = (user?.permissions ?? []).includes("team.manage");
  const canRoles  = (user?.permissions ?? []).includes("team.roles");

  const [params, setParams] = useSearchParams();
  const q          = params.get("q") ?? "";
  const department = params.get("department") ?? "";
  const status     = (params.get("status") ?? "active") as "active" | "inactive" | "all";

  const [qInput, setQInput] = useState(q);

  // Debounce search input → URL
  useMemo(() => {
    const t = setTimeout(() => {
      if (qInput === q) return;
      const next = new URLSearchParams(params);
      if (qInput) next.set("q", qInput); else next.delete("q");
      setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [qInput]);  // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, error, refetch, isFetching } = useTeamList({
    q: q || undefined,
    department: department || undefined,
    status: status === "all" ? undefined : status,
    page: 1,
    pageSize: 200,
  });

  function setParam(key: string, val: string) {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    setParams(next, { replace: true });
  }
  function resetFilters() {
    setQInput("");
    setParams(new URLSearchParams({ status: "active" }), { replace: true });
  }

  const heading = department || "Members";
  const totalActiveAll = data?.totalActive ?? 0;
  const totalInactive  = data?.totalInactive ?? 0;

  return (
    <>
      <PageHead
        group="RECORDS"
        meta="TEAM"
        title="Team"
        lede="Every employee with a Crestly login — teachers, admins, drivers, support staff. Filter by department or status; jump into a profile for the full record."
        actions={
          <>
            {canRoles && (
              <Link to="/team/roles" className="btn btn--ink btn--sm">
                <Icon name="settings" size={14} /> Roles & permissions
              </Link>
            )}
            {canManage && (
              <Link to="/team/new" className="btn btn--primary btn--sm">
                <Icon name="plus" size={14} /> Add member
              </Link>
            )}
          </>
        }
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="team members" />

      {/* Stat tiles */}
      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile
          tint="mint"
          icon="team"
          label="ACTIVE MEMBERS"
          value={totalActiveAll.toLocaleString("en-IN")}
          delta={`${totalInactive.toLocaleString("en-IN")} inactive`}
        />
        <StatTile
          tint="mustard"
          icon="features"
          label="ROLES"
          value={String(data?.rolesCount ?? "—")}
          delta="Admin · Principal · Teacher · …"
        />
        <StatTile
          tint="sky"
          icon="hr"
          label="YOUR ROLE"
          value={user?.roleName ?? "—"}
          delta={`${user?.permissions.length ?? 0} permissions`}
        />
        <StatTile
          tint="wheat"
          icon="settings"
          label="EDIT ROLES"
          value={canRoles ? "Open →" : "Locked"}
          delta="Permission matrix"
        />
      </div>

      {/* Toolbar */}
      <div
        className="toolbar card"
        style={{ padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
      >
        <div className="search" style={{ flex: 1, minWidth: 200 }}>
          <Icon name="search" size={14} />
          <input
            type="search"
            placeholder="Search name, designation, phone…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 14 }}
          />
        </div>
        <select
          className="select"
          value={department}
          onChange={(e) => setParam("department", e.target.value)}
        >
          <option value="">All departments</option>
          {(data?.departments ?? []).map((d) => (
            <option key={d.department} value={d.department}>
              {d.department} · {d.count}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={status}
          onChange={(e) => setParam("status", e.target.value)}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
        {(q || department || status !== "active") && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={resetFilters}>
            Reset
          </button>
        )}
      </div>

      {/* Department pill row */}
      <nav className="dept-tabs" aria-label="Filter by department">
        <button
          type="button"
          className={`dept-tab ${department === "" ? "is-active" : ""}`}
          onClick={() => setParam("department", "")}
        >
          All
          <span className="dept-tab__count">{totalActiveAll.toLocaleString("en-IN")}</span>
        </button>
        {(data?.departments ?? []).map((d) => (
          <button
            key={d.department}
            type="button"
            className={`dept-tab ${d.department === department ? "is-active" : ""}`}
            onClick={() => setParam("department", d.department)}
          >
            {d.department}
            <span className="dept-tab__count">{d.count.toLocaleString("en-IN")}</span>
          </button>
        ))}
      </nav>

      {/* Members table */}
      <div className="table-card">
        <div className="table-card__head">
          <div>
            <h3 className="table-card__title">{heading}<BrandDot /></h3>
            <div className="table-card__sub">
              {(data?.items.length ?? 0).toLocaleString("en-IN")} matching
              {department && <> · <span className="muted">department</span></>}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 16 }}><Skeleton.Table rows={8} cols={6} /></div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO MEMBERS</div>
            <div className="muted body-s">
              {canManage
                ? <>No members match the current filter. <Link to="/team/new">Add a member</Link>.</>
                : "No members match the current filter."}
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Department · Designation</th>
                <th>Mobile · Login</th>
                <th>Last login</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((m) => (
                <TeamRow
                  key={m.id}
                  m={m}
                  isMe={m.id === user?.id}
                  canManage={canManage}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{TEAM_LIST_CSS}</style>
    </>
  );
}

function TeamRow({
  m, isMe, canManage,
}: {
  m: TeamMember;
  isMe: boolean;
  canManage: boolean;
}) {
  return (
    <tr>
      <td className="td-name">
        <Link to={`/team/${m.id}`} className="team-row__name-link">
          <span className="avatar avatar--cream avatar--sm">
            {initials(m.name)}
          </span>
          <span className="team-row__name-stack">
            <span>
              {m.name}
              {isMe && (
                <span
                  className="pill pill--neutral"
                  style={{ fontSize: 9.5, padding: "1px 7px", marginLeft: 6 }}
                >
                  YOU
                </span>
              )}
            </span>
            <span className="team-row__sub mono">
              {m.employeeId ? m.employeeId : `#${m.id}`}
            </span>
          </span>
        </Link>
      </td>
      <td>
        {m.department ? (
          <>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{m.department}</div>
            {m.designation && (
              <div className="muted body-s" style={{ fontSize: 12 }}>{m.designation}</div>
            )}
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        <div className="mono" style={{ fontSize: 12.5 }}>{phoneDisplay(m.phone)}</div>
        {m.email && (
          <div className="muted body-s" style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
            {m.email}
          </div>
        )}
      </td>
      <td className="muted body-s">{fmtLastLogin(m.lastLoginAt)}</td>
      <td>
        {m.status === "active" ? (
          <span className="pill pill--success">
            <span className="pill__dot" />Active
          </span>
        ) : (
          <span className="pill pill--neutral">Inactive</span>
        )}
      </td>
      <td style={{ textAlign: "right" }}>
        <Link
          to={`/team/${m.id}`}
          className="icon-btn"
          title="View details"
          aria-label="View details"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </Link>
        {canManage && (
          <Link to={`/team/${m.id}/edit`} className="btn btn--ghost btn--sm" style={{ marginLeft: 4 }}>
            Edit
          </Link>
        )}
      </td>
    </tr>
  );
}

const TEAM_LIST_CSS = `
  .dept-tabs {
    display: flex;
    gap: 6px;
    margin: 14px 0;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .dept-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: var(--r-pill);
    background: var(--white);
    border: 1px solid var(--rule);
    font-size: 12.5px;
    color: var(--ink);
    cursor: pointer;
    white-space: nowrap;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .dept-tab:hover { background: var(--cream-soft); }
  .dept-tab.is-active {
    background: var(--ink);
    color: var(--cream);
    border-color: var(--ink);
    font-weight: 600;
  }
  .dept-tab__count {
    font-family: var(--font-mono);
    font-size: 10.5px;
    padding: 1px 6px;
    border-radius: var(--r-pill);
    background: rgba(16,13,10,0.06);
    color: inherit;
  }
  .dept-tab.is-active .dept-tab__count {
    background: rgba(245,239,227,0.18);
  }

  .team-row__name-link {
    display: flex;
    gap: 10px;
    align-items: center;
    text-decoration: none;
    color: inherit;
  }
  .team-row__name-stack { display: flex; flex-direction: column; }
  .team-row__sub {
    font-size: 10.5px;
    color: var(--ink-60);
    letter-spacing: 0.04em;
    margin-top: 1px;
  }

  .icon-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px;
    border-radius: 6px;
    color: var(--ink-60);
    background: transparent;
    border: 0;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }
  .icon-btn:hover { background: var(--cream-soft); color: var(--ink); }
`;
