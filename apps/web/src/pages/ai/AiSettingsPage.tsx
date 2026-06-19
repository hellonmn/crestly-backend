import { useEffect, useState } from "react";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { GROQ_MODELS } from "@crestly/shared";
import { useAiSettings, useSaveAiSettings, useTestAi } from "./hooks";
import { getErrorMessage } from "@/lib/api";
import type { AiTestResult } from "@crestly/shared";

/* ============================================================
   Settings → AI assistant
   Single tenant-scoped config — enable, provider, model, API key.
   ============================================================ */

export function AiSettingsPage() {
  const { data, isLoading, error, refetch, isFetching } = useAiSettings();
  const save = useSaveAiSettings();
  const test = useTestAi();

  const [enabled, setEnabled]   = useState(false);
  const [model, setModel]       = useState<string>("llama-3.3-70b-versatile");
  const [apiKey, setApiKey]     = useState<string>("");
  const [showKey, setShowKey]   = useState(false);
  const [keyEdited, setKeyEdited] = useState(false);
  const [testRes, setTestRes]   = useState<AiTestResult | null>(null);
  const [saveErr, setSaveErr]   = useState<string | null>(null);

  // Hydrate form when settings load.
  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setModel(data.model);
    setApiKey("");
    setKeyEdited(false);
  }, [data]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveErr(null);
    setTestRes(null);
    try {
      await save.mutateAsync({
        enabled,
        provider: "groq",
        model: model.trim(),
        // null = leave existing untouched; empty string = clear; string = set
        apiKey: keyEdited ? apiKey.trim() : null,
      });
      setKeyEdited(false);
      setApiKey("");
    } catch (e) {
      setSaveErr(getErrorMessage(e, "Failed to save settings"));
    }
  }

  async function onTest() {
    setTestRes(null);
    try {
      const r = await test.mutateAsync();
      setTestRes(r);
    } catch (e) {
      setTestRes({ ok: false, error: getErrorMessage(e, "Test failed") });
    }
  }

  return (
    <>
      <PageHead
        group="SETTINGS"
        meta="ASSISTANT"
        title="AI assistant"
        lede="Connect a Groq API key to enable the in-app assistant. Once enabled, a chat button appears in the bottom-right corner of every page so anyone with access can ask data questions in plain English (or Hindi)."
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="AI settings" />

      {isLoading ? (
        <div className="card" style={{ padding: 24 }}>
          <Skeleton height={20} width="40%" />
          <Skeleton height={40} width="100%" style={{ marginTop: 16 }} />
          <Skeleton height={40} width="100%" style={{ marginTop: 12 }} />
        </div>
      ) : data ? (
        <form onSubmit={onSave} className="card" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22 }}>

          {/* 01 — Enable */}
          <section className="form-section">
            <div className="form-section__head">
              <span className="form-section__num">01</span>
              <h3 className="form-section__title">Status</h3>
              <span className="muted body-s">Toggles the chat button + the /ai/ask endpoint.</span>
            </div>
            <label
              className="card"
              style={{
                padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer", borderColor: enabled ? "var(--orange)" : "var(--rule)",
                background: enabled ? "var(--tint-wheat)" : "var(--white)",
              }}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Enable AI assistant for this school</div>
                <div className="muted body-s">
                  When off, the chat button is hidden and the /ai/ask endpoint refuses calls.
                </div>
              </div>
              <span className={`chip chip--${enabled ? "success" : "muted"}`}>
                {enabled ? "ON" : "OFF"}
              </span>
            </label>
          </section>

          {/* 02 — Provider + model */}
          <section className="form-section">
            <div className="form-section__head">
              <span className="form-section__num">02</span>
              <h3 className="form-section__title">Model</h3>
              <span className="muted body-s">Groq's free-tier API serves Llama models fast.</span>
            </div>
            <div className="form-grid form-grid--2">
              <div className="field">
                <label className="field__label">Provider</label>
                <select className="select" value="groq" disabled>
                  <option value="groq">Groq</option>
                </select>
                <span className="field__hint">More providers coming.</span>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="ai-model">Model</label>
                <select
                  id="ai-model"
                  className="select"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {GROQ_MODELS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {!GROQ_MODELS.includes(model as (typeof GROQ_MODELS)[number]) && (
                    <option value={model}>{model} (custom)</option>
                  )}
                </select>
                <span className="field__hint">
                  Recommended: <code>llama-3.3-70b-versatile</code>. Bigger = smarter; smaller = faster.
                </span>
              </div>
            </div>
          </section>

          {/* 03 — API key */}
          <section className="form-section">
            <div className="form-section__head">
              <span className="form-section__num">03</span>
              <h3 className="form-section__title">API key</h3>
              <span className="muted body-s">
                Get one free from <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com</a>.
              </span>
            </div>
            <div className="field">
              {!keyEdited && data.hasKey ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <code style={{ padding: "8px 12px", background: "var(--cream-soft)", borderRadius: 6 }}>
                    {data.apiKey}
                  </code>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => { setKeyEdited(true); setApiKey(""); }}
                  >
                    Replace key
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type={showKey ? "text" : "password"}
                    className="input mono"
                    placeholder="gsk_…"
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setKeyEdited(true); }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? "Hide" : "Show"}
                  </button>
                  {data.hasKey && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => { setKeyEdited(false); setApiKey(""); }}
                    >
                      Keep current
                    </button>
                  )}
                </div>
              )}
              <span className="field__hint">
                Stored on the server, sent to Groq only at call time. Anyone in this school using the assistant uses this key.
              </span>
            </div>
          </section>

          {/* Save + test */}
          <div
            style={{
              display: "flex", gap: 10, alignItems: "center",
              paddingTop: 8, borderTop: "1px solid var(--rule-soft)",
            }}
          >
            <button type="submit" className="btn btn--primary" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onTest}
              disabled={test.isPending || (!data.hasKey && !apiKey)}
            >
              {test.isPending ? "Testing…" : "Test connection"}
            </button>
            <div style={{ flex: 1 }} />
            {testRes && (
              <span className={testRes.ok ? "chip chip--success" : "chip chip--error"}>
                {testRes.ok
                  ? `OK · ${testRes.model} · ${testRes.latencyMs}ms`
                  : `Failed · ${testRes.error}`}
              </span>
            )}
          </div>

          {saveErr && (
            <div className="banner banner--error">
              <Icon name="alert" size={14} /><span>{saveErr}</span>
            </div>
          )}
        </form>
      ) : null}
    </>
  );
}
