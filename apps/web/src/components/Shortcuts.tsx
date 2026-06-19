import {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@crestly/icons";

/* ============================================================
   Global keyboard shortcuts + cheat-sheet overlay.

   Two layers:
     1. ShortcutsProvider — installs global hotkeys (g d, g s,
        ?, /, etc.) and exposes a useShortcut() hook so pages
        can register their own (e.g. "n" → new student on the
        students list).
     2. ShortcutsCheatSheet — full-screen overlay showing every
        registered shortcut grouped by section. Pressing "?" or
        "Shift+/" toggles it.

   Shortcuts are skipped automatically while the user is typing
   in an input / textarea / contenteditable, so "n" on the
   admission enquiry form doesn't trigger "new student".

   Vim-style two-key sequences (g then d) are supported via a
   600ms window; press the leader, then the follower.
   ============================================================ */

interface Shortcut {
  /** Display key, e.g. "?", "g s", "Cmd+K". Used only in the cheat sheet. */
  keys: string;
  /** What it does, one short phrase. */
  description: string;
  /** Where to file it in the overlay. */
  group: "Navigation" | "On this page" | "Global";
  /** Function to call. */
  handler: () => void;
  /** True (default) → skipped while typing in a form field. */
  blockInInputs?: boolean;
}

interface ShortcutsApi {
  /** Register a shortcut for the lifetime of the calling component. */
  register: (shortcut: Shortcut) => () => void;
  /** Open the cheat sheet overlay (also bound to ?). */
  showSheet: () => void;
  /** Snapshot of currently-active shortcuts. */
  all: Shortcut[];
}

const Ctx = createContext<ShortcutsApi | null>(null);

export function useShortcuts(): ShortcutsApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShortcuts() must be inside <ShortcutsProvider>");
  return ctx;
}

