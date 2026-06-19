import {
  createContext, useCallback, useContext,
  useMemo, useRef, useState,
} from "react";
import { Icon } from "@crestly/icons";

/* ============================================================
   Global toast system with undoable destructive actions.

   The undo pattern is "deferred mutation" — the actual API
   call doesn't fire until the toast's countdown expires. If
   the user clicks Undo within that window, the call is
   cancelled and nothing was ever sent to the server.

   Usage:
     const toast = useToast();

     // Plain notifications
     toast.success("Period saved");
     toast.error("Save failed");
     toast.info("WhatsApp queued");

     // Undoable destructive action — the doFn runs AFTER the
     // toast times out, only if the user didn't click Undo.
     async function onDelete(p) {
       const result = await toast.undoable(
         `Deleted ${p.name}`,
         () => api.delete(`/periods/${p.id}`),
         { timeoutMs: 5000 },
       );
       if (result === "undone") return;
       if (result === "failed") return; // doFn threw; toast already showed error
       // result === "done" — the row really is gone
     }

   The provider is mounted in AppShell, so every page has
   access to useToast() without extra setup.
   ============================================================ */

type ToastKind = "success" | "error" | "info" | "undoable";

interface ToastSpec {
  id: number;
  kind: ToastKind;
  message: string;
  /** Undoable toasts only — visible label of the undo button. */
  actionLabel?: string;
  /** Called when the user clicks the action button. */
  onAction?: () => void;
  /** ms until the toast auto-dismisses (and for undoable, fires the deferred action). */
  timeoutMs: number;
}

interface UndoableOptions {
  timeoutMs?: number;
  /** Override the undo button label. Default "Undo". */
  undoLabel?: string;
}

type UndoableResult = "undone" | "done" | "failed";

interface ToastApi {
  success: (message: string, opts?: { timeoutMs?: number }) => void;
  error:   (message: string, opts?: { timeoutMs?: number }) => void;
  info:    (message: string, opts?: { timeoutMs?: number }) => void;
  /** Show a toast with an Undo button; only fire `doFn` after the timeout if not cancelled.
   *  Resolves with "undone" | "done" | "failed". */
  undoable: (message: string, doFn: () => Promise<unknown> | void, opts?: UndoableOptions) => Promise<UndoableResult>;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    throw new Error("useToast() must be called inside <ToastProvider>");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastSpec[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((spec: Omit<ToastSpec, "id">): number => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { ...spec, id }]);
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => {
    function simple(kind: "success" | "error" | "info") {
      return (message: string, opts?: { timeoutMs?: number }) => {
        const timeoutMs = opts?.timeoutMs ?? (kind === "error" ? 4500 : 2800);
        const id = push({ kind, message, timeoutMs });
        window.setTimeout(() => dismiss(id), timeoutMs);
      };
    }
    return {
      success: simple("success"),
      error:   simple("error"),
      info:    simple("info"),
      undoable: (message, doFn, opts) =>
        new Promise<UndoableResult>((resolve) => {
          const timeoutMs = opts?.timeoutMs ?? 5000;
          let undone = false;
          const id = push({
            kind: "undoable",
            message,
            actionLabel: opts?.undoLabel ?? "Undo",
            onAction: () => {
              undone = true;
              dismiss(id);
              resolve("undone");
            },
            timeoutMs,
          });
          window.setTimeout(async () => {
            if (undone) return;        // already resolved by Undo click
            dismiss(id);
            try {
              await doFn();
              resolve("done");
            } catch (e) {
              // Show an error toast and surface the failure.
              const msg = (e instanceof Error && e.message) || "Action failed";
              const errId = push({ kind: "error", message: msg, timeoutMs: 4500 });
              window.setTimeout(() => dismiss(errId), 4500);
              resolve("failed");
            }
          }, timeoutMs);
        }),
    };
  }, [push, dismiss]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} onAction={(t) => t.onAction?.()} onDismiss={dismiss} />
      <style>{TOAST_CSS}</style>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------ */
