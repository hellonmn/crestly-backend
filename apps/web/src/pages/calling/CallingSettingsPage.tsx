import { useEffect, useState } from "react";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { useCallingSettings, useSaveCallingSettings, useTestCalling } from "./hooks";
import { getErrorMessage } from "@/lib/api";
import type { CallingTestResult } from "@crestly/shared";

/* ============================================================
   Settings → Masked calling (Exotel)

   Parents call staff through an ExoPhone — neither side sees the
   other's real number (like Uber/Blinkit). Tenant-scoped config.
   ============================================================ */

export function CallingSettingsPage() {
  const { data, isLoading, error, refetch, isFetching } = useCallingSettings();
  const save = useSaveCallingSettings();
  const test = useTestCalling();

  const [enabled, setEnabled] = useState(false);
  const [sid, setSid] = useState("");
  const [subdomain, setSubdomain] = useState("api.exotel.com");
  const [callerId, setCallerId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [tokenEdited, setTokenEdited] = useState(false);
  const [testRes, setTestRes] = useState<CallingTestResult | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setSid(data.sid ?? "");
    setSubdomain(data.subdomain || "api.exotel.com");
    setCallerId(data.callerId ?? "");
    setApiKey(""); setApiToken("");
    setKeyEdited(false); setTokenEdited(false);
  }, [data]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveErr(null); setTestRes(null);
    try {
      await save.mutateAsync({
        enabled,
        provider: "exotel",
        sid: sid.trim() || null,
        subdomain: subdomain.trim() || "api.exotel.com",
        callerId: callerId.trim() || null,
        apiKey: keyEdited ? apiKey.trim() : null,
        apiToken: tokenEdited ? apiToken.trim() : null,
      });
      setKeyEdited(false); setTokenEdited(false);
      setApiKey(""); setApiToken("");
    } catch (e) {
      setSaveErr(getErrorMessage(e, "Failed to save settings"));
    }
  }

  async function onTest() {
    setTestRes(null);
    try {
      setTestRes(await test.mutateAsync());
    } catch (e) {
      setTestRes({ ok: false, error: getErrorMessage(e, "Test failed") });
    }
  }

  return (
    <>
      <PageHead
        group="SETTINGS"
        meta="MASKED CALLING"
        title="Masked calling"
        lede="Connect Exotel so parents can call staff without either side seeing the other's number. When off, the parent contact page falls back to showing numbers directly."
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="calling settings" />

      {isLoading ? (
        <div className="card" style={{ padding: 24 }}>
          <Skeleton height={20} width="40%" />
          <Skeleton height={40} width="100%" style={{ marginTop: 16 }} />
        </div>
      ) : data ? (
        <form onSubmit={onSave} className="card" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22 }}>

          <section className="form-section">
            <div className="form-section__head">
              <span className="form-section__num">01</span>
              <h3 className="form-section__title">Status</h3>
              <span className="muted body-s">Toggles masked calling for the parent portal.</span>
            </div>
            <label
              className="card"
              style={{
                padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                borderColor: enabled ? "var(--orange)" : "var(--rule)",
                background: enabled ? "var(--tint-wheat)" : "var(--white)",
              }}
            >
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 18, height: 18 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Enable masked calling for this school</div>
                <div className="muted body-s">When on, parents call via the ExoPhone and personal numbers are hidden.</div>
              </div>
              <span className={`chip chip--${enabled ? "success" : "muted"}`}>{enabled ? "ON" : "OFF"}</span>
            </label>
          </section>

          <section className="form-section">
            <div className="form-section__head">
              <span className="form-section__num">02</span>
              <h3 className="form-section__title">Account</h3>
              <span className="muted body-s">From your Exotel dashboard.</span>
            </div>
            <div className="form-grid form-grid--2">
              <div className="field">
                <label className="field__label">Account SID</label>
                <input className="input mono" value={sid} onChange={(e) => setSid(e.target.value)} placeholder="myaccount1" />
              </div>
              <div className="field">
                <label className="field__label">API host</label>
                <select className="select" value={subdomain} onChange={(e) => setSubdomain(e.target.value)}>
                  <option value="api.exotel.com">api.exotel.com</option>
                  <option value="api.in.exotel.com">api.in.exotel.com</option>
                </select>
              </div>
              <div className="field span-2">
                <label className="field__label">Caller ID (ExoPhone)</label>
                <input className="input mono" value={callerId} onChange={(e) => setCallerId(e.target.value)} placeholder="08047XXXXXX" />
                <span className="field__hint">The virtual number both parent and staff see during a call.</span>
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section__head">
              <span className="form-section__num">03</span>
              <h3 className="form-section__title">Credentials</h3>
              <span className="muted body-s">Stored on the server, sent to Exotel only at call time.</span>
            </div>
            <div className="form-grid form-grid--2">
              <Secret label="API key" present={data.hasApiKey} edited={keyEdited} value={apiKey}
                onEdit={(v) => { setApiKey(v); setKeyEdited(true); }}
                onReplace={() => { setKeyEdited(true); setApiKey(""); }}
                onKeep={() => { setKeyEdited(false); setApiKey(""); }} masked={data.apiKey} />
              <Secret label="API token" present={data.hasApiToken} edited={tokenEdited} value={apiToken}
                onEdit={(v) => { setApiToken(v); setTokenEdited(true); }}
                onReplace={() => { setTokenEdited(true); setApiToken(""); }}
                onKeep={() => { setTokenEdited(false); setApiToken(""); }} masked={data.hasApiToken ? "••••" : null} />
            </div>
          </section>

          <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--rule-soft)" }}>
            <button type="submit" className="btn btn--primary" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onTest} disabled={test.isPending}>
              {test.isPending ? "Testing…" : "Test connection"}
            </button>
            <div style={{ flex: 1 }} />
            {testRes && (
              <span className={testRes.ok ? "chip chip--success" : "chip chip--error"}>
                {testRes.ok ? "OK · credentials valid" : `Failed · ${testRes.error}`}
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

function Secret({
  label, present, edited, value, masked, onEdit, onReplace, onKeep,
}: {
  label: string;
  present: boolean;
  edited: boolean;
  value: string;
  masked: string | null;
  onEdit: (v: string) => void;
  onReplace: () => void;
  onKeep: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label className="field__label">{label}</label>
      {!edited && present ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <code style={{ padding: "8px 12px", background: "var(--cream-soft)", borderRadius: 6 }}>{masked ?? "••••"}</code>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onReplace}>Replace</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type={show ? "text" : "password"}
            className="input mono"
            value={value}
            onChange={(e) => onEdit(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShow((v) => !v)}>{show ? "Hide" : "Show"}</button>
          {present && <button type="button" className="btn btn--ghost btn--sm" onClick={onKeep}>Keep</button>}
        </div>
      )}
    </div>
  );
}
