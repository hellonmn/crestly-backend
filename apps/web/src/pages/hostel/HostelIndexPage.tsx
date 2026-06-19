import { Link } from "react-router-dom";
import { Icon, type IconName } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useHostelOverview } from "./hooks";
import { useAuth } from "@/lib/auth-store";
import type { HostelOverview } from "@crestly/shared";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  if (a >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2).replace(/\.?0+$/, "")} L`;
  if (a >= 1_000)       return `₹${(n / 1_000).toFixed(1).replace(/\.?0+$/, "")} K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

interface BlockCounts {
  boys: { rooms: number; capacity: number; occupied: number; pct: number };
  girls: { rooms: number; capacity: number; occupied: number; pct: number };
}
function splitBlocks(data?: HostelOverview): BlockCounts {
  const boys  = data?.blocks.find((b) => b.block === "Boys")  ?? { block: "Boys" as const,  rooms: 0, capacity: 0, occupied: 0, pct: 0 };
  const girls = data?.blocks.find((b) => b.block === "Girls") ?? { block: "Girls" as const, rooms: 0, capacity: 0, occupied: 0, pct: 0 };
  return {
    boys:  { rooms: boys.rooms,  capacity: boys.capacity,  occupied: boys.occupied,  pct: boys.pct },
    girls: { rooms: girls.rooms, capacity: girls.capacity, occupied: girls.occupied, pct: girls.pct },
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function HostelIndexPage() {
  const { user } = useAuth();
  const { data, isLoading } = useHostelOverview();
  const sessionCode = (user as { sessionCode?: string } | null)?.sessionCode ?? null;

  const { boys, girls } = splitBlocks(data);
  const totalCapacity = boys.capacity + girls.capacity;
  const totalOccupied = (data?.boarders ?? 0);

  // Anyone outside admin/principal/hr/warden/accountant gets the same 403
  // PHP shows. Permissions-wise we check role slug; the API gate is the
  // source of truth for data — this is just a polite UI fallback.
  const role = user?.roleSlug ?? "";
  const allowed = ["admin", "principal", "hr", "warden", "accountant"].includes(role);

  if (!allowed) {
    return (
      <>
        <PageHead group="RECORDS" meta="HOSTEL" title="Access denied" />
        <div className="banner banner--error">
          <Icon name="alert" size={16} />
          <span>Hostel section is for Admin · Principal · HR · Warden · Accountant.</span>
        </div>
        <Link to="/" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }}>
          ← Back to dashboard
        </Link>
      </>
    );
  }

  // Show team shortcut only when the user has team.view (or is in the
  // admin/principal/hr set).
  const canTeam = ["admin", "principal", "hr"].includes(role)
    || (user?.permissions ?? []).includes("team.view");

  return (
    <>
      <PageHead
        group="RECORDS · HOSTEL"
        meta={sessionCode ? `SESSION ${sessionCode}` : undefined}
        title="Hostel"
        lede="Boarder roster, room allocations, fees, daily schedule. Boys + Girls blocks managed separately. Tap a block card to see the live allocation grid."
      />

      {/* ===== Stat tiles ===== */}
      {isLoading ? (
        <Skeleton.StatRow count={4} />
      ) : (
        <div className="grid grid--cols-4 grid--gap-sm">
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-mint">
              <BoarderIcon />
            </div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Boarders</div>
              <div className="stat-tile__value">{(data?.boarders ?? 0).toLocaleString("en-IN")}</div>
              <div className="stat-tile__delta">
                {boys.occupied} boys · {girls.occupied} girls
              </div>
            </div>
          </div>

          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-wheat">
              <RoomIcon />
            </div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Rooms</div>
              <div className="stat-tile__value">{(data?.totalRooms ?? 0).toLocaleString("en-IN")}</div>
              <div className="stat-tile__delta">
                {boys.rooms} boys · {girls.rooms} girls
              </div>
            </div>
          </div>

          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-sky">
              <Icon name="check" size={20} />
            </div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Occupancy</div>
              <div className="stat-tile__value">{(data?.occupancyPct ?? 0).toFixed(1)}%</div>
              <div className="stat-tile__delta">
                {totalOccupied} of {totalCapacity || "—"} beds
              </div>
            </div>
          </div>

          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-rose">
              <Icon name="rupee" size={20} />
            </div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Annual billing</div>
              <div className="stat-tile__value" style={{ fontSize: 22 }}>{compact(data?.annualBilling ?? 0)}</div>
              <div className="stat-tile__delta">school + lodging + mess</div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Block cards ===== */}
      <div className="grid grid--cols-2 grid--gap-sm" style={{ marginTop: 18 }}>
        {isLoading ? (
          <>
            <Skeleton.Stat /><Skeleton.Stat />
          </>
        ) : data?.blocks.length === 0 ? (
          <div className="card" style={{ gridColumn: "1 / -1", padding: 28, textAlign: "center" }}>
            <div className="muted body-s">No hostel blocks configured yet.</div>
          </div>
        ) : (
          data?.blocks.map((b) => {
            const color = b.block === "Boys" ? "var(--info)" : "var(--rose-deep)";
            return (
              <Link
                key={b.block}
                to={`/hostel/rooms?block=${b.block}`}
                className="card hostel-block-card"
                style={{
                  textDecoration: "none", color: "inherit",
                  padding: "22px 24px", borderLeft: `4px solid ${color}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                  <div>
                    <div className="label" style={{ color }}>
                      {b.block.toUpperCase()} HOSTEL
                    </div>
                    <div className="display-m" style={{ marginTop: 4, fontSize: 32 }}>
                      {b.occupied}
                      <span className="muted" style={{ fontSize: 18, fontWeight: 400 }}> / {b.capacity}</span>
                      <BrandDot />
                    </div>
                    <div className="muted body-s" style={{ marginTop: 2 }}>
                      {b.rooms} rooms · {Math.round(b.pct)}% occupied
                    </div>
                  </div>
                  <span className="btn btn--ghost btn--sm">See allocations →</span>
                </div>
                <div style={{ height: 8, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden", marginTop: 16 }}>
                  <div style={{ height: "100%", width: `${b.pct}%`, background: color, borderRadius: "var(--r-pill)" }} />
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* ===== Quick links ===== */}
      <div className="grid grid--cols-4 grid--gap-sm" style={{ marginTop: 18 }}>
        <Shortcut to="/hostel/boarders"  icon="users"    title="Boarders roster" tint="mint" />
        <Shortcut to="/hostel/fees"      icon="rupee"    title="Fee structure"   tint="rose" />
        <Shortcut to="/hostel/schedule"  icon="calendar" title="Schedule & rules" tint="sky" />
        {canTeam && (
          <Shortcut to="/team?department=Hostel" icon="team" title="Hostel staff" tint="wheat" />
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function Shortcut({
  to, icon, title, tint,
}: {
  to: string;
  icon: IconName;
  title: string;
  tint: "mint" | "rose" | "sky" | "wheat";
}) {
  return (
    <Link
      to={to}
      className="card"
      style={{
        textDecoration: "none", color: "inherit",
        padding: "18px 16px",
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <div className={`stat-tile__icon icon-tint-${tint}`}>
        <Icon name={icon} size={20} />
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14 }}>
        {title}
      </div>
    </Link>
  );
}

/* Inline PHP-matching icons (not in the shared pack). */
function BoarderIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21V10l9-6 9 6v11" />
      <path d="M9 21V13h6v8" />
    </svg>
  );
}
function RoomIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={3} width={18} height={18} rx={1.5} />
      <path d="M3 9h18M9 3v18" />
    </svg>
  );
}
