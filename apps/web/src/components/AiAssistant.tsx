import { useEffect, useRef, useState } from "react";
import { Icon } from "@crestly/icons";
import { useAiAsk, useAiSettings } from "@/pages/ai/hooks";
import { getErrorMessage } from "@/lib/api";
import type { AiChatMessage } from "@crestly/shared";

/* ============================================================
   Floating AI chat panel.

   Renders nothing unless the tenant has enabled the assistant.
   When enabled, shows a circular button at bottom-right; click
   it to open a slide-up chat panel (480×620 desktop, full-screen
   on mobile).

   Conversation history is kept in component state — refreshing
   the page clears it. We send the whole history each turn so the
   model has context.
   ============================================================ */

const SUGGESTIONS = [
  "Aaj ka fee collection?",
  "Class 6A ki attendance today",
  "Top 5 pending fees",
  "Find student named Rohit",
];

export function AiAssistant() {
  const { data: settings } = useAiSettings();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ask = useAiAsk();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, ask.isPending]);

  if (!settings?.enabled) return null;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setErr(null);
    const next: AiChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    try {
      const res = await ask.mutateAsync({ messages: next });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setErr(getErrorMessage(e, "AI request failed"));
      // Roll back the optimistic user message so the user can retry.
      setMessages(messages);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          type="button"
          className="ai-fab"
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant"
        >
          <Icon name="msg" size={22} />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="ai-panel" role="dialog" aria-label="AI assistant">
          <div className="ai-panel__head">
            <div className="ai-panel__brand">
              <span className="ai-panel__dot" />
              <div>
                <div className="ai-panel__title">Assistant</div>
                <div className="ai-panel__sub">{settings.model}</div>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                className="ai-panel__icon-btn"
                onClick={() => { setMessages([]); setErr(null); }}
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                <Icon name="trash" size={16} />
              </button>
            )}
            <button
              type="button"
              className="ai-panel__icon-btn"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          <div className="ai-panel__body" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="ai-panel__empty">
                <div className="ai-panel__hello">
                  Hi! Ask me anything about today's collections, attendance, students, or fees.
                </div>
                <div className="ai-panel__suggest-label">Try one of these:</div>
                <div className="ai-panel__suggest">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="ai-panel__chip"
                      onClick={() => send(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`ai-msg ai-msg--${m.role}`}>
                  <div className="ai-msg__bubble">{m.content}</div>
                </div>
              ))
            )}
            {ask.isPending && (
              <div className="ai-msg ai-msg--assistant">
                <div className="ai-msg__bubble ai-msg__bubble--typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            {err && (
              <div className="ai-msg ai-msg--assistant">
                <div className="ai-msg__bubble ai-msg__bubble--err">{err}</div>
              </div>
            )}
          </div>

          <form className="ai-panel__form" onSubmit={onSubmit}>
            <input
              className="input ai-panel__input"
              placeholder="Ask anything…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={ask.isPending}
              autoFocus
            />
            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={ask.isPending || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      )}

      <style>{AI_CSS}</style>
    </>
  );
}