/** Sugar — register a single shortcut for this component's lifetime. */
export function useShortcut(shortcut: Shortcut) {
  const { register } = useShortcuts();
  useEffect(() => register(shortcut), [register, shortcut]);
}

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [, force] = useState(0);
  const sheetRef = useRef<{ open: boolean }>({ open: false });
  const registry = useRef<Shortcut[]>([]);

  const register = useCallback((shortcut: Shortcut): (() => void) => {
    registry.current = [...registry.current, shortcut];
    force((v) => v + 1);
    return () => {
      registry.current = registry.current.filter((s) => s !== shortcut);
      force((v) => v + 1);
    };
  }, []);

  const showSheet = useCallback(() => {
    sheetRef.current.open = true;
    force((v) => v + 1);
  }, []);
  const hideSheet = useCallback(() => {
    sheetRef.current.open = false;
    force((v) => v + 1);
  }, []);

  // Built-in shortcuts — registered once on mount so they always exist.
  useEffect(() => {
    const builtins: Shortcut[] = [
      { keys: "?",   description: "Show this list of shortcuts",       group: "Global",     handler: showSheet,                  blockInInputs: true },
      { keys: "/",   description: "Focus the global search (spotlight)", group: "Global",   handler: () => fireKey("k", { meta: true }), blockInInputs: true },
      { keys: "Esc", description: "Close modal / overlay",             group: "Global",     handler: () => fireKey("Escape"),    blockInInputs: false },
      { keys: "g d", description: "Go to Dashboard",                   group: "Navigation", handler: () => navigate("/") },
      { keys: "g s", description: "Go to Students",                    group: "Navigation", handler: () => navigate("/students") },
      { keys: "g f", description: "Go to Fee Ledger",                  group: "Navigation", handler: () => navigate("/fee-ledger") },
      { keys: "g a", description: "Go to Attendance",                  group: "Navigation", handler: () => navigate("/attendance") },
      { keys: "g t", description: "Go to Timetable",                   group: "Navigation", handler: () => navigate("/timetable") },
      { keys: "g v", description: "Go to Vouchers",                    group: "Navigation", handler: () => navigate("/vouchers") },
      { keys: "g e", description: "Go to Exams",                       group: "Navigation", handler: () => navigate("/exams") },
      { keys: "g c", description: "Go to Classes",                     group: "Navigation", handler: () => navigate("/classes") },
      { keys: "g x", description: "Go to Settings",                    group: "Navigation", handler: () => navigate("/settings") },
    ];
    const unsubs = builtins.map((s) => register(s));
    return () => unsubs.forEach((u) => u());
  }, [register, navigate, showSheet]);

  // The actual key listener. Tracks the leader for vim-style sequences.
  useEffect(() => {
    let leader: string | null = null;
    let leaderTimer: number | null = null;
    function clearLeader() {
      leader = null;
      if (leaderTimer) { window.clearTimeout(leaderTimer); leaderTimer = null; }
    }
    function inField(e: KeyboardEvent): boolean {
      const t = e.target as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (t.isContentEditable) return true;
      return false;
    }
    function onKey(e: KeyboardEvent) {
      // Ignore when a modifier is held (so Cmd+K etc. don't get hijacked here).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // "?" is shift+/ on most layouts — accept both forms.
      const key = e.key;

      // Two-key sequence: a previously-pressed leader matches.
      if (leader) {
        const combo = `${leader} ${key.toLowerCase()}`;
        const match = registry.current.find((s) => s.keys.toLowerCase() === combo);
        if (match && (!match.blockInInputs || !inField(e))) {
          e.preventDefault();
          clearLeader();
          match.handler();
          return;
        }
        clearLeader();
      }

      // Single-key match.
      const directMatch = registry.current.find((s) => s.keys === key);
      if (directMatch && (!directMatch.blockInInputs || !inField(e))) {
        e.preventDefault();
        directMatch.handler();
        return;
      }

      // Leader candidate? Anything that's the first half of a two-key shortcut.
      const lower = key.toLowerCase();
      const isLeader = registry.current.some((s) =>
        s.keys.toLowerCase().startsWith(`${lower} `),
      );
      if (isLeader && !inField(e)) {
        e.preventDefault();
        leader = lower;
        leaderTimer = window.setTimeout(clearLeader, 600);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearLeader();
    };
  }, []);

  const api = useMemo<ShortcutsApi>(() => ({
    register, showSheet, all: registry.current,
  }), [register, showSheet]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {sheetRef.current.open && (
        <CheatSheetOverlay
          shortcuts={registry.current}
          onClose={hideSheet}
        />
      )}
    </Ctx.Provider>
  );
}

/** Re-export so AppShell can mount the overlay separately if desired.
 *  Currently the provider already renders it conditionally; this is a no-op
 *  alias kept for symmetry with how Spotlight + AiAssistant are mounted. */
export function ShortcutsCheatSheet() { return null; }

/* ------------------------------------------------------------ */
/* The overlay                                                   */
/* ------------------------------------------------------------ */

