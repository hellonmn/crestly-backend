import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useStreamRoster, useStreams } from "./hooks";
import type { StreamSummary } from "@crestly/shared";

/* ----------------------------------------------------------------
 * PHP `streams.php` parity. The canonical section→stream map and
 * tints live on the client because they are display-only metadata.
 * ---------------------------------------------------------------- */
const STREAM_META: Record<string, { label: string; tint: string; sections: string }> = {
  PCM:      { label: "Science · Maths", tint: "sky",   sections: "A, B" },
  PCB:      { label: "Science · Bio",   tint: "mint",  sections: "C" },
  Commerce: { label: "Commerce",        tint: "wheat", sections: "D, E" },
};
const SECTION_STREAM: Array<[string, string]> = [
  ["A", "PCM"], ["B", "PCM"], ["C", "PCB"], ["D", "Commerce"], ["E", "Commerce"],
];

export function StreamsPage() {
  const [params, setParams] = useSearchParams();
  const fStream = params.get("stream") ?? "";
  const fClass = params.get("class") ?? "";

  const { data: streams, isLoading } = useStreams();
  const streamByCode = new Map<string, StreamSummary>((streams ?? []).map((s) => [s.stream, s]));
  const streamPopulated = (streams ?? []).some((s) => s.studentCount > 0);

  const { data: roster, isLoading: rosterLoading } = useStreamRoster(fStream || undefined);
  // Optional class filter — apply on the client since the API doesn't filter by class.
  const rosterFiltered = !roster
    ? []
    : fClass
      ? roster.filter((r) => r.class === fClass)
      : roster;

  function open(stream: string, cls?: string) {
    const next = new URLSearchParams();
    next.set("stream", stream);
    if (cls) next.set("class", cls);
    setParams(next, { replace: true });
  }

  return (
    <>
      <PageHead
        group="ACADEMICS"
        meta="STREAMS · 11-12"
        title="Streams"
        lede="Classes 11 & 12 run three streams — no humanities. Each stream has its own subject set; sections are stream-based (not day/hostel)."
      />

      {!isLoading && !streamPopulated && (
        <div className="banner banner--info">
          <Icon name="info" size={16} />
          <span>
            Stream definitions are set up. Student-level <code className="mono">stream</code> tags aren't filled yet —
            once tagged (via import or admission), per-stream rosters appear below.
          </span>
        </div>
      )}

      {/* Stream cards */}
      {isLoading ? (
        <div className="grid grid--cols-3 grid--gap-sm">
          <Skeleton.Stat /><Skeleton.Stat /><Skeleton.Stat />
        </div>
      ) : (
        <div className="grid grid--cols-3 grid--gap-sm">
          {Object.entries(STREAM_META).map(([code, meta]) => {
            const s = streamByCode.get(code);
            const subjects = s?.subjects ?? [];
            return (
              <div key={code} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div className="display-s" style={{ fontSize: 22 }}>{code}<BrandDot /></div>
                    <div className="muted body-s">{meta.label}</div>
                  </div>
                  <span
                    className={`stat-tile__icon icon-tint-${meta.tint}`}
                    style={{ width: 42, height: 42, borderRadius: 11, display: "grid", placeItems: "center" }}
                  >
                    <Icon name="library" size={20} />
                  </span>
                </div>

                <div>
                  <div className="label" style={{ marginBottom: 6 }}>SUBJECTS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {subjects.length === 0 && <span className="muted body-s">No subjects mapped yet.</span>}
                    {subjects.map((sub) => (
                      <span
                        key={sub.id}
                        className={`pill ${sub.isOptional ? "pill--neutral" : "pill--info"}`}
                        style={{ padding: "3px 9px", fontSize: 11 }}
                      >
                        {sub.subjectName}{sub.isOptional ? " · opt" : ""}
                      </span>
                    ))}
                  </div>
                  <div className="muted body-s" style={{ marginTop: 6, fontSize: 11 }}>
                    Core subjects in blue · ·opt = elective / 6th-subject choice
                  </div>
                </div>

                <div
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    paddingTop: 10, borderTop: "1px dashed var(--rule-soft)",
                  }}
                >
                  <div>
                    <div className="label">SECTIONS</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>{meta.sections}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="label">STUDENTS</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>
                      {s ? s.studentCount.toLocaleString("en-IN") : "—"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => open(code, "11th")}>11th list</button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => open(code, "12th")}>12th list</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Canonical section → stream reference */}
      <div className="card card--tight">
        <div className="label" style={{ marginBottom: 12 }}>SECTION → STREAM MAP · 11-12 (reference)</div>
        <div className="str-grid">
          <div className="str-row str-row--head">
            <span>SECTION</span><span>STREAM</span><span>NOTE</span>
          </div>
          {SECTION_STREAM.map(([sec, stream]) => (
            <div className="str-row" key={sec}>
              <span className="mono">11-{sec} · 12-{sec}</span>
              <span><span className="pill pill--info" style={{ padding: "2px 9px", fontSize: 11 }}>{stream}</span></span>
              <span className="muted body-s">{STREAM_META[stream]?.label ?? ""} · mixed day + hostel</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filtered roster */}
      {fStream && (
        <div className="card card--tight">
          <div
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              marginBottom: 12, gap: 8, flexWrap: "wrap",
            }}
          >
            <div className="label">{fStream} STUDENTS{fClass ? ` · ${fClass}` : ""}</div>
            <button
              type="button"
              className="muted body-s"
              style={{ background: "transparent", border: 0, textDecoration: "underline", cursor: "pointer" }}
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
            >
              Clear
            </button>
          </div>

          {rosterLoading ? (
            <Skeleton.Table rows={4} cols={3} />
          ) : rosterFiltered.length === 0 ? (
            <p className="muted body-s" style={{ margin: 0 }}>
              No active students tagged with stream <b>{fStream}</b>{fClass ? ` in ${fClass}` : ""} yet.
              Populate <code className="mono">students.stream</code> to see them here.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rosterFiltered.map((s) => (
                <Link
                  key={s.srNumber}
                  to={`/students/${s.srNumber}`}
                  style={{
                    display: "grid", gridTemplateColumns: "70px 1fr auto",
                    gap: 12, alignItems: "center",
                    padding: "8px 12px", borderBottom: "1px solid var(--rule-soft)",
                    textDecoration: "none", color: "inherit",
                  }}
                >
                  <span className="mono">#{s.srNumber}</span>
                  <span style={{ fontWeight: 600 }}>{s.studentName}</span>
                  <span>
                    <span className="cls-pill">{s.class}-{s.section}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Local CSS for the section/stream map grid (matches PHP page) */}
      <style>{`
        .str-grid { }
        .str-row { display:grid; grid-template-columns:200px 130px 1fr; gap:12px; align-items:center;
                   padding:9px 14px; border-bottom:1px solid var(--rule-soft); font-size:13px; }
        .str-row:last-child { border-bottom:0; }
        .str-row--head { background:var(--cream-soft); font-family:var(--font-mono); font-size:10.5px;
                         letter-spacing:0.12em; color:var(--ink-60); }
        @media (max-width:600px){
          .str-row { grid-template-columns:1fr auto; }
          .str-row > :last-child { display:none; }
        }
      `}</style>
    </>
  );
}