/* Render                                                        */
/* ------------------------------------------------------------ */

function ToastStack({
  toasts, onAction, onDismiss,
}: {
  toasts: ToastSpec[];
  onAction: (t: ToastSpec) => void;
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onAction={() => onAction(t)} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast, onAction, onDismiss,
}: {
  toast: ToastSpec;
  onAction: () => void;
  onDismiss: () => void;
}) {
  const tone = toast.kind === "error" ? "err"
    : toast.kind === "success" ? "ok"
    : toast.kind === "undoable" ? "undo"
    : "info";
  return (
    <div className={`toast toast--${tone}`} role="status">
      <ToastIcon kind={toast.kind} />
      <span className="toast__msg">{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button type="button" className="toast__action" onClick={onAction}>
          {toast.actionLabel}
        </button>
      )}
      <button
        type="button"
        className="toast__close"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <Icon name="x" size={12} />
      </button>
      {toast.kind === "undoable" && (
        <span
          className="toast__bar"
          style={{ animationDuration: `${toast.timeoutMs}ms` }}
        />
      )}
    </div>
  );
}

function ToastIcon({ kind }: { kind: ToastKind }) {
  // Small inline glyphs, not Lottie — toasts come/go fast and the heavy
  // animation would distract from the message.
  if (kind === "success")
    return <Icon name="check" size={14} className="toast__icon" />;
  if (kind === "error")
    return <Icon name="alert" size={14} className="toast__icon" />;
  if (kind === "undoable")
    return <Icon name="trash" size={14} className="toast__icon" />;
  return <Icon name="info" size={14} className="toast__icon" />;
}

const TOAST_CSS = `
  .toast-stack {
    position: fixed;
    right: 22px;
    bottom: 90px;                  /* sits above the AI assistant FAB */
    z-index: 220;                  /* above modals (200), below popups (250) */
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    pointer-events: none;
    max-width: calc(100vw - 44px);
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 10px 14px;
    background: var(--ink);
    color: var(--cream);
    border-radius: 10px;
    box-shadow: 0 10px 24px rgba(16,13,10,.25), 0 2px 6px rgba(16,13,10,.12);
    min-width: 260px;
    max-width: 420px;
    font-size: 13.5px;
    position: relative;
    overflow: hidden;
    animation: toast-in .22s cubic-bezier(.16,1,.3,1);
  }
  .toast--ok    { background: #1f6f4a; }
  .toast--err   { background: #b91c1c; }
  .toast--info  { background: var(--ink); }
  .toast--undo  { background: var(--ink); }

  .toast__icon { flex-shrink: 0; opacity: .9; }
  .toast__msg  { flex: 1; min-width: 0; }
  .toast__action {
    background: transparent;
    border: 1px solid rgba(255,255,255,.35);
    color: inherit;
    padding: 4px 10px;
    border-radius: 6px;
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background .12s ease, border-color .12s ease;
  }
  .toast__action:hover {
    background: rgba(255,255,255,.12);
    border-color: rgba(255,255,255,.55);
  }
  .toast__close {
    background: transparent; border: 0; color: inherit;
    width: 22px; height: 22px; border-radius: 50%;
    cursor: pointer; opacity: .55;
    display: grid; place-items: center;
  }
  .toast__close:hover { opacity: 1; background: rgba(255,255,255,.12); }

  /* Countdown bar for undoable toasts. */
  .toast__bar {
    position: absolute;
    left: 0; bottom: 0;
    height: 3px;
    background: rgba(255,255,255,.55);
    width: 100%;
    transform-origin: left;
    animation: toast-bar linear forwards;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateY(8px) scale(.96); }
    to   { opacity: 1; transform: translateY(0)   scale(1); }
  }
  @keyframes toast-bar {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0); }
  }

  @media (max-width: 600px) {
    .toast-stack { right: 12px; left: 12px; bottom: 100px; }
    .toast       { min-width: 0; max-width: none; }
  }
`;