function CheatSheetOverlay({
  shortcuts, onClose,
}: {
  shortcuts: Shortcut[];
  onClose: () => void;
}) {
  // Escape to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Group + dedupe (last-registered wins for "keys" collisions, e.g. page-
  // specific override of a global).
  const groups = useMemo(() => {
    const byKey = new Map<string, Shortcut>();
    for (const s of shortcuts) byKey.set(s.keys, s);
    const list = Array.from(byKey.values());
    return {
      Global:           list.filter((s) => s.group === "Global"),
      Navigation:       list.filter((s) => s.group === "Navigation"),
      "On this page":   list.filter((s) => s.group === "On this page"),
    };
  }, [shortcuts]);

  return (
    <div className="sheat-scrim" onClick={onClose} role="dialog" aria-label="Keyboard shortcuts">
      <div className="sheat" onClick={(e) => e.stopPropagation()}>
        <div className="sheat__head">
          <h2 className="sheat__title">Keyboard shortcuts</h2>
          <button type="button" className="sheat__close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="sheat__body">
          {(Object.entries(groups) as [keyof typeof groups, Shortcut[]][]).map(([title, items]) =>
            items.length === 0 ? null : (
              <section key={title} className="sheat__group">
                <h3 className="sheat__grouph">{title}</h3>
                <div className="sheat__rows">
                  {items.map((s) => (
                    <div key={s.keys + s.description} className="sheat__row">
                      <span className="sheat__desc">{s.description}</span>
                      <span className="sheat__keys">
                        {s.keys.split(" ").map((k, i) => (
                          <span key={i} className="kbd">{k}</span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
        <div className="sheat__foot muted body-s">
          Press <span className="kbd">?</span> any time to open this list.
          Shortcuts are skipped while typing in a field.
        </div>
      </div>
      <style>{SHEET_CSS}</style>
    </div>
  );
}

/* ------------------------------------------------------------ */
/* Helpers                                                       */
/* ------------------------------------------------------------ */

/** Synthesize a key event — used to redispatch Esc / Cmd+K to other
 *  global listeners (Spotlight, modals) so we keep one source of truth. */
function fireKey(key: string, opts?: { meta?: boolean }) {
  const e = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    metaKey: !!opts?.meta,
    ctrlKey: !!opts?.meta,
  });
  document.dispatchEvent(e);
}

const SHEET_CSS = `
  .sheat-scrim {
    position: fixed; inset: 0; z-index: 240;
    background: rgba(16,13,10,.45);
    display: grid; place-items: center;
    padding: 20px;
    cursor: pointer;
    animation: sheat-fade .18s ease-out;
  }
  .sheat {
    background: var(--white);
    border-radius: 18px;
    width: 100%; max-width: 640px;
    max-height: calc(100vh - 80px);
    display: flex; flex-direction: column;
    overflow: hidden;
    cursor: default;
    box-shadow: 0 24px 60px rgba(16,13,10,.25);
    animation: sheat-pop .22s cubic-bezier(.16,1,.3,1);
  }
  .sheat__head {
    display: flex; align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--rule-soft);
  }
  .sheat__title {
    margin: 0; flex: 1;
    font-family: var(--font-display, system-ui);
    font-size: 17px; font-weight: 700; letter-spacing: -.01em;
  }
  .sheat__close {
    width: 30px; height: 30px; border-radius: 50%;
    border: 0; background: var(--cream-soft); color: var(--ink-60);
    cursor: pointer; display: grid; place-items: center;
  }
  .sheat__close:hover { background: var(--cream); }

  .sheat__body { padding: 8px 4px; overflow-y: auto; }
  .sheat__group { padding: 12px 16px; }
  .sheat__grouph {
    margin: 0 0 8px;
    font-family: var(--font-mono, monospace);
    font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase;
    color: var(--ink-60);
  }
  .sheat__rows { display: flex; flex-direction: column; gap: 2px; }
  .sheat__row {
    display: flex; align-items: center; gap: 12px;
    padding: 8px 10px;
    border-radius: 8px;
  }
  .sheat__row:hover { background: var(--cream-soft); }
  .sheat__desc { flex: 1; font-size: 13.5px; }
  .sheat__keys { display: inline-flex; gap: 4px; }
  .kbd {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 22px;
    padding: 2px 6px;
    border: 1px solid var(--rule);
    border-bottom-width: 2px;
    border-radius: 5px;
    background: var(--cream-soft);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--ink);
    line-height: 1;
  }

  .sheat__foot {
    padding: 12px 20px;
    border-top: 1px solid var(--rule-soft);
    background: var(--cream-soft);
  }

  @keyframes sheat-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sheat-pop  {
    from { opacity: 0; transform: scale(.96) translateY(8px); }
    to   { opacity: 1; transform: scale(1)   translateY(0);    }
  }
`;
