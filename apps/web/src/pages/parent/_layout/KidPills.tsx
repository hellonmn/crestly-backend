import { useSearchParams } from "react-router-dom";
import type { ParentKid } from "@crestly/shared";

/**
 * Horizontal pills to switch between siblings. Reads + writes the
 * ?sr= query param so the active child survives page navigation
 * inside the parent portal (e.g. switching from Attendance → Fees
 * keeps the same kid selected).
 *
 * Hides itself when the parent has only one child.
 */
export function KidPills({ kids }: { kids: ParentKid[] }) {
  const [sp, setSp] = useSearchParams();
  if (kids.length <= 1) return null;

  const activeSr = Number(sp.get("sr") || kids[0]!.srNumber);

  function pick(sr: number) {
    const next = new URLSearchParams(sp);
    next.set("sr", String(sr));
    setSp(next, { replace: true });
  }

  return (
    <div className="kp">
      {kids.map((k) => {
        const active = k.srNumber === activeSr;
        return (
          <button
            key={k.srNumber}
            type="button"
            className={"kp__pill " + (active ? "is-on" : "")}
            onClick={() => pick(k.srNumber)}
          >
            <span className="kp__avi">{initials(k.studentName)}</span>
            <span className="kp__name">{k.studentName.split(" ")[0]}</span>
            <span className="kp__cls">{k.classLabel}</span>
          </button>
        );
      })}
      <style>{KP_CSS}</style>
    </div>
  );
}

/** Resolve the currently-active SR from the URL — first kid as fallback. */
export function useActiveSr(kids: ParentKid[]): number {
  const [sp] = useSearchParams();
  if (kids.length === 0) return 0;
  const fromUrl = Number(sp.get("sr"));
  if (fromUrl && kids.some((k) => k.srNumber === fromUrl)) return fromUrl;
  return kids[0]!.srNumber;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "?").slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

const KP_CSS = `
  .kp {
    display: flex; gap: 8px;
    overflow-x: auto; padding: 0 4px 4px;
    margin-bottom: 16px;
    scrollbar-width: none;
  }
  .kp::-webkit-scrollbar { display: none; }
  .kp__pill {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 12px 6px 6px;
    background: var(--white);
    border: 1.5px solid var(--rule);
    border-radius: 999px;
    color: var(--ink);
    cursor: pointer;
    font: inherit;
    transition: border-color .15s ease;
    flex-shrink: 0;
  }
  .kp__pill:hover { border-color: var(--orange); }
  .kp__pill.is-on { border-color: var(--orange); background: var(--tint-wheat, #fcebd6); }
  .kp__avi {
    width: 26px; height: 26px;
    border-radius: 50%;
    background: var(--orange-deep, #b8410b);
    color: var(--cream);
    display: grid; place-items: center;
    font-size: 11px; font-weight: 800;
  }
  .kp__name { font-weight: 700; font-size: 13px; }
  .kp__cls  { font-size: 10.5px; color: var(--ink-40); font-family: var(--font-mono, monospace); letter-spacing: .04em; }
`;
