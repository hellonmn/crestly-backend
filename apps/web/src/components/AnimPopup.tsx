import { useEffect } from "react";
import { Anim, type AnimName } from "./Anim";

/* ============================================================
   Centered popup with a hero Lottie animation + message.

   Designed for one-shot moments — save success, delete confirm,
   payment captured, etc. Backdrop is a soft scrim (lighter than
   a real modal) and clicking anywhere closes early. Auto-closes
   when the animation finishes OR after `autoCloseMs` (whichever
   the caller picks).

   Usage:
     <AnimPopup
       open={!!flash}
       type="success"
       message={flash}
       onClose={() => setFlash(null)}
     />
   ============================================================ */

export interface AnimPopupProps {
  open: boolean;
  /** Which animation to play. Maps directly to <Anim name={...}>. */
  type: AnimName;
  /** Main line shown under the animation. */
  message: string;
  /** Optional smaller sub-line under the message. */
  sub?: string;
  /** Auto-dismiss timer in ms. Default 2500. Pass 0 to disable. */
  autoCloseMs?: number;
  /** Animation size in px. Default 180. */
  size?: number;
  onClose: () => void;
}

export function AnimPopup({
  open, type, message, sub, autoCloseMs = 2500, size = 180, onClose,
}: AnimPopupProps) {
  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-dismiss timer.
  useEffect(() => {
    if (!open || !autoCloseMs) return;
    const t = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(t);
  }, [open, autoCloseMs, onClose]);

  if (!open) return null;

  return (
    <div
      className="anim-popup"
      role="status"
      aria-live="polite"
      onClick={onClose}
    >
      <div
        className="anim-popup__card"
        onClick={(e) => e.stopPropagation()}
      >
        <Anim
          name={type}
          size={size}
          onComplete={!autoCloseMs ? onClose : undefined}
        />
        <div className="anim-popup__msg">{message}</div>
        {sub && <div className="anim-popup__sub muted body-s">{sub}</div>}
      </div>
      <style>{POPUP_CSS}</style>
    </div>
  );
}

const POPUP_CSS = `
  .anim-popup {
    position: fixed; inset: 0;
    z-index: 250;                         /* above modals (200) + topbar (100) */
    display: grid; place-items: center;
    padding: 20px;
    background: rgba(16, 13, 10, 0.35);
    animation: anim-popup-fade .18s ease-out;
    cursor: pointer;
  }
  .anim-popup__card {
    background: var(--white);
    border-radius: 18px;
    padding: 24px 32px 22px;
    min-width: 280px;
    max-width: calc(100vw - 40px);
    box-shadow: 0 24px 60px rgba(16, 13, 10, 0.22);
    text-align: center;
    cursor: default;
    animation: anim-popup-pop .22s cubic-bezier(.16,1,.3,1);
  }
  .anim-popup__msg {
    font-family: var(--font-display, system-ui);
    font-weight: 700;
    font-size: 18px;
    letter-spacing: -0.01em;
    margin-top: 4px;
    color: var(--ink);
  }
  .anim-popup__sub { margin-top: 6px; }

  @keyframes anim-popup-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes anim-popup-pop {
    from { opacity: 0; transform: scale(.92) translateY(8px); }
    to   { opacity: 1; transform: scale(1)  translateY(0); }
  }
`;
