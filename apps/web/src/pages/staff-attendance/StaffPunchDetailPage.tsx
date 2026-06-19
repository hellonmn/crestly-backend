import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { useStaffPunchDetail } from "./hooks";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtDistance(m: number | null | undefined): string {
  if (m == null) return "—";
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(2)} km`;
}
function longDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  }).format(d).replace(/,/g, "");
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  }).format(d);
  return `${date} · ${time}`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function StaffPunchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const punchId = Number(id);
  const { data, isLoading, error } = useStaffPunchDetail(punchId);
  const [forensicsOpen, setForensicsOpen] = useState(false);

  if (isLoading) {
    return (
      <>
        <PageHead group="HR" meta={`STAFF ATTENDANCE · #${punchId}`} title="Loading…" />
        <div className="card"><Skeleton.Title width="40%" /></div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHead group="HR" title="Punch not found" />
        <div className="banner banner--error">
          <Icon name="alert" size={16} />
          <span>No staff punch with id #{punchId}.</span>
        </div>
        <Link to="/staff-attendance" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }}>
          ← Back to log
        </Link>
      </>
    );
  }

  const selfieUrl = data.selfiePath ? `/uploads/${data.selfiePath}` : null;
  const centreLbl = data.centreLabel ?? (data.geofenceType === "pickup" ? "Pickup point" : "School");
  const hasCentre = data.centreLatitude != null && data.centreLongitude != null;

  return (
    <>
      <PageHead
        group="HR"
        meta={`STAFF ATTENDANCE · #${data.id}`}
        title={data.userName}
        lede={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            <span className={`pill ${data.punchType === "in" ? "pill--success" : "pill--info"}`} style={{ fontWeight: 700 }}>
              Punch {data.punchType.toUpperCase()}
            </span>
            {data.isOutside ? (
              <span className="pill pill--warn"><span className="pill__dot" />Outside geofence</span>
            ) : (
              <span className="pill pill--success"><span className="pill__dot" />In zone</span>
            )}
            <span className="muted body-s">{longDateTime(data.punchedAt)}</span>
          </div>
        }
        actions={
          <Link to="/staff-attendance" className="btn btn--ghost btn--sm">← Back to log</Link>
        }
      />

      <div className="grid grid--split grid--gap-lg" style={{ alignItems: "start" }}>
        {/* ----- LEFT: Selfie ----- */}
        <div>
          <div className="label" style={{ marginBottom: 10 }}>SELFIE</div>
          {selfieUrl ? (
            <>
              <a href={selfieUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
                <img
                  src={selfieUrl}
                  alt="Selfie"
                  style={{
                    width: "100%", maxWidth: 480,
                    borderRadius: "var(--r-4)",
                    border: "1px solid var(--rule)",
                    display: "block",
                  }}
                />
              </a>
              <div className="muted body-s" style={{ marginTop: 8 }}>
                Captured by browser camera · click to open original.
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
              <div className="muted">No selfie attached.</div>
            </div>
          )}
        </div>

        {/* ----- RIGHT: Details ----- */}
        <div>
          <div className="label" style={{ marginBottom: 10 }}>STAFF</div>
          <div className="detail-list" style={{ marginBottom: 18 }}>
            <Row label="Name" value={data.userName} />
            {data.designation && <Row label="Designation" value={data.designation} />}
            <Row label="Role" value={data.roleName ?? "—"} />
            {data.department && <Row label="Department" value={data.department} />}
            {data.reportsToName && <Row label="Reports to" value={data.reportsToName} />}
            {data.phone && (
              <Row
                label="Phone"
                value={
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <span className="mono">{data.phone}</span>
                    <a
                      href={`tel:+91${data.phone.replace(/\D+/g, "")}`}
                      className="chip"
                      style={{ padding: "3px 8px", fontSize: 11 }}
                    >
                      Call
                    </a>
                  </span>
                }
              />
            )}
          </div>

          <div className="label" style={{ marginBottom: 10 }}>LOCATION</div>
          <div className="detail-list" style={{ marginBottom: 18 }}>
            <Row
              label="Distance"
              value={
                <span style={data.isOutside ? { color: "var(--warn)", fontWeight: 700 } : undefined}>
                  {fmtDistance(data.distanceM)} <span className="muted">from {centreLbl}</span>
                </span>
              }
            />
            <Row
              label="Geofence"
              value={
                <>
                  {data.geofenceType.charAt(0).toUpperCase() + data.geofenceType.slice(1)}
                  {data.pickupName && <> · {data.pickupName}</>}
                </>
              }
            />
            <Row
              label="Coordinates"
              value={
                <span className="mono">
                  {data.latitude.toFixed(6)}, {data.longitude.toFixed(6)}
                  {data.accuracyM != null && (
                    <span className="muted body-s"> · ±{data.accuracyM} m</span>
                  )}
                </span>
              }
            />
            <Row
              label="Open in maps"
              value={
                <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                  <a
                    href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                    className="chip"
                    style={{ padding: "3px 10px" }}
                  >
                    Punch point ↗
                  </a>
                  {hasCentre && (
                    <a
                      href={`https://www.google.com/maps/dir/${data.latitude},${data.longitude}/${data.centreLatitude},${data.centreLongitude}`}
                      target="_blank" rel="noopener noreferrer"
                      className="chip"
                      style={{ padding: "3px 10px" }}
                    >
                      Compare ↗
                    </a>
                  )}
                </span>
              }
            />
          </div>

          {data.notes && (
            <>
              <div className="label" style={{ marginBottom: 10 }}>NOTES</div>
              <div className="card" style={{ padding: "14px 16px", fontSize: 13.5, lineHeight: 1.5 }}>
                {data.notes}
              </div>
            </>
          )}

          <details
            open={forensicsOpen}
            onToggle={(e) => setForensicsOpen((e.target as HTMLDetailsElement).open)}
            className="muted body-s"
            style={{ marginTop: 18 }}
          >
            <summary style={{ cursor: "pointer" }}>Forensics</summary>
            <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6 }}>
              ID #{data.id}<br />
              User ID: {data.userId}<br />
              {data.geofencePickupId && <>Pickup ID: {data.geofencePickupId}<br /></>}
            </div>
          </details>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-row">
      <span className="detail-row__k">{label}</span>
      <span className="detail-row__v">{value ?? <span className="muted">—</span>}</span>
    </div>
  );
}
