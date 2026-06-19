import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { useHostelRooms } from "./hooks";
import type { HostelBlock, HostelRoom, HostelRoomType } from "@crestly/shared";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function HostelRoomsPage() {
  const [params, setParams] = useSearchParams();
  const block    = (params.get("block") ?? "Boys") as HostelBlock;
  const roomType = (params.get("type")  ?? "")     as HostelRoomType | "";

  const { data, isLoading, error, refetch, isFetching } = useHostelRooms({
    block,
    roomType: roomType || undefined,
  });

  // All-rooms count (independent of the room-type filter) for the "All" chip.
  // PHP fetches an extra unfiltered list for this; we approximate by using the
  // current data when no filter is set, or refetching all when needed.
  const { data: allRooms } = useHostelRooms({ block });

  function setBlock(b: HostelBlock) {
    const p = new URLSearchParams(params);
    p.set("block", b);
    p.delete("type");
    setParams(p, { replace: true });
  }
  function setType(t: HostelRoomType | "") {
    const p = new URLSearchParams(params);
    if (t) p.set("type", t); else p.delete("type");
    setParams(p, { replace: true });
  }

  // Group rooms by floor for display.
  const byFloor = useMemo(() => {
    const m = new Map<string, HostelRoom[]>();
    for (const r of data ?? []) {
      const f = r.floor ?? "—";
      const list = m.get(f) ?? [];
      list.push(r);
      m.set(f, list);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [data]);

  const typeCounts = useMemo(() => {
    const counts: Record<HostelRoomType, number> = { Triple: 0, Twin: 0, Single: 0 };
    for (const r of allRooms ?? []) {
      counts[r.roomType] = (counts[r.roomType] ?? 0) + 1;
    }
    return counts;
  }, [allRooms]);

  const accent = block === "Boys" ? "var(--info)" : "var(--rose-deep)";
  const totalRooms = data?.length ?? 0;

  return (
    <>
      <style>{ROOMS_CSS}</style>

      <Link to="/hostel" className="m-back-link">
        <Icon name="chev-right" size={14} style={{ transform: "rotate(180deg)" }} />
        <span>Hostel</span>
      </Link>

      <PageHead
        group="HOSTEL"
        meta={`${block.toUpperCase()} BLOCK`}
        title={`${block} hostel`}
        lede={isLoading
          ? "Loading…"
          : `${totalRooms.toLocaleString("en-IN")} rooms · tap any room to see occupant details.`}
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="rooms" />

      {/* Block toggle */}
      <div className="block-tabs">
        <button
          type="button"
          className={`block-tab ${block === "Boys" ? "is-active" : ""}`}
          onClick={() => setBlock("Boys")}
        >
          <BoyIcon /> Boys hostel
        </button>
        <button
          type="button"
          className={`block-tab ${block === "Girls" ? "is-active" : ""}`}
          onClick={() => setBlock("Girls")}
        >
          <GirlIcon /> Girls hostel
        </button>
      </div>

      {/* Room-type filter chips */}
      <div className="block-tabs" style={{ marginTop: -6 }}>
        <button
          type="button"
          className={`block-tab type-tab ${roomType === "" ? "is-active" : ""}`}
          onClick={() => setType("")}
        >
          All rooms
          <span className="muted body-s" style={{ marginLeft: 4, fontSize: 11 }}>{allRooms?.length ?? 0}</span>
        </button>
        {(["Triple", "Twin", "Single"] as const).map((tp) => {
          const n = typeCounts[tp];
          if (!n) return null;
          return (
            <button
              type="button"
              key={tp}
              className={`block-tab type-tab ${roomType === tp ? "is-active" : ""}`}
              onClick={() => setType(tp)}
            >
              {tp}
              <span className="muted body-s" style={{ marginLeft: 4, fontSize: 11 }}>{n}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="card"><Skeleton.Table rows={4} cols={4} /></div>
      ) : totalRooms === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="label" style={{ marginBottom: 8 }}>NO ROOMS</div>
          <div className="muted body-s">
            No rooms in this block{roomType && <> of type <b>{roomType}</b></>}.
          </div>
        </div>
      ) : (
        byFloor.map(([floor, rooms]) => (
          <div key={floor} style={{ marginTop: 18 }}>
            <div className="label" style={{ marginBottom: 8, color: accent }}>
              {floor.toUpperCase()} FLOOR · {rooms.length} rooms
            </div>
            <div className="hostel-room-grid">
              {rooms.map((r) => {
                const isFull  = r.occupied >= r.capacity;
                const isEmpty = r.occupied === 0;
                return (
                  <div
                    key={r.roomNo}
                    className={`card hostel-room ${isFull ? "is-full" : isEmpty ? "is-empty" : ""}`}
                    style={{ borderColor: `${accent}22` }}
                  >
                    <div className="hostel-room__head">
                      <span className="mono hostel-room__no">{r.roomNo}</span>
                      <span
                        className={`pill ${isFull ? "pill--success" : "pill--info"}`}
                        style={{ fontSize: 9.5, padding: "1px 7px" }}
                      >
                        {r.occupied}/{r.capacity}
                      </span>
                    </div>
                    <div className="hostel-room__type">{r.roomType}</div>
                    {r.occupants.length > 0 ? (
                      <ul className="hostel-room__occupants">
                        {r.occupants.map((o) => (
                          <li key={o.srNumber}>
                            <Link
                              to={`/students/${o.srNumber}`}
                              style={{ textDecoration: "none", color: "inherit" }}
                            >
                              {o.studentName}
                            </Link>
                            <span className="muted body-s" style={{ marginLeft: 4, fontSize: 11 }}>
                              · {o.class}-{o.section}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="muted body-s" style={{ fontStyle: "italic" }}>empty</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </>
  );
}

function BoyIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={8} r={4} />
      <path d="M4 22c1-5 4-7 8-7s7 2 8 7" />
    </svg>
  );
}
function GirlIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={8} r={4} />
      <path d="M12 12v10M8 18h8" />
    </svg>
  );
}

const ROOMS_CSS = `
  .block-tabs {
    display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap;
  }
  .block-tab {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; border-radius: var(--r-pill);
    background: var(--white); border: 1px solid var(--rule);
    color: var(--ink-60); text-decoration: none;
    font-family: inherit; font-weight: 500; font-size: 13px; cursor: pointer;
    transition: all var(--t-fast) var(--ease);
  }
  .block-tab:hover     { background: var(--cream-soft); color: var(--ink); }
  .block-tab.is-active { background: var(--ink); color: var(--cream); border-color: var(--ink); }
  .block-tab.is-active .muted { color: rgba(245,239,227,0.7) !important; }
  .type-tab { padding: 6px 14px; font-size: 12px; }
  .type-tab .muted { opacity: 0.7; }

  .hostel-room-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
  }
  .hostel-room {
    padding: 10px 12px;
    background: var(--white);
    transition: transform var(--t-fast) var(--ease);
  }
  .hostel-room.is-full  { background: rgba(31,111,74,0.04); }
  .hostel-room.is-empty { background: var(--cream-soft); border-style: dashed; }
  .hostel-room__head {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 6px;
  }
  .hostel-room__no   { font-weight: 700; font-size: 13px; letter-spacing: 0.02em; }
  .hostel-room__type {
    font-size: 11px; color: var(--ink-60); margin-bottom: 6px; letter-spacing: 0.04em;
  }
  .hostel-room__occupants { list-style: none; margin: 0; padding: 0; }
  .hostel-room__occupants li {
    font-size: 12.5px; color: var(--ink);
    padding: 2px 0;
    border-top: 1px solid var(--rule-soft);
  }
  .hostel-room__occupants li:first-child { border-top: 0; }
  @media (max-width: 600px) {
    .hostel-room-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
    .hostel-room { padding: 8px 10px; }
  }
`;