const AI_CSS = `
  .ai-fab {
    position: fixed; right: 22px; bottom: 22px; z-index: 150;
    width: 54px; height: 54px; border-radius: 50%; border: 0;
    background: var(--orange); color: var(--cream); cursor: pointer;
    box-shadow: 0 14px 30px rgba(242, 92, 25, 0.42), 0 4px 10px rgba(16,13,10,.15);
    display: grid; place-items: center;
    transition: transform .14s ease, box-shadow .14s ease;
  }
  .ai-fab:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 36px rgba(242, 92, 25, 0.5), 0 5px 12px rgba(16,13,10,.18);
  }

  .ai-panel {
    position: fixed; right: 22px; bottom: 22px; z-index: 150;
    width: 420px; height: 620px; max-height: calc(100vh - 44px);
    background: var(--white); border-radius: 18px;
    box-shadow: 0 24px 60px rgba(16,13,10,.22);
    display: flex; flex-direction: column; overflow: hidden;
    animation: ai-panel-pop .22s cubic-bezier(.16,1,.3,1);
  }
  @keyframes ai-panel-pop {
    from { opacity: 0; transform: translateY(12px) scale(.96); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }
  @media (max-width: 600px) {
    .ai-panel { right: 0; left: 0; bottom: 0; width: 100%; height: 100vh;
                max-height: 100vh; border-radius: 0; }
  }

  .ai-panel__head {
    display: flex; align-items: center; gap: 8px;
    padding: 14px 16px; border-bottom: 1px solid var(--rule-soft);
  }
  .ai-panel__brand { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
  .ai-panel__dot {
    width: 10px; height: 10px; border-radius: 50%; background: #16a34a;
    box-shadow: 0 0 0 4px rgba(22, 163, 74, .18);
    flex-shrink: 0;
  }
  .ai-panel__title { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; }
  .ai-panel__sub   { font-size: 11px; color: var(--ink-60); font-family: var(--font-mono, monospace); }
  .ai-panel__icon-btn {
    width: 30px; height: 30px; border-radius: 50%;
    border: 0; background: var(--cream-soft); color: var(--ink-60);
    cursor: pointer; display: grid; place-items: center;
  }
  .ai-panel__icon-btn:hover { background: var(--cream); }

  .ai-panel__body {
    flex: 1; overflow-y: auto;
    padding: 16px;
    display: flex; flex-direction: column; gap: 10px;
    background: var(--cream-soft);
  }
  .ai-panel__empty { display: flex; flex-direction: column; gap: 14px; margin: 8px 0; }
  .ai-panel__hello {
    font-family: var(--font-display, system-ui);
    font-size: 16px; font-weight: 600;
    color: var(--ink); line-height: 1.4;
  }
  .ai-panel__suggest-label {
    font-size: 11px; color: var(--ink-60);
    text-transform: uppercase; letter-spacing: .08em;
    margin-top: 4px;
  }
  .ai-panel__suggest { display: flex; flex-wrap: wrap; gap: 6px; }
  .ai-panel__chip {
    padding: 7px 12px;
    border: 1px solid var(--rule); border-radius: 999px;
    background: var(--white); color: var(--ink);
    font-size: 12.5px; cursor: pointer;
    transition: background .12s ease, border-color .12s ease;
  }
  .ai-panel__chip:hover { background: var(--tint-wheat); border-color: var(--orange); }

  .ai-msg { display: flex; }
  .ai-msg--user { justify-content: flex-end; }
  .ai-msg__bubble {
    max-width: 82%;
    padding: 9px 13px;
    border-radius: 14px;
    font-size: 13.5px; line-height: 1.45;
    white-space: pre-wrap; word-wrap: break-word;
  }
  .ai-msg--user .ai-msg__bubble {
    background: var(--orange); color: var(--cream);
    border-bottom-right-radius: 4px;
  }
  .ai-msg--assistant .ai-msg__bubble {
    background: var(--white); color: var(--ink);
    border: 1px solid var(--rule-soft);
    border-bottom-left-radius: 4px;
  }
  .ai-msg__bubble--err { color: var(--error, #b91c1c); border-color: var(--error, #b91c1c); }
  .ai-msg__bubble--typing { display: inline-flex; gap: 4px; padding: 12px 14px; }
  .ai-msg__bubble--typing span {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--ink-60);
    animation: ai-typing 1.2s infinite ease-in-out both;
  }
  .ai-msg__bubble--typing span:nth-child(2) { animation-delay: .15s; }
  .ai-msg__bubble--typing span:nth-child(3) { animation-delay: .3s;  }
  @keyframes ai-typing {
    0%, 80%, 100% { opacity: .25; transform: scale(.8); }
    40%           { opacity: 1;   transform: scale(1); }
  }

  .ai-panel__form {
    display: flex; gap: 8px; padding: 12px 14px;
    border-top: 1px solid var(--rule-soft);
    background: var(--white);
  }
  .ai-panel__input { flex: 1; }
`;
