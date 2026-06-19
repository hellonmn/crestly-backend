import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { InstallPwaBanner } from "@/components/InstallPwaBanner";
import { Spotlight } from "@/components/Spotlight";
import { AiAssistant } from "@/components/AiAssistant";
import { ToastProvider } from "@/components/Toast";
import { ShortcutsProvider, ShortcutsCheatSheet } from "@/components/Shortcuts";

/**
 * Full Crestly app shell. The class names + DOM structure mirror
 * erp/includes/header.php + footer.php so the CSS imported from
 * @crestly/design (verbatim from /erp/assets/css/) applies identically.
 *
 * Pieces still to land here (Batch A.3 follow-up):
 *  - Mobile drawer open/close JS + scrim
 *  - Bottom-nav (3 role-aware tabs + More)
 *  - FAB (when child page sets it)
 *  - Install banner / update banner / PWA registration
 */
export function AppShell({ schoolName = "Crestly" }: { schoolName?: string }) {
  // TODO: hydrate from /api/auth/me → school.name + per-tenant brand override
  // <style id="school-theme">:root{--orange:...}</style>
  useEffect(() => {
    // Reveal hook from PHP — keeps things consistent if a stylesheet ever lags.
    document.documentElement.classList.add("css-ready");
  }, []);

  return (
    <ToastProvider>
      <ShortcutsProvider>
        <Topbar schoolName={schoolName} />
        <div className="scrim" id="drawer-scrim" aria-hidden="true" />
        <div className="app">
          <Sidebar schoolName={schoolName} />
          <main className="app__main">
            <Outlet />
          </main>
        </div>
        <InstallPwaBanner />
        <Spotlight />
        <AiAssistant />
        <ShortcutsCheatSheet />
        <style>{SHELL_OVERRIDES_CSS}</style>
      </ShortcutsProvider>
    </ToastProvider>
  );
}

/* Local overrides — by default @crestly/design hides the topbar on
   desktop (≥960px) because the original CSS expected the sidebar to
   carry the user widget there. We've moved both the user widget AND
   the brand-block into the topbar across every viewport. */
/* Topbar height — used in two places (the topbar itself and the
   body's padding-top so content doesn't disappear beneath it).
   Tall enough to hold the brand stack (logo block + name + sub-line). */
const TOPBAR_HEIGHT = 68;

const SHELL_OVERRIDES_CSS = `
  /* Base layers: paint everything from html down to ensure NO chrome
     / theme / extension can bleed through above the topbar. */
  html, body, #root {
    background: var(--white);
    margin: 0;
    padding: 0;
  }
  body { min-height: 100vh; }

  /* Topbar is FIXED — not sticky — so it always paints over the very
     top of the viewport regardless of body padding, parent overflow,
     or any browser quirk. Content pads down by TOPBAR_HEIGHT to clear it. */
  .topbar {
    display: flex !important;
    align-items: center;
    gap: 12px;
    position: fixed !important;
    top: 0; left: 0; right: 0;
    z-index: 100;
    min-height: ${TOPBAR_HEIGHT}px;
    padding: 8px 20px;
    background: var(--white);
    border-bottom: 1px solid var(--rule);
    box-sizing: border-box;
  }
  /* Logo + name strip on the left. The SVG must be a block so the
     line-height of any neighbouring text doesn't crop its top edge. */
  .topbar__brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex: 0 0 auto;
    min-width: 0;
  }
  .topbar__brand svg,
  .topbar__brand img {
    display: block;
    flex-shrink: 0;
  }

  /* Push the rest of the app down so it sits below the fixed topbar. */
  body { padding-top: ${TOPBAR_HEIGHT}px; }

  /* The main content area keeps the cream-soft surface. */
  .app, .app__main { background: var(--cream-soft); }

  @media (min-width: 960px) {
    /* Sidebar's huge brand-block is redundant on desktop — only show
       it inside the mobile drawer. */
    .app__nav .brand-block--mobile-only { display: none; }
    /* Sidebar pins to TOPBAR_HEIGHT (not 0) so it never slides under
       the fixed topbar. Height shrinks accordingly so the bottom of
       the sidebar matches the viewport bottom. */
    .app__nav {
      padding-top: 12px;
      top: ${TOPBAR_HEIGHT}px !important;
      height: calc(100vh - ${TOPBAR_HEIGHT}px) !important;
    }
  }

  @media (max-width: 959.98px) {
    .app__nav .brand-block--mobile-only { display: flex; }
  }

  /* Scrim / install banner / spotlight all need to sit above the
     topbar, so bump their z-index above 100. */
  .scrim          { z-index: 110 !important; }
  .spotlight-scrim, .spotlight { z-index: 1000 !important; }
`;
