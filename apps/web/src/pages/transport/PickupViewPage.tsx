import { Link, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { usePickupPoint } from "./hooks";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export function PickupViewPage() {
  const { id } = useParams<{ id: string }>();
  const pid = Number(id);
  const { data, isLoading, error } = usePickupPoint(pid);

  if (isLoading) return <p className="muted">Loading…</p>;
  if (error || !data) return <div className="banner banner--error"><span>Pickup point not found</span></div>;

  return (
    <>
      <PageHead
        group="TRANSPORT"
        meta={`PP #${data.id}`}
        title={data.name}
        lede={[
          data.distanceKm != null ? `${data.distanceKm} km from school` : null,
          data.slab ? `Slab ${data.slab}` : null,
          `${data.studentCount} students`,
        ].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link to="/transport" className="btn btn--ghost btn--sm">
              <Icon name="chev-left" size={14} /> Back
            </Link>
            {data.googleMapsLink && (
              <a href={data.googleMapsLink} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">
                <Icon name="search" size={14} /> Open in Maps
              </a>
            )}
            <Link to={`/transport/${data.id}/edit`} className="btn btn--primary btn--sm">
              <Icon name="edit" size={14} /> Edit
            </Link>
          </>
        }
      />

      <div className="grid grid--split grid--gap-lg">
        <div className="card">
          <div className="display-s" style={{ marginBottom: 16, fontSize: 18 }}>Location</div>
          <div className="detail-list">
            <Row k="Name" v={data.name} />
            <Row k="Distance" v={data.distanceKm != null ? `${data.distanceKm} km` : "—"} />
            <Row k="Latitude" v={data.latitude?.toFixed(6) ?? "—"} />
            <Row k="Longitude" v={data.longitude?.toFixed(6) ?? "—"} />
            {data.googleMapsLink && (
              <div className="detail-row">
                <div className="detail-row__k">Maps</div>
                <div className="detail-row__v">
                  <a href={data.googleMapsLink} target="_blank" rel="noreferrer">Open ↗</a>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="display-s" style={{ marginBottom: 16, fontSize: 18 }}>Applicable slab</div>
          {data.slab ? (
            <div className="detail-list">
              <Row k="Slab" v={<span className="cls-pill">{data.slab}</span>} />
              <Row k="Yearly fee" v={data.yearlyFee != null ? fmt(data.yearlyFee) : "—"} />
              <Row k="Quarterly" v={data.quarterlyFee != null ? fmt(data.quarterlyFee) : "—"} />
              <Row k="Monthly" v={data.monthlyFee != null ? fmt(data.monthlyFee) : "—"} />
              <Row k="Active students" v={String(data.studentCount)} />
              <Row k="Annual revenue" v={fmt(data.revenue)} />
            </div>
          ) : (
            <p className="muted">No matching distance slab. Set distance to compute slab + fee.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="display-s" style={{ marginBottom: 16, fontSize: 18 }}>Assigned students</div>
        {data.students.length === 0 ? (
          <p className="muted">No students assigned yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>SR #</th>
                <th>Student</th>
                <th>Class</th>
                <th>Fee status</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.srNumber}>
                  <td className="td-sr mono">{s.srNumber}</td>
                  <td className="td-name">
                    <Link to={`/students/${s.srNumber}`} style={{ textDecoration: "none", color: "inherit" }}>
                      {s.studentName}
                    </Link>
                  </td>
                  <td><span className="cls-pill">{s.class}-{s.section}</span></td>
                  <td>
                    {s.feeStatus && (
                      <span className={`pill ${
                        s.feeStatus === "paid" ? "pill--success"
                          : s.feeStatus === "partial" ? "pill--info"
                          : s.feeStatus === "overdue" ? "pill--error" : "pill--warn"
                      }`}>
                        {s.feeStatus}
                      </span>
                    )}
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

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="detail-row">
      <div className="detail-row__k">{k}</div>
      <div className="detail-row__v">{v}</div>
    </div>
  );
}
