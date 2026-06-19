import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth-store";
import { useSaveSchoolInfo, useSchoolInfo } from "./hooks";
import { getErrorMessage } from "@/lib/api";

/* ============================================================
   Settings — school identity / geofence / punch policy.
   Ports erp/settings/index.php verbatim. KV-backed by the
   `school_info` table; key names match PHP exactly so existing
   PHP-written rows round-trip without any rewrite.
   ============================================================ */

/** PHP defaults. Used when a key is missing from the DB. */
const DEFAULTS: Record<string, string> = {
  "School Name":              "",
  "Address":                  "",
  "Board":                    "",
  "Time Zone":                "Asia/Kolkata",
  "Latitude":                 "",
  "Longitude":                "",
  "Google Maps Link":         "",
  "Geofence Radius School M": "100",
  "Geofence Radius Driver M": "50",
  "Punch Out Cooldown Min":   "15",
};

const TIMEZONES: { value: string; label: string }[] = [
  { value: "Asia/Kolkata",        label: "India (IST · UTC+5:30)" },
  { value: "Asia/Dubai",          label: "Dubai / UAE (GST · UTC+4)" },
  { value: "Asia/Karachi",        label: "Pakistan (PKT · UTC+5)" },
  { value: "Asia/Dhaka",          label: "Bangladesh (BST · UTC+6)" },
  { value: "Asia/Kathmandu",      label: "Nepal (NPT · UTC+5:45)" },
  { value: "Asia/Singapore",      label: "Singapore (SGT · UTC+8)" },
  { value: "Asia/Tokyo",          label: "Japan (JST · UTC+9)" },
  { value: "Europe/London",       label: "UK (GMT/BST)" },
  { value: "Europe/Berlin",       label: "Central Europe (CET/CEST)" },
  { value: "America/New_York",    label: "US East (ET)" },
  { value: "America/Los_Angeles", label: "US West (PT)" },
  { value: "UTC",                 label: "UTC (no offset)" },
];

