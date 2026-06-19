import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { api, getErrorMessage } from "@/lib/api";
import type { ApplyUpgradeResponse, UpgradePlan } from "@crestly/shared";

export function UpgradesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["super", "upgrades"],
    queryFn: async () => (await api.get<UpgradePlan>("/superadmin/upgrades")).data,
  });
  const apply = useMutation({
    mutationFn: async (schoolId: number) =>
      (await api.post<ApplyUpgradeResponse>("/superadmin/upgrades/apply", { schoolId })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["super", "upgrades"] }),
  });
  const [log, setLog] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function runOne(id: number, name: string) {
    setBusyId(id);
    try {
      const r = await apply.mutateAsync(id);
      setLog((prev) => [
        `[${name}] applied=${r.applied.length} skipped=${r.skipped.length} errors=${r.errors.length}`,
        ...prev,
      ]);
    } catch (e) {
      setLog((prev) => [`[${name}] ERROR · ${getErrorMessage(e, "Unknown")}`, ...prev]);
    } finally { setBusyId(null); }
  }

  async function runAll() {
    if (!data) return;
    for (const s of data.schools) {
      if (s.pending.length === 0) continue;
      // eslint-disable-next-line no-await-in-loop
      await runOne(s.id, s.name);
    }
  }

  return (
    <>
      <PageHead
        group="TENANTS"
        title="Tenant migrations"
        lede={data ? `${data.availableMigrations.length} migrations available · ${data.schools.length} active tenants` : "Loading…"}
        actions={
          <button className="btn btn--primary btn--sm" disabled={apply.isPending} onClick={runAll}>
            <Icon name="features" size={14} /> Apply pending to all
          </button>
        }
      />

      {data && data.availableMigrations.length === 0 && (
        <div className="banner banner--info">
          <Icon name="info" size={14} />
          <span>No platform-managed migrations registered. Add entries to <code className="mono">UpgradesService.REGISTRY</code> in the API to roll out tenant DB changes.</span>
        </div>
      )}

      <div className="table-card">
        <table className="data-table">
          <thead><tr><th>School</th><th>Applied</th><th>Pending</th><th></th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: "var(--ink-40)" }}>Loading…</td></tr>}
            {data?.schools.map((s) => (
              <tr key={s.id}>
                <td className="td-name">{s.name}<div className="muted body-s mono">{s.slug}</div></td>
                <td className="mono">{s.applied.length}</td>
                <td className="mono" style={{ color: s.pending.length > 0 ? "var(--warn)" : "var(--ink-40)" }}>
                  {s.pending.length}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn btn--primary btn--sm"
                    disabled={busyId === s.id || s.pending.length === 0}
                    onClick={() => runOne(s.id, s.name)}
                  >
                    {busyId === s.id ? "Running…" : `Apply ${s.pending.length}`}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {log.length > 0 && (
        <div className="card">
          <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>Run log</div>
          <pre className="mono" style={{ fontSize: 12, margin: 0, whiteSpace: "pre-wrap" }}>
            {log.join("\n")}
          </pre>
        </div>
      )}
    </>
  );
}
