import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import type { PartnerSchoolStatus, SchoolListResponse } from "@crestly/shared";

const STATUS_PILL: Record<PartnerSchoolStatus, string> = {
  active: "pill--success", onboarding: "pill--warn", suspended: "pill--error",
};

export function SchoolsPage() {
  const [status, setStatus] = useState<PartnerSchoolStatus | "all">("all");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["super", "schools"],
    queryFn: async () => (await api.get<SchoolListResponse>("/superadmin/schools")).data,
  });

  const filtered = (data?.items ?? [])
    .filter((s) => status === "all" || s.status === status)
    .filter((s) => {
      if (!q) return true;
      const v = q.toLowerCase();
      return s.name.toLowerCase().includes(v) || s.slug.includes(v.toLowerCase()) ||
             (s.contactPerson ?? "").toLowerCase().includes(v) ||
             (s.contactEmail ?? "").toLowerCase().includes(v);
    });

  return (
    <>
      <PageHead
        group="TENANTS"
        title="Schools"
        lede={data ? `${data.totals.all.toLocaleString("en-IN")} partner schools` : "Loading…"}
        actions={
          <Link to="/onboard" className="btn btn--primary btn--sm">
            <Icon name="plus" size={14} /> Onboard
          </Link>
        }
      />

      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile tint="mustard" icon="users" label="ALL SCHOOLS" value={String(data?.totals.all ?? "—")} delta="" />
        <StatTile tint="mint" icon="check" label="ACTIVE" value={String(data?.totals.active ?? "—")} delta="" />
        <StatTile tint="wheat" icon="alert" label="ONBOARDING" value={String(data?.totals.onboarding ?? "—")} delta="" />
        <StatTile tint="rose" icon="x" label="SUSPENDED" value={String(data?.totals.suspended ?? "—")} delta="" />
      </div>

      <div className="toolbar card">
        <div className="search">
          <Icon name="search" size={14} />
          <input type="search" placeholder="Search by name, slug, contact…" value={q} onChange={(e) => setQ(e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 14 }} />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(["all", "active", "onboarding", "suspended"] as const).map((s) => (
            <button key={s} className={`btn btn--sm ${status === s ? "btn--ink" : "btn--ghost"}`} onClick={() => setStatus(s as PartnerSchoolStatus | "all")}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="table-card">
        {isLoading ? (
          <Skeleton.Table rows={6} cols={7} />
        ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th><th>Name</th><th>Slug</th><th>City</th><th>Contact</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td className="td-sr mono">{s.id}</td>
                <td className="td-name">
                  <Link to={`/schools/${s.id}`} style={{ textDecoration: "none", color: "inherit" }}>{s.name}</Link>
                </td>
                <td className="mono">{s.slug}</td>
                <td className="muted">{s.city ?? "—"}{s.state ? `, ${s.state}` : ""}</td>
                <td className="muted">
                  {s.contactPerson ?? "—"}
                  {s.contactPhone && <div className="mono body-s">{s.contactPhone}</div>}
                </td>
                <td>
                  <span className={`pill ${STATUS_PILL[s.status]}`}>
                    <span className="pill__dot" />{s.status}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link to={`/schools/${s.id}`} className="btn btn--ghost btn--sm">
                    Open <Icon name="chev-right" size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </>
  );
}
