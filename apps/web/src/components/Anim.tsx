import { useMemo } from "react";
import Lottie from "lottie-react";

/* ============================================================
   Lottie wrapper.

   Pre-bundled set of named animations. Add a new one by dropping
   its JSON into ../assets/lottie/<name>.json — Vite's eager-glob
   import picks it up at build time. If a file is missing, <Anim>
   renders a tiny fallback icon (a circle / cross / etc.) so the
   page never crashes during development.

   Usage:
     <Anim name="success" size={120} />
     <Anim name="loading" size={64} loop />
     <Anim name="processing" size={200} loop autoplay />
     <Anim name="success" size={80} onComplete={() => close()} />
   ============================================================ */

const FILES = import.meta.glob<{ default: object }>(
  "../assets/lottie/*.json",
  { eager: true },
);

/** Map of stem-name → JSON payload, e.g. `{ success: {...}, error: {...} }`. */
const ANIMATIONS: Record<string, object> = (() => {
  const out: Record<string, object> = {};
  for (const [path, mod] of Object.entries(FILES)) {
    const stem = path.split("/").pop()?.replace(/\.json$/, "");
    if (stem) out[stem] = mod.default;
  }
  return out;
})();

/** All animations the app expects. If a file is missing, the wrapper
 *  renders a fallback icon so dev-time doesn't crash and you can see
 *  exactly which ones still need to be supplied. */
export type AnimName =
  | "success"
  | "error"
  | "empty"
  | "loading"
  | "processing"
  | "payment-success"
  | "payment-failed"
  | "whatsapp-sent"
  | "delete";

export interface AnimProps {
  name: AnimName;
  /** Pixel size for both width and height. Default 120. */
  size?: number;
  /** Loop the animation. Default false for success/error/delete
   *  (one-shot), true for loading/processing. */
  loop?: boolean;
  /** Autoplay on mount. Default true. */
  autoplay?: boolean;
  /** Fires when a non-looping animation finishes. */
  onComplete?: () => void;
  /** Optional className on the wrapping span. */
  className?: string;
}

export function Anim({
  name, size = 120, loop, autoplay = true, onComplete, className,
}: AnimProps) {
  const data = ANIMATIONS[name];
  // Loop defaults: looping for the "ongoing" animations, one-shot for events.
  const looping = loop ?? ONGOING.has(name);

  // Stable object so Lottie doesn't reinitialise on every render.
  const animationData = useMemo(() => data, [data]);

  if (!data) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[Anim] missing animation "${name}". Drop the JSON at apps/web/src/assets/lottie/${name}.json`);
    }
    return <FallbackIcon name={name} size={size} className={className} />;
  }

  return (
    <span
      className={className}
      style={{ display: "inline-block", width: size, height: size, lineHeight: 0 }}
      aria-hidden="true"
    >
      <Lottie
        animationData={animationData}
        loop={looping}
        autoplay={autoplay}
        onComplete={onComplete}
        style={{ width: "100%", height: "100%" }}
      />
    </span>
  );
}

/** Names that should loop by default (no natural "end" event). */
const ONGOING = new Set<AnimName>(["loading", "processing"]);

/** Quick CSS-only fallback so a missing JSON file doesn't crash the
 *  page. Picks a colour + glyph that matches the animation's intent. */
function FallbackIcon({ name, size, className }: { name: AnimName; size: number; className?: string }) {
  const styles: Record<AnimName, { bg: string; fg: string; glyph: string }> = {
    success:           { bg: "var(--success, #16a34a)", fg: "#fff", glyph: "✓" },
    error:             { bg: "var(--error, #b91c1c)",   fg: "#fff", glyph: "!" },
    empty:             { bg: "var(--cream-soft, #f6efe5)", fg: "var(--ink-60, #6b6358)", glyph: "∅" },
    loading:           { bg: "var(--cream-soft, #f6efe5)", fg: "var(--ink-60, #6b6358)", glyph: "…" },
    processing:        { bg: "var(--cream-soft, #f6efe5)", fg: "var(--orange, #f97316)", glyph: "⚙" },
    "payment-success": { bg: "var(--success, #16a34a)", fg: "#fff", glyph: "₹✓" },
    "payment-failed":  { bg: "var(--error, #b91c1c)",   fg: "#fff", glyph: "₹✗" },
    "whatsapp-sent":   { bg: "#25D366",                  fg: "#fff", glyph: "✓" },
    delete:            { bg: "var(--error, #b91c1c)",   fg: "#fff", glyph: "✗" },
  };
  const s = styles[name];
  return (
    <span
      className={className}
      role="img"
      aria-label={name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: s.bg,
        color: s.fg,
        fontSize: Math.max(14, Math.round(size * 0.4)),
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {s.glyph}
    </span>
  );
}
