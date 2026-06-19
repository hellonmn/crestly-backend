import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { useTransportSlabs } from "@/pages/fee-structure/hooks";
import { usePickupPoints } from "./hooks";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export function TransportSlabsPage() {
  const { data: slabs, isLoading } = useTransportSlabs();
  const { data: points } = usePickupPoints();

  // Aggregate students + revenue per slab.
  const stats = new Map<string, { students: number; revenue: number }>();
  for (const p of points?.items ?? []) {
    if (!p.slab) continue;
    const slot = stats.get(p.slab) ?? { students: 0, revenue: 0 };
    slot.students += p.studentCount;
    slot.revenue += p.revenue;
    stats.set(p.slab, slot);
  }

  return (
    <>
      <PageHead
        group="TRANSPORT"
        title="Fee slabs"
        lede="Distance-band fee matrix. Each pickup point picks its slab from its distance_km."
        actions={
          <Link to="/transport" className="btn btn--ghost btn--sm">
            <Icon name="chev-left" size={14} /> Back
          </Link>
        }
      />

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Slab</th>
              <th>Range</th>
              <th>Yearly</th>
              <th>Quarterly</th>
              <th>Monthly</th>
              <th>Students</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--ink-40)" }}>Loading…</td></tr>}
            {slabs?.map((s) => {
              const stat = stats.get(s.slab) ?? { students: 0, revenue: 0 };
              return (
                <tr key={s.slab}>
                  <td><span className="cls-pill">{s.slab}</span></td>
                  <td className="muted">{s.distanceRange}</td>
                  <td className="mono">{fmt(s.yearlyFee)}</td>
                  <td className="mono">{fmt(s.quarterlyFee)}</td>
                  <td className="mono">{fmt(s.monthlyFee)}</td>
                  <td className="mono">{stat.students}</td>
                  <td className="mono">{fmt(stat.revenue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
