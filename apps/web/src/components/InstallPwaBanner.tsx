import { useEffect, useState } from "react";
import { Icon } from "@crestly/icons";

interface BIPE extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "crestly.install.dismissed";
const STANDALONE = window.matchMedia("(display-mode: standalone)").matches
  || (window.navigator as { standalone?: boolean }).standalone === true;

/**
 * "Install app" banner — mirrors the legacy erp/includes/footer.php pattern.
 * Only shows on mobile-ish viewports when not already installed and not
 * previously dismissed. The user can re-trigger via Settings → Install app
 * later (Batch I).
 */
export function InstallPwaBanner() {
  const [prompt, setPrompt] = useState<BIPE | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "1");

  useEffect(() => {
    if (STANDALONE || dismissed) return;
    function onPrompt(e: Event) {
      e.preventDefault();
      setPrompt(e as BIPE);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [dismissed]);

  if (!prompt || dismissed || STANDALONE) return null;

  async function onInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") {
      setPrompt(null);
    } else {
      localStorage.setItem(DISMISSED_KEY, "1");
      setDismissed(true);
    }
  }

  function onClose() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 12, right: 12, bottom: 84,
        background: "var(--ink)", color: "var(--cream)",
        padding: "12px 14px", borderRadius: 10,
        display: "flex", gap: 10, alignItems: "center",
        boxShadow: "var(--shadow-2)", zIndex: 60,
        maxWidth: 440, margin: "0 auto",
      }}
      role="dialog"
      aria-label="Install Crestly app"
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Install Crestly</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>One-tap access from your home screen.</div>
      </div>
      <button className="btn btn--primary btn--sm" onClick={onInstall}>Install</button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        style={{
          background: "transparent", border: 0, color: "var(--cream)",
          width: 28, height: 28, borderRadius: 999, cursor: "pointer",
          display: "grid", placeItems: "center", opacity: 0.7,
        }}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
