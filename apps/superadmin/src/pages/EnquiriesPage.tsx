import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { api } from "@/lib/api";
import type { MarketingLead } from "@crestly/shared";

const STATUSES = ["new", "contacted", "interested", "trial", "won", "lost"];

export function EnquiriesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["super", "enquiries"],
    queryFn: async () => (await api.get<MarketingLead[]>("/superadmin/enquiries")).data,
  });
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      (await api.post<MarketingLead>(`/superadmin/enquiries/${id}/status`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["super", "enquiries"] }),
  });

  return (
    <>
      <PageHead
        group="REVENUE"
        title="Marketing enquiries"
        lede={data ? `${data.length} leads` : "Loading…"}
      />

      <div className="table-card">
        <table className="data-table">
          <thead><tr><th>When</th><th>Name</th><th>School</th><th>Phone</th><th>Status</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--ink-40)" }}>Loading…</td></tr>}
            {!isLoading && data?.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--ink-40)" }}>No enquiries yet.</td></tr>
            )}
            {data?.map((l) => (
              <tr key={l.id}>
                <td className="mono" style={{ fontSize: 11 }}>
                  {l.createdAt ? new Date(l.createdAt).toLocaleString("en-IN") : "—"}
                </td>
                <td className="td-name">
                  {l.name}
                  {l.message && <div className="muted body-s" style={{ marginTop: 2 }}>{l.message}</div>}
                </td>
                <td>{l.schoolName ?? "—"}</td>
                <td className="mono">
                  {l.phone ?? "—"}
                  {l.phone && (
                    <>{" "}
                      <a href={`tel:+91${l.phone}`} className="btn btn--ghost btn--sm" style={{ marginLeft: 4 }}>
                        <Icon name="msg" size={10} />
                      </a>
                    </>
                  )}
                </td>
                <td>
                  <select
                    className="select"
                    value={l.status}
                    onChange={(e) => updateStatus.mutate({ id: l.id, status: e.target.value })}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