export function SettingsPage() {
  const { user } = useAuth();
  const isAdminish = user?.roleSlug === "admin" || user?.roleSlug === "principal";

  const { data, isLoading } = useSchoolInfo();
  const save = useSaveSchoolInfo();

  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const v: Record<string, string> = { ...DEFAULTS };
    for (const [k, val] of Object.entries(data.values)) {
      if (val !== null) v[k] = val;
    }
    setForm(v);
  }, [data]);

  function setField(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const fieldErrors = useMemo(() => {
    const out: Record<string, string> = {};
    const tz = (form["Time Zone"] ?? "").trim();
    if (tz && !TIMEZONES.some((t) => t.value === tz)) {
      out["Time Zone"] = "Pick a valid time zone.";
    }
    const lat = (form["Latitude"] ?? "").trim();
    if (lat !== "" && (Number.isNaN(Number(lat)) || Number(lat) < -90 || Number(lat) > 90)) {
      out["Latitude"] = "Must be between -90 and 90.";
    }
    const lng = (form["Longitude"] ?? "").trim();
    if (lng !== "" && (Number.isNaN(Number(lng)) || Number(lng) < -180 || Number(lng) > 180)) {
      out["Longitude"] = "Must be between -180 and 180.";
    }
    const rs = Number(form["Geofence Radius School M"] ?? "100");
    if (Number.isNaN(rs) || rs < 20 || rs > 5000) {
      out["Geofence Radius School M"] = "School radius must be 20-5000 m.";
    }
    const rd = Number(form["Geofence Radius Driver M"] ?? "50");
    if (Number.isNaN(rd) || rd < 20 || rd > 1000) {
      out["Geofence Radius Driver M"] = "Driver radius must be 20-1000 m.";
    }
    const cd = Number(form["Punch Out Cooldown Min"] ?? "15");
    if (Number.isNaN(cd) || cd < 0 || cd > 240) {
      out["Punch Out Cooldown Min"] = "Cooldown must be 0-240 minutes.";
    }
    return out;
  }, [form]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFlash(null);
    if (Object.keys(fieldErrors).length > 0) {
      setError("Check the highlighted fields.");
      return;
    }
    try {
      const patch: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(form)) {
        patch[k] = v.trim() === "" ? null : v.trim();
      }
      await save.mutateAsync({ patch });
      setFlash("Saved. Settings will take effect on the next page load for everyone.");
      setTimeout(() => setFlash(null), 4000);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save"));
    }
  }

  if (!isAdminish) {
    return (
      <>
        <PageHead group="SYSTEM" title="Access denied" />
        <div className="banner banner--warn">
          <Icon name="alert" size={16} />
          <span>Settings are limited to Admin and Principal.</span>
        </div>
        <Link to="/" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }}>
          ← Back to dashboard
        </Link>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <PageHead group="SYSTEM" title="Settings" lede="Loading…" />
        <div className="card"><Skeleton.Title width="60%" /></div>
      </>
    );
  }

  const geofenceSet = (form["Latitude"] ?? "").trim() !== "" && (form["Longitude"] ?? "").trim() !== "";
  const tz = form["Time Zone"] ?? "Asia/Kolkata";
  // Render times in the configured tz so admin sees what end-users see.
  const nowApp = new Date().toLocaleTimeString("en-IN", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <>
      <PageHead
        group="SYSTEM"
        meta="SETTINGS"
        title="Settings"
        lede="Configure school identity, geofence, and punch policy. Changes apply immediately for every user on the next page load."
      />

      {flash && (
        <div className="banner banner--success">
          <Icon name="check" size={16} /><span>{flash}</span>
        </div>
      )}
      {error && (
        <div className="banner banner--error">
          <Icon name="alert" size={16} />
          <span><b>Couldn't save:</b> {error}</span>
        </div>
      )}

      {/* Sub-settings tiles — jump to the integration-specific pages */}
      <div className="grid grid--cols-3 grid--gap-sm" style={{ marginBottom: 18 }}>
        <SubTile
          to="/settings/whatsapp"
          tint="mint"
          label="WhatsApp credentials"
          icon={
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21l2-6a8 8 0 1 1 4 4z"/><path d="M9 11c.5 1.5 1.5 2.5 3 3"/>
            </svg>
          }
        />
        <SubTile
          to="/settings/whatsapp/templates"
          tint="sky"
          label="Templates & bindings"
          icon={
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M7 8h10M7 12h10M7 16h6"/>
            </svg>
          }
        />
        <SubTile
          to="/settings/payment-gateway"
          tint="wheat"
          label="Payment gateway"
          icon={
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>
            </svg>
          }
        />
        <SubTile
          to="/settings/ai"
          tint="mint"
          label="AI assistant"
          icon={
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4v1.5a4 4 0 0 1 4 4V14a4 4 0 0 1-4 4h-1l-3 3-3-3H8a4 4 0 0 1-4-4v-2.5a4 4 0 0 1 4-4V6a4 4 0 0 1 4-4z"/>
              <circle cx="9.5" cy="11.5" r=".5" fill="currentColor"/>
              <circle cx="14.5" cy="11.5" r=".5" fill="currentColor"/>
            </svg>
          }
        />
      </div>

      {/* Quick status — app time + geofence status */}
      <div className="grid grid--cols-3 grid--gap-sm">
        <StatTile
          tint="mint"
          icon="clock"
          label="APP TIME"
          value={nowApp}
          delta={tz}
        />
        <StatTile
          tint="sky"
          icon="ledger"
          label="TIME ZONE"
          value={tz.split("/").pop() ?? tz}
          delta={tz}
        />
        <StatTile
          tint="wheat"
          icon="alert"
          label="GEOFENCE"
          value={geofenceSet ? "Set" : "—"}
          delta={`${form["Geofence Radius School M"] || "100"} m school · ${form["Geofence Radius Driver M"] || "50"} m driver`}
        />
      </div>

      <form
        onSubmit={onSubmit}
        className="card"
        style={{
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
          marginTop: 18,
        }}
      >

        {/* 01 GENERAL */}
        <Section num="01" title="General">
          <div className="form-grid">
            <Field label="School name" wide>
              <input
                className="input"
                type="text"
                maxLength={120}
                value={form["School Name"] ?? ""}
                onChange={(e) => setField("School Name", e.target.value)}
                placeholder="Nexus World School"
              />
            </Field>
            <Field label="Address" wide>
              <textarea
                className="input input--area"
                rows={2}
                value={form["Address"] ?? ""}
                onChange={(e) => setField("Address", e.target.value)}
                placeholder="Sector 2, Jagatpura, Jaipur"
              />
            </Field>
            <Field label="Board">
              <input
                className="input"
                type="text"
                maxLength={32}
                value={form["Board"] ?? ""}
                onChange={(e) => setField("Board", e.target.value)}
                placeholder="CBSE Affiliated"
              />
            </Field>
            <Field
              label="Time zone"
              hint="Drives punch in / out times, fee receipts, and salary cut-offs. Hostinger is on UTC by default — switch to IST for India."
              error={fieldErrors["Time Zone"]}
            >
              <select
                className="select"
                value={form["Time Zone"] ?? "Asia/Kolkata"}
                onChange={(e) => setField("Time Zone", e.target.value)}
              >
                {TIMEZONES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* 02 GEOFENCE */}
        <Section num="02" title="Geofence">
          <div className="form-grid">
            <Field label="School latitude" error={fieldErrors["Latitude"]}>
              <input
                className="input"
                type="text"
                inputMode="decimal"
                value={form["Latitude"] ?? ""}
                onChange={(e) => setField("Latitude", e.target.value)}
                placeholder="26.8176736"
              />
            </Field>
            <Field label="School longitude" error={fieldErrors["Longitude"]}>
              <input
                className="input"
                type="text"
                inputMode="decimal"
                value={form["Longitude"] ?? ""}
                onChange={(e) => setField("Longitude", e.target.value)}
                placeholder="75.8617171"
              />
            </Field>
            <Field
              label={<>Google Maps link <span className="muted body-s">(optional)</span></>}
              wide
            >
              <input
                className="input"
                type="url"
                value={form["Google Maps Link"] ?? ""}
                onChange={(e) => setField("Google Maps Link", e.target.value)}
                placeholder="https://maps.google.com/?q=…"
              />
            </Field>
            <Field
              label="School radius (m)"
              hint="Staff punching outside this is flagged."
              error={fieldErrors["Geofence Radius School M"]}
            >
              <input
                className="input"
                type="number"
                min={20}
                max={5000}
                value={form["Geofence Radius School M"] ?? "100"}
                onChange={(e) => setField("Geofence Radius School M", e.target.value)}
              />
            </Field>
            <Field
              label="Driver radius (m)"
              hint="Bus drivers punch against their pickup point."
              error={fieldErrors["Geofence Radius Driver M"]}
            >
              <input
                className="input"
                type="number"
                min={20}
                max={1000}
                value={form["Geofence Radius Driver M"] ?? "50"}
                onChange={(e) => setField("Geofence Radius Driver M", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* 03 PUNCH POLICY */}
        <Section num="03" title="Punch policy">
          <div className="form-grid">
            <Field
              label="Cooldown after Punch In (min)"
              hint="Anti-double-punch window. 0 to disable."
              error={fieldErrors["Punch Out Cooldown Min"]}
            >
              <input
                className="input"
                type="number"
                min={0}
                max={240}
                value={form["Punch Out Cooldown Min"] ?? "15"}
                onChange={(e) => setField("Punch Out Cooldown Min", e.target.value)}
              />
            </Field>
            <Field
              label="After Punch Out"
              hint="One in, one out per day — keeps daily salary clean."
            >
              <div
                className="input"
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "var(--cream-soft)",
                  borderStyle: "dashed",
                }}
              >
                <span className="muted body-s">Punch In is locked until next day · always on.</span>
              </div>
            </Field>
          </div>
        </Section>

        <div
          style={{
            display: "flex",
            gap: 10,
            paddingTop: 16,
            borderTop: "1px solid var(--rule-soft)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="submit"
            className="btn btn--primary"
            disabled={save.isPending || Object.keys(fieldErrors).length > 0}
          >
            {save.isPending ? "Saving…" : "Save settings"}
          </button>
          <Link to="/" className="btn btn--ghost">Cancel</Link>
          <div style={{ flex: 1 }} />
          <span className="muted body-s">Applies to everyone on next page load.</span>
        </div>
      </form>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Bits                                                                */
/* ------------------------------------------------------------------ */

function SubTile({
  to, tint, label, icon,
}: {
  to: string;
  tint: "mint" | "sky" | "wheat" | "peach" | "rose" | "mustard";
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      style={{
        padding: "16px 18px",
        textDecoration: "none",
        color: "inherit",
        background: "var(--white)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-3)",
        display: "flex",
        gap: 12,
        alignItems: "center",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
      className="settings-subtile"
    >
      <span className={`stat-tile__icon icon-tint-${tint}`}>{icon}</span>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
    </Link>
  );
}

function Section({
  num, title, children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-section">
      <div className="form-section__head">
        <span className="form-section__num">{num}</span>
        <h3 className="form-section__title">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({
  label, hint, error, wide, children,
}: {
  label: React.ReactNode;
  hint?: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`field ${wide ? "span-2" : ""} ${error ? "field--error" : ""}`}
      style={wide ? { gridColumn: "1 / -1" } : undefined}
    >
      <label className="field__label">{label}</label>
      {children}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}
