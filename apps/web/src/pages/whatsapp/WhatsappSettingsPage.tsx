import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { StatTile } from "@/components/StatTile";
import { Skeleton } from "@/components/Skeleton";
import { useSaveWaSettings, useWaSettings, useWaStats, useWaTest } from "./hooks";
import { useAuth } from "@/lib/auth-store";
import { getErrorMessage } from "@/lib/api";

/* ============================================================
   WhatsApp Cloud API settings — ports erp/settings/whatsapp.php.
   Stat tiles · credentials section · enable toggle · test-send card.
   ============================================================ */

export function WhatsappSettingsPage() {
  const { user } = useAuth();
  const canConfigure = (user?.permissions ?? []).includes("whatsapp.configure");

  const { data: settings, isLoading, error: settingsError, refetch: settingsRefetch, isFetching: settingsFetching } = useWaSettings();
  const { data: stats }               = useWaStats();
  const save = useSaveWaSettings();
  const test = useWaTest();

  const [form, setForm] = useState({
    enabled: false,
    accessToken: "",
    phoneNumberId: "",
    wabaId: "",
    apiVersion: "v22.0",
    displayNumber: "",
    defaultCountry: "91",
  });
  const [testPhone, setTestPhone] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr]     = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!settings) return;
    setForm({
      enabled: settings.enabled,
      accessToken: settings.accessToken ?? "",
      phoneNumberId: settings.phoneNumberId ?? "",
      wabaId: settings.wabaId ?? "",
      apiVersion: settings.apiVersion,
      displayNumber: settings.displayNumber ?? "",
      defaultCountry: settings.defaultCountry,
    });
  }, [settings]);

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function notify(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 4000);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setTestResult(null);
    try {
      // Skip the access_token field if it's still the masked value (****abcd).
      const patch: typeof form = { ...form };
      if (patch.accessToken.startsWith("****")) patch.accessToken = "";
      await save.mutateAsync(patch);
      notify("Saved. Credentials updated.");
    } catch (e) {
      setErr(getErrorMessage(e, "Couldn't save"));
    }
  }

  async function onTest() {
    setErr(null);
    setFlash(null);
    setTestResult(null);
    if (!testPhone.trim()) {
      setTestResult({ ok: false, msg: "Enter a test phone number first." });
      return;
    }
    try {
      const r = await test.mutateAsync(testPhone.trim());
      if (r.ok) {
        setTestResult({ ok: true, msg: "Meta accepted the hello_world template. Check the recipient phone." });
      } else {
        setTestResult({ ok: false, msg: r.error ?? "Test failed." });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: getErrorMessage(e, "Test failed") });
    }
  }

  if (!canConfigure) {
    return (
      <>
        <PageHead group="SYSTEM" title="Access denied" />
        <div className="banner banner--warn">
          <Icon name="alert" size={16} />
          <span>WhatsApp settings need the <code className="mono">whatsapp.configure</code> permission.</span>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <PageHead group="SYSTEM · SETTINGS" title="WhatsApp Cloud API" />
        <div className="card"><Skeleton.Title width="50%" /></div>
      </>
    );
  }

  return (
    <>
      <PageHead
        group="SYSTEM · SETTINGS"
        meta="WHATSAPP"
        title="WhatsApp Cloud API"
        lede={
          <>
            Connect Meta's Cloud API so Crestly can send template messages — fee receipts,
            voucher pings, absence alerts. Get credentials at{" "}
            <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener">
              developers.facebook.com
            </a>{" "}
            → your app → WhatsApp → API setup.
          </>
        }
        actions={
          <>
            <Link to="/settings" className="btn btn--ghost btn--sm">← Settings</Link>
            <Link to="/settings/whatsapp/templates" className="btn btn--ghost btn--sm">Templates →</Link>
            <Link to="/settings/whatsapp/log" className="btn btn--ghost btn--sm">Log →</Link>
          </>
        }
      />

      {flash && (
        <div className="banner banner--success">
          <Icon name="check" size={16} /><span>{flash}</span>
        </div>
      )}
      {err && (
        <div className="banner banner--error">
          <Icon name="alert" size={16} /><span><b>Error:</b> {err}</span>
        </div>
      )}
      {testResult && (
        <div className={`banner ${testResult.ok ? "banner--success" : "banner--error"}`}>
          <Icon name={testResult.ok ? "check" : "alert"} size={16} />
          <span>
            <b>{testResult.ok ? "Test sent." : "Test failed."}</b> {testResult.msg}
          </span>
        </div>
      )}

      <QueryError error={settingsError} refetch={settingsRefetch} isFetching={settingsFetching} label="WhatsApp settings" />

      {/* 4 stat tiles — match PHP order: Status / Templates / Sent 24h / Failed 24h */}
      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile
          tint={stats?.enabled ? "mint" : "wheat"}
          icon="msg"
          label="STATUS"
          value={stats?.enabled ? "Live" : "Disabled"}
          delta={stats?.phoneNumberIdSet ? "Phone ID set" : "Phone ID missing"}
          deltaTone={stats && !stats.phoneNumberIdSet ? "error" : undefined}
        />
        <StatTile
          tint="sky"
          icon="features"
          label="TEMPLATES SYNCED"
          value={stats ? stats.templatesCount.toLocaleString("en-IN") : "—"}
          delta={stats ? `${stats.templatesApproved} approved` : ""}
        />
        <StatTile
          tint="mint"
          icon="check"
          label="SENT (24h)"
          value={stats ? stats.sent24h.toLocaleString("en-IN") : "—"}
          delta="via Cloud API"
        />
        <StatTile
          tint="rose"
          icon="x"
          label="FAILED (24h)"
          value={stats ? stats.failed24h.toLocaleString("en-IN") : "—"}
          delta={
            <Link to="/settings/whatsapp/log" style={{ color: "inherit" }}>
              View log →
            </Link> as unknown as string
          }
          deltaTone={stats && stats.failed24h > 0 ? "error" : undefined}
        />
      </div>

      {/* Credentials form */}
      <form
        onSubmit={onSubmit}
        className="card"
        style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 28, marginTop: 18 }}
      >
        <div className="form-section">
          <div className="form-section__head">
            <span className="form-section__num">01</span>
            <h3 className="form-section__title">Credentials</h3>
          </div>
          <div className="form-grid">
            <Field
              label="Access token"
              wide
              hint={<>Long-lived system-user token. Generate at Meta Business Manager → Users → System users → "Generate token". <b>Leave field as-is to keep current token.</b></>}
            >
              <input
                className="input mono"
                type="text"
                autoComplete="off"
                value={form.accessToken}
                onChange={(e) => setField("accessToken", e.target.value)}
                placeholder="EAAG…"
              />
            </Field>
            <Field
              label="Phone number ID"
              hint='From WhatsApp → API setup → "From".'
            >
              <input
                className="input mono"
                type="text"
                value={form.phoneNumberId}
                onChange={(e) => setField("phoneNumberId", e.target.value)}
                placeholder="e.g. 105954512xxxxxx"
              />
            </Field>
            <Field
              label="WABA ID"
              hint="From Business Manager → WhatsApp accounts → ID column."
            >
              <input
                className="input mono"
                type="text"
                value={form.wabaId}
                onChange={(e) => setField("wabaId", e.target.value)}
                placeholder="WhatsApp Business Account id"
              />
            </Field>
            <Field
              label="API version"
              hint="Default v22.0 — bump when Meta releases new minor."
            >
              <input
                className="input mono"
                type="text"
                value={form.apiVersion}
                onChange={(e) => setField("apiVersion", e.target.value)}
                placeholder="v22.0"
              />
            </Field>
            <Field
              label="Display phone (optional)"
              hint="Just for display — actual sender is the phone number ID above."
            >
              <input
                className="input mono"
                type="text"
                value={form.displayNumber}
                onChange={(e) => setField("displayNumber", e.target.value)}
                placeholder="+91 79xxxxxxxx"
              />
            </Field>
            <Field
              label="Default country code"
              hint="Prepended to 10-digit parent numbers."
            >
              <input
                className="input mono"
                type="text"
                maxLength={4}
                value={form.defaultCountry}
                onChange={(e) => setField("defaultCountry", e.target.value)}
                placeholder="91"
              />
            </Field>
            <Field
              label="Enable WhatsApp sending"
              wide
              hint="When off, action triggers are skipped silently — useful while you set up templates."
            >
              <label className="check" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setField("enabled", e.target.checked)}
                />
                <span>Outbound sends are <b>{form.enabled ? "live" : "paused"}</b>.</span>
              </label>
            </Field>
          </div>
        </div>

        <div
          style={{
            display: "flex", gap: 10, paddingTop: 16, borderTop: "1px solid var(--rule-soft)",
            alignItems: "center", flexWrap: "wrap",
          }}
        >
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save credentials"}
          </button>
          <Link to="/settings" className="btn btn--ghost">Back</Link>
          <div style={{ flex: 1 }} />
          <Link to="/settings/whatsapp/templates" className="btn btn--ghost btn--sm">
            Templates →
          </Link>
        </div>
      </form>

      {/* Test connection card */}
      <div className="card" style={{ padding: "20px 24px", marginTop: 18 }}>
        <div className="label" style={{ marginBottom: 10 }}>TEST CONNECTION</div>
        <p className="muted body-s" style={{ margin: "0 0 12px" }}>
          Sends the <b>hello_world</b> template (every WABA has it pre-approved). Use this to verify the
          token + phone number ID work end-to-end before binding actions.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label className="field__label" htmlFor="t-phone">Recipient phone</label>
            <input
              id="t-phone"
              className="input mono"
              type="text"
              placeholder="9876543210 or +91 98765 43210"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onTest}
            disabled={test.isPending || !form.enabled}
          >
            {test.isPending ? "Sending…" : form.enabled ? "Send test" : "Enable + save first"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Bits                                                                */
/* ------------------------------------------------------------------ */

function Field({
  label, hint, wide, children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`field ${wide ? "span-2" : ""}`} style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <label className="field__label">{label}</label>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}
