
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { api, getErrorMessage } from "@/lib/api";
import type {
  PartnerSchoolDetail, PartnerSchoolStatus, SchoolFeatureToggle,
  FeaturesCatalogResponse,
} from "@crestly/shared";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

const STATUS_PILL: Record<PartnerSchoolStatus, string> = {
  active: "pill--success", onboarding: "pill--warn", suspended: "pill--error",
};

export function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const schoolId = Number(id);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["super", "school", schoolId],
    enabled: !Number.isNaN(schoolId),
    queryFn: async () => (await api.get<PartnerSchoolDetail>(`/superadmin/schools/${schoolId}`)).data,
  });

  const features = useQuery({
    queryKey: ["super", "school-features", schoolId],
    enabled: !Number.isNaN(schoolId),
    queryFn: async () => (await api.get<FeaturesCatalogResponse>(`/superadmin/schools/${schoolId}/features`)).data,
  });

  const testConn = useMutation({
    mutationFn: async () =>
      (await api.post<{ ok: true; tablesSeen: number } | { ok: false; error: string }>(`/superadmin/schools/${schoolId}/test-connection`)).data,
  });

  const resetPw = useMutation({
    mutationFn: async () =>
      (await api.post<{ ok: true; tempPassword: string }>(`/superadmin/schools/${schoolId}/reset-admin-password`)).data,
  });

  const changeStatus = useMutation({
    mutationFn: async (status: PartnerSchoolStatus) =>
      (await api.post<PartnerSchoolDetail>(`/superadmin/schools/${schoolId}/status`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["super", "school", schoolId] }),
  });

  const toggleFeature = useMutation({
    mutationFn: async (body: SchoolFeatureToggle) =>
      (await api.post(`/superadmin/schools/${schoolId}/features/toggle`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["super", "school-features", schoolId] }),
  });

  if (isLoading) return <p className="muted">Loading…</p>;
  if (error || !data) return <div className="banner banner--error"><span>School not found.</span></div>;

  return (
    <>
      <PageHead
        group="TENANTS"
        meta={`SCHOOL #${data.id}`}
        title={data.name}
        lede={[data.slug, data.contactPerson, data.city, data.state].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link to="/schools" className="btn btn--ghost btn--sm">
              <Icon name="chev-left" size={14} /> Back
            </Link>
            <Link to={`/schools/${data.id}/edit`} className="btn btn--primary btn--sm">
              <Icon name="edit" size={14} /> Edit
            </Link>
          </>
        }
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className={`pill ${STATUS_PILL[data.status]}`}>
          <span className="pill__dot" />{data.status}
        </span>
        {(["active", "onboarding", "suspended"] as PartnerSchoolStatus[]).filter((s) => s !== data.status).map((s) => (
          <button
            key={s}
            className="btn btn--ghost btn--sm"
            disabled={changeStatus.isPending}
            onClick={() => { if (confirm(`Switch ${data.name} to ${s}?`)) changeStatus.mutate(s); }}
          >
            Switch to {s}
          </button>
        ))}
      </div>

      <div className="grid grid--split grid--gap-lg">
        <div className="card">
          <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>Profile</div>
          <Row k="Plan" v={data.plan ?? "—"} />
          <Row k="Address" v={data.address ?? "—"} />
          <Row k="City / State" v={[data.city, data.state].filter(Boolean).join(", ") || "—"} />
          <Row k="Board" v={data.board ?? "—"} />
          <Row k="Brand colour" v={data.brandColor ?? "—"} />
          <Row k="Onboarded" v={data.onboardedAt ? new Date(data.onboardedAt).toLocaleDateString("en-IN") : "—"} />
          <Row k="Created" v={data.createdAt ? new Date(data.createdAt).toLocaleDateString("en-IN") : "—"} />
        </div>

        <div className="card">
          <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>Connection</div>
          <Row k="DB host" v={<code className="mono">{data.dbHost}</code>} />
          <Row k="DB name" v={<code className="mono">{data.dbName}</code>} />
          <Row k="DB user" v={<code className="mono">{data.dbUser}</code>} />
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <button
              className="btn btn--ghost btn--sm"
              disabled={testConn.isPending}
              onClick={() => testConn.mutate()}
            >
              <Icon name="search" size={12} /> {testConn.isPending ? "Testing…" : "Test connection"}
            </button>
            <button
              className="btn btn--ghost btn--sm"
              disabled={resetPw.isPending}
              onClick={async () => {
                if (!confirm(`Reset admin password for ${data.name}? A new temp password will be displayed once.`)) return;
                try {
                  const r = await resetPw.mutateAsync();
                  alert(`Temp password: ${r.tempPassword}\nShare this with the school admin and ask them to change it on first login.`);
                } catch (e) { alert(getErrorMessage(e, "Reset failed")); }
              }}
            >
              <Icon name="alert" size={12} /> Reset admin password
            </button>
          </div>
          {testConn.data && testConn.data.ok && (
            <div className="banner banner--success" style={{ marginTop: 8 }}>
              <Icon name="check" size={14} />
              <span>Connection OK. Saw {testConn.data.tablesSeen} tables.</span>
            </div>
          )}
          {testConn.data && !testConn.data.ok && (
            <div className="banner banner--error" style={{ marginTop: 8 }}>
              <Icon name="alert" size={14} />
              <span>{testConn.data.error}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <div className="display-s" style={{ fontSize: 18 }}>Features</div>
          {features.data && (
            <div className="muted body-s mono">
              Estimated monthly: {fmt(features.data.monthlyTotal)}{features.data.managed ? " · managed" : " · grandfathered"}
            </div>
          )}
        </div>
        {features.data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
            {features.data.features.map((f) => (
              <label key={f.featureKey} className="check" style={{ alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={f.enabled}
                  disabled={f.isCore}
                  onChange={(e) => toggleFeature.mutate({ featureKey: f.featureKey, enabled: e.target.checked })}
                />
                <span>
                  <span style={{ fontWeight: 600 }}>{f.label}</span>
                  {f.isCore && <span className="pill pill--success" style={{ marginLeft: 4 }}>CORE</span>}
                  <div className="muted body-s">
                    {f.category} · {f.isCore ? "Free" : fmt(f.monthlyPrice) + "/mo"}
                  </div>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="detail-row">
      <div className="detail-row__k">{k}</div>
      <div className="detail-row__v">{v}</div>
    </div>
  );
}
