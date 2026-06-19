import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { usePunch, usePunchToday } from "./hooks";
import { getErrorMessage } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Helpers — mirror PHP's format_distance / countdown / crumb date     */
/* ------------------------------------------------------------------ */

function fmtDistance(m: number | null | undefined): string {
  if (m == null) return "—";
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(2)} km`;
}
function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(iso));
}
function crumbDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  }).format(d).replace(/,/g, "").toUpperCase();
}

/** Geo state for step 1 (mirror of PHP fetchGeo). */
interface GeoState {
  status: "idle" | "loading" | "ok" | "error";
  coords?: { latitude: number; longitude: number; accuracy: number };
  message?: string;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function PunchPage() {
  const { data, isLoading } = usePunchToday();
  const punch = usePunch();

  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const [notes, setNotes] = useState("");
  const [selfie, setSelfie] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [camOpen, setCamOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "outside"; text: string } | null>(null);

  // Auto-request geolocation on mount (PHP behavior).
  useEffect(() => {
    if (geo.status === "idle" && data && !data.doneForDay && data.cooldownSeconds <= 0) {
      fetchGeo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.doneForDay, data?.cooldownSeconds]);

  function fetchGeo() {
    setGeo({ status: "loading" });
    if (!("geolocation" in navigator)) {
      setGeo({ status: "error", message: "Browser has no geolocation API" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({
        status: "ok",
        coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy },
      }),
      (err) => setGeo({ status: "error", message: err.message || "tap to retry" }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  async function onPunch() {
    setError(null); setFlash(null);
    if (!geo.coords) { setError("Get your location first."); return; }
    if (!selfie) { setError("Take a selfie first."); return; }
    if (!data) return;

    try {
      // Downscale to ~1024px max and re-encode at q=0.7 to keep the JSON
      // body well under the API limit (typically lands ~80-150KB base64).
      const compressed = await downscaleJpegBlob(selfie.blob, 1024, 0.7);
      const selfieBase64 = await blobToBase64(compressed);
      const saved = await punch.mutateAsync({
        punchType: data.nextType,
        latitude: geo.coords.latitude,
        longitude: geo.coords.longitude,
        accuracyM: Math.round(geo.coords.accuracy),
        notes: notes || null,
        selfieBase64,
      });
      const distLabel = saved.distanceM != null ? `${fmtDistance(saved.distanceM)} from ${data.target?.label ?? "centre"}.` : "";
      setFlash({
        kind: saved.isOutside ? "outside" : "ok",
        text: saved.isOutside
          ? `Punch saved but you're outside the geofence. ${distLabel} HR will be notified.`
          : `Punched ${saved.punchType}. ${distLabel}`,
      });
      setNotes("");
      setSelfie(null);
      setGeo({ status: "idle" });
    } catch (e) {
      setError(getErrorMessage(e, "Punch failed"));
    }
  }

  if (isLoading) {
    return (
      <>
        <PageHead group="SELF" meta={crumbDate()} title="Punch In" lede="Loading status…" />
        <Skeleton.StatRow count={3} />
        <div className="card"><Skeleton.Title width="40%" /></div>
      </>
    );
  }
  if (!data) return null;

  const title = data.isIn ? "Punch Out" : "Punch In";

  return (
    <>
      <style>{PUNCH_CSS}</style>

      <PageHead
        group="SELF"
        meta={crumbDate()}
        title={title}
        lede={
          data.target ? (
            <>
              Geo-tagged + selfie. Within <b>{fmtDistance(data.target.radiusM)}</b> of{" "}
              <b>{data.target.label}</b>.
              {data.target.type === "pickup" && <span className="muted"> (driver pickup geofence)</span>}
            </>
          ) : (
            "Geo-tagged + selfie."
          )
        }
      />

      {flash?.kind === "ok" && (
        <div className="banner banner--success">
          <Icon name="check" size={16} /><span>{flash.text}</span>
        </div>
      )}
      {flash?.kind === "outside" && (
        <div className="banner banner--warn">
          <Icon name="alert" size={16} /><span>{flash.text}</span>
        </div>
      )}
      {error && (
        <div className="banner banner--error">
          <Icon name="alert" size={16} /><span><b>Punch failed:</b> {error}</span>
        </div>
      )}

      {/* ----- Today's status tiles ----- */}
      <div className="grid grid--cols-3 grid--gap-sm">
        <div className="stat-tile">
          <div className={`stat-tile__icon ${data.isIn ? "icon-tint-mint" : "icon-tint-wheat"}`}>
            <ClockIcon />
          </div>
          <div className="stat-tile__body">
            <div className="stat-tile__label">Status</div>
            <div className="stat-tile__value" style={{ fontSize: 22 }}>{data.isIn ? "In" : "Out"}</div>
            <div className="stat-tile__delta">
              {data.isIn && data.punches.length > 0
                ? `since ${fmtTime(data.punches[data.punches.length - 1]!.punchedAt)}`
                : "not punched in"}
            </div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__icon icon-tint-mint">
            <Icon name="check" size={20} />
          </div>
          <div className="stat-tile__body">
            <div className="stat-tile__label">First in</div>
            <div className="stat-tile__value" style={{ fontSize: 22 }}>
              {data.firstIn ? fmtTime(data.firstIn.punchedAt) : "—"}
            </div>
            <div className="stat-tile__delta">
              {data.firstIn ? fmtDistance(data.firstIn.distanceM) : "no punch yet"}
            </div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__icon icon-tint-rose">
            <LogOutIcon />
          </div>
          <div className="stat-tile__body">
            <div className="stat-tile__label">Last out</div>
            <div className="stat-tile__value" style={{ fontSize: 22 }}>
              {data.lastOut ? fmtTime(data.lastOut.punchedAt) : "—"}
            </div>
            <div className="stat-tile__delta">
              {data.lastOut ? fmtDistance(data.lastOut.distanceM) : "still in"}
            </div>
          </div>
        </div>
      </div>

      {/* ----- Cooldown / done-for-day / blocked card OR punch form ----- */}
      {data.doneForDay ? (
        <CooldownCard
          readyAt={data.tomorrowAt}
          title="DONE FOR TODAY"
          subtitle={
            <>
              You punched out at <b>{data.lastOut ? fmtTime(data.lastOut.punchedAt) : "--:--"}</b>. Next
              punch becomes available tomorrow.
            </>
          }
          iconTone="success"
        />
      ) : data.cooldownReadyAt && data.cooldownSeconds > 0 ? (
        <CooldownCard
          readyAt={data.cooldownReadyAt}
          title="PUNCH OUT LOCKED"
          subtitle={
            <>
              You punched in just now ({data.punches.length > 0 ? fmtTime(data.punches[data.punches.length - 1]!.punchedAt) : "—"}).
              To prevent accidental double-punches, Punch Out unlocks at{" "}
              <b>{fmtTime(data.cooldownReadyAt)}</b>.
            </>
          }
          iconTone="ink"
        />
      ) : !data.target?.latitude || !data.target?.longitude ? (
        <div className="card">
          <div className="banner banner--error" style={{ margin: 0 }}>
            <span><b>Can't punch:</b> school location isn't configured. Ask Admin.</span>
          </div>
        </div>
      ) : (
        // ---------- Punch form ----------
        <div className="card punch-card">
          <div className="punch-card__steps">
            {/* Step 1 — geolocation */}
            <div
              className={`punch-step ${geo.status === "ok" ? "is-done" : geo.status === "error" ? "is-error" : ""}`}
              onClick={geo.status === "error" ? fetchGeo : undefined}
              style={geo.status === "error" ? { cursor: "pointer" } : undefined}
            >
              <div className="punch-step__num">1</div>
              <div className="punch-step__body">
                <div className="punch-step__title">Get your location</div>
                <div className="punch-step__sub">
                  {geo.status === "idle" && "tap allow when the browser asks"}
                  {geo.status === "loading" && "requesting…"}
                  {geo.status === "ok" && geo.coords && (
                    <span className="mono">
                      {geo.coords.latitude.toFixed(5)}, {geo.coords.longitude.toFixed(5)} (±{Math.round(geo.coords.accuracy)} m)
                    </span>
                  )}
                  {geo.status === "error" && `Denied / unavailable — ${geo.message ?? "tap to retry"}`}
                </div>
              </div>
              <div className="punch-step__icon">
                <MapPinIcon />
              </div>
            </div>

            {/* Step 2 — selfie */}
            <div className={`punch-step ${selfie ? "is-done" : ""}`}>
              <div className="punch-step__num">2</div>
              <div className="punch-step__body">
                <div className="punch-step__title">Take a selfie</div>
                <div className="punch-step__sub">front camera only · mandatory</div>
                <button
                  type="button"
                  className="btn btn--ink btn--sm"
                  style={{ marginTop: 6 }}
                  onClick={() => setCamOpen(true)}
                >
                  <CameraIcon />
                  {selfie ? "Retake selfie" : "Open camera"}
                </button>
                {selfie && (
                  <img
                    src={selfie.previewUrl}
                    alt=""
                    style={{ display: "block", marginTop: 10, maxWidth: 180, borderRadius: "var(--r-3)", border: "1px solid var(--rule)" }}
                  />
                )}
              </div>
              <div className="punch-step__icon">
                <CameraIcon />
              </div>
            </div>

            {/* Step 3 — note */}
            <div className="punch-step">
              <div className="punch-step__num">3</div>
              <div className="punch-step__body" style={{ flex: 1 }}>
                <div className="punch-step__title">Note (optional)</div>
                <input
                  type="text"
                  className="input"
                  maxLength={255}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. came back from field trip"
                  style={{ marginTop: 4 }}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`btn btn--lg btn--full ${data.nextType === "in" ? "btn--success" : "btn--danger"}`}
            disabled={geo.status !== "ok" || !selfie || punch.isPending}
            style={{ marginTop: 18, fontSize: 16, padding: "14px 20px", justifyContent: "center" }}
            onClick={onPunch}
          >
            {data.nextType === "in" ? <LogInIcon /> : <LogOutIcon />}
            <span>
              {punch.isPending
                ? "Saving…"
                : geo.status === "ok" && selfie
                  ? `Punch ${data.nextType === "in" ? "In" : "Out"}`
                  : "Complete steps above…"}
            </span>
          </button>
        </div>
      )}

      {/* ----- Salary banner ----- */}
      {data.isIn && (
        <div className="card" style={{ padding: "14px 18px", background: "var(--cream-soft)", borderStyle: "dashed" }}>
          <div className="muted body-s">
            <b>Salary unlocked after Punch Out.</b> See your month ledger for the running totals.{" "}
            <Link to="/salary" style={{ textDecoration: "underline" }}>Open salary →</Link>
          </div>
        </div>
      )}

      {/* ----- Today's events ----- */}
      {data.punches.length > 0 && (
        <div>
          <div className="label" style={{ margin: "14px 0 8px" }}>
            TODAY'S EVENTS · {data.punches.length}
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {[...data.punches].reverse().map((p) => (
              <div
                key={p.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--rule-soft)",
                }}
              >
                <span className={`pill ${p.punchType === "in" ? "pill--success" : "pill--info"}`} style={{ fontWeight: 700 }}>
                  {p.punchType.toUpperCase()}
                </span>
                <span>
                  <span className="mono" style={{ fontWeight: 600 }}>{fmtTime(p.punchedAt)}</span>
                  <span className="muted body-s" style={{ marginLeft: 8 }}>
                    · {fmtDistance(p.distanceM)} from {p.geofenceType}
                  </span>
                </span>
                {p.isOutside ? (
                  <span className="pill pill--warn"><span className="pill__dot" />Outside</span>
                ) : (
                  <span className="pill pill--success" style={{ opacity: 0.7 }}>In zone</span>
                )}
                {p.selfiePath ? (
                  <a
                    href={`/uploads/${p.selfiePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chip"
                    style={{ fontSize: 11, padding: "3px 8px" }}
                  >
                    Selfie ↗
                  </a>
                ) : (
                  <span className="muted body-s">—</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ----- Camera modal ----- */}
      {camOpen && (
        <SelfieCamera
          onClose={() => setCamOpen(false)}
          onCapture={(blob) => {
            if (selfie?.previewUrl) URL.revokeObjectURL(selfie.previewUrl);
            const previewUrl = URL.createObjectURL(blob);
            setSelfie({ blob, previewUrl });
            setCamOpen(false);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Cooldown card with live countdown                                   */
/* ------------------------------------------------------------------ */

function CooldownCard({
  readyAt, title, subtitle, iconTone,
}: {
  readyAt: string;
  title: string;
  subtitle: React.ReactNode;
  iconTone: "ink" | "success";
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const target = new Date(readyAt).getTime();
  const left = Math.max(0, Math.ceil((target - now) / 1000));
  const text = useMemo(() => {
    if (left <= 0) return "now — reloading…";
    const h = Math.floor(left / 3600);
    const m = Math.floor((left % 3600) / 60);
    const s = left % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
    if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
    return `${s}s`;
  }, [left]);

  // Auto-reload once the countdown hits zero so the form unlocks.
  useEffect(() => {
    if (left <= 0) {
      const t = setTimeout(() => location.reload(), 600);
      return () => clearTimeout(t);
    }
  }, [left]);

  return (
    <div className="card punch-cooldown">
      <div
        className="punch-cooldown__icon"
        style={iconTone === "success"
          ? { background: "var(--success)", color: "var(--cream)" }
          : undefined}
      >
        {iconTone === "success" ? <Icon name="check" size={32} /> : <ClockIcon size={32} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="label">{title}</div>
        <div className="punch-cooldown__title">
          {title === "DONE FOR TODAY" ? <>Punch In unlocks in <span>{text}</span></> : <>Available in <span>{text}</span></>}
        </div>
        <div className="muted body-s" style={{ marginTop: 4 }}>{subtitle}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Selfie camera modal — getUserMedia front cam → canvas → blob       */
/* ------------------------------------------------------------------ */

function SelfieCamera({ onClose, onCapture }: { onClose: () => void; onCapture: (blob: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stillRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState("Starting camera…");
  const [showVideo, setShowVideo] = useState(true);
  const [stillUrl, setStillUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const [shutterDisabled, setShutterDisabled] = useState(true);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Acquire stream on mount / re-acquire on retake.
  useEffect(() => {
    if (stillUrl) return;
    const md = navigator.mediaDevices;
    const hasMedia = !!(md && typeof md.getUserMedia === "function"
      && typeof HTMLCanvasElement !== "undefined"
      && typeof HTMLCanvasElement.prototype.toBlob === "function");
    if (!hasMedia) { setStatus("Camera API unavailable — use file picker fallback below."); return; }

    let active = true;
    setOverlayHidden(false);
    setShutterDisabled(true);
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    }).then(attach).catch(() => {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
        .then(attach)
        .catch((err) => setStatus(`Camera blocked — ${err?.message ?? "permission denied"}`));
    });

    function attach(s: MediaStream) {
      if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = s;
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = s;
      v.onloadedmetadata = () => {
        setShutterDisabled(false);
        setOverlayHidden(true);
      };
    }

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [stillUrl]);

  function capture() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Mirror back so saved file matches preview (selfie expectation).
    ctx.save();
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, c.width, c.height);
    ctx.restore();
    c.toBlob((b) => {
      if (!b) return;
      setBlob(b);
      const url = URL.createObjectURL(b);
      setStillUrl(url);
      setShowVideo(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }, "image/jpeg", 0.85);
  }

  function retake() {
    if (stillUrl) URL.revokeObjectURL(stillUrl);
    setStillUrl(null);
    setBlob(null);
    setShowVideo(true);
  }

  function use() {
    if (!blob) return;
    onCapture(blob);
  }

  function closeSafely() {
    if (stillUrl) URL.revokeObjectURL(stillUrl);
    onClose();
  }

  return (
    <div className="cam-modal is-open" role="dialog" aria-label="Take a selfie">
      <div className="cam-modal__scrim" onClick={closeSafely} />
      <div className="cam-modal__sheet">
        <div className="cam-modal__head">
          <span className="label">SELFIE · FRONT CAMERA</span>
          <button type="button" className="cam-modal__close" aria-label="Close camera" onClick={closeSafely}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="cam-modal__stage">
          <video ref={videoRef} autoPlay playsInline muted hidden={!showVideo} />
          <canvas ref={canvasRef} hidden />
          {stillUrl && <img ref={stillRef} src={stillUrl} alt="" />}
          <div className={`cam-modal__overlay ${overlayHidden && !stillUrl ? "is-hidden" : ""}`}>
            <span>{stillUrl ? "" : status}</span>
          </div>
        </div>
        <div className="cam-modal__controls">
          {stillUrl ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={retake}>
                <RetakeIcon /> Retake
              </button>
              <button type="button" className="btn btn--success" onClick={use}>
                <Icon name="check" size={16} /> Use this
              </button>
            </>
          ) : (
            <>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="cam-shutter"
                aria-label="Capture"
                disabled={shutterDisabled}
                onClick={capture}
              />
              <span style={{ flex: 1 }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline SVG icons used in this page (kept local — they're page-     */
/* specific and not worth adding to the shared icon pack).             */
/* ------------------------------------------------------------------ */

function ClockIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={9} />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}
function MapPinIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-7 8-12a8 8 0 1 0-16 0c0 5 8 12 8 12z" />
      <circle cx={12} cy={10} r={3} />
    </svg>
  );
}
function CameraIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19V8a2 2 0 0 0-2-2h-3l-2-3h-8L6 6H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z" />
      <circle cx={12} cy={13} r={4} />
    </svg>
  );
}
function LogInIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}
function LogOutIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
function RetakeIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Inline CSS — verbatim from erp/punch/index.php                      */
/* ------------------------------------------------------------------ */
const PUNCH_CSS = `
  .punch-card { padding: 18px 20px; }
  .punch-card__steps { display: flex; flex-direction: column; gap: 12px; }
  .punch-step {
    display: grid; grid-template-columns: 36px 1fr 24px;
    gap: 12px; align-items: flex-start;
    padding: 12px 14px;
    border: 1px solid var(--rule); border-radius: var(--r-3);
    background: var(--white);
    transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
  }
  .punch-step.is-done   { background: rgba(31,111,74,0.05); border-color: rgba(31,111,74,0.3); }
  .punch-step.is-error  { background: var(--error-soft); border-color: var(--error); }
  .punch-step__num {
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--ink); color: var(--cream);
    display: grid; place-items: center;
    font-family: var(--font-display); font-weight: 700; font-size: 13px;
  }
  .punch-step.is-done  .punch-step__num { background: var(--success); }
  .punch-step.is-error .punch-step__num { background: var(--error); }
  .punch-step__title  { font-weight: 600; font-size: 14px; }
  .punch-step__sub    { font-size: 12px; color: var(--ink-60); margin-top: 2px; }
  .punch-step__icon   { color: var(--ink-40); padding-top: 4px; }
  .punch-step.is-done .punch-step__icon { color: var(--success); }

  .punch-cooldown {
    display: flex; align-items: center; gap: 16px;
    padding: 18px 22px;
    background: var(--cream-soft);
    border: 1px dashed var(--rule-strong);
  }
  .punch-cooldown__icon {
    width: 56px; height: 56px; border-radius: 50%;
    background: var(--ink); color: var(--cream);
    display: grid; place-items: center; flex-shrink: 0;
  }
  .punch-cooldown__title {
    font-family: var(--font-display); font-weight: 700; font-size: 20px;
    margin-top: 2px; letter-spacing: -0.01em;
  }
  @media (max-width: 600px) {
    .punch-card { padding: 14px 14px 16px; }
    .punch-step { padding: 10px 12px; }
    .punch-cooldown { padding: 14px 16px; gap: 12px; }
    .punch-cooldown__icon { width: 44px; height: 44px; }
    .punch-cooldown__icon svg { width: 24px; height: 24px; }
    .punch-cooldown__title { font-size: 17px; }
  }

  .cam-modal { display: none; position: fixed; inset: 0; z-index: 90; }
  .cam-modal.is-open { display: block; }
  .cam-modal__scrim { position: absolute; inset: 0; background: #000; }
  .cam-modal__sheet {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    background: #0a0a0a; color: var(--cream);
  }
  .cam-modal__head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px;
    padding-top: max(14px, env(safe-area-inset-top));
    color: rgba(255,255,255,0.8);
    background: rgba(0,0,0,0.4);
    position: relative; z-index: 2;
  }
  .cam-modal__close {
    width: 40px; height: 40px; border-radius: 50%;
    background: rgba(255,255,255,0.12); border: 0; color: var(--cream);
    display: grid; place-items: center; cursor: pointer;
  }
  .cam-modal__close:active { background: rgba(255,255,255,0.2); }
  .cam-modal__stage {
    position: relative; flex: 1;
    display: grid; place-items: center;
    overflow: hidden; min-height: 0;
  }
  .cam-modal__stage video,
  .cam-modal__stage img {
    width: 100%; height: 100%; object-fit: cover;
    transform: scaleX(-1);
  }
  .cam-modal__overlay {
    position: absolute; inset: 0;
    display: grid; place-items: center;
    background: rgba(0,0,0,0.65); color: var(--cream);
    font-size: 14px; text-align: center; padding: 20px;
    pointer-events: none;
    transition: opacity var(--t-fast) var(--ease);
  }
  .cam-modal__overlay.is-hidden { opacity: 0; }
  .cam-modal__controls {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 20px;
    padding-bottom: max(20px, env(safe-area-inset-bottom));
    background: rgba(0,0,0,0.55);
    position: relative; z-index: 2;
  }
  .cam-shutter {
    width: 72px; height: 72px; border-radius: 50%;
    background: var(--cream); border: 5px solid rgba(255,255,255,0.4);
    cursor: pointer; transition: transform var(--t-fast) var(--ease);
    flex-shrink: 0;
  }
  .cam-shutter:active { transform: scale(0.92); background: var(--orange-soft); }
  .cam-shutter:disabled { opacity: 0.4; cursor: not-allowed; }
  .cam-modal__controls .btn { min-width: 100px; justify-content: center; }
  .cam-modal__controls .btn--ghost {
    background: rgba(255,255,255,0.1); color: var(--cream); border-color: rgba(255,255,255,0.2);
  }
  .cam-modal__controls .btn--ghost:hover { background: rgba(255,255,255,0.18); }
  @media (min-width: 800px) {
    .cam-modal__sheet {
      inset: auto;
      left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: min(560px, 92vw); height: min(720px, 92vh);
      border-radius: var(--r-4); overflow: hidden;
      box-shadow: 0 30px 80px -20px rgba(0,0,0,0.6);
    }
  }
`;

/* ------------------------------------------------------------------ */
/* Blob → base64 helper                                                */
/* ------------------------------------------------------------------ */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const result = r.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("Failed to read blob"));
    };
    r.onerror = () => reject(r.error ?? new Error("FileReader failed"));
    r.readAsDataURL(blob);
  });
}

/**
 * Re-encode a JPEG/PNG Blob at most `maxDim` on its longest side, with the
 * given JPEG `quality`. Keeps the original aspect ratio. Falls back to the
 * input blob if the browser can't do the operation.
 */
async function downscaleJpegBlob(input: Blob, maxDim: number, quality: number): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(input);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return input;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b ?? input), "image/jpeg", quality);
    });
  } catch {
    return input;
  }
}
