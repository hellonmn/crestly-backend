import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import {
  useRefreshTemplates, useUpsertBinding, useWaBindings, useWaTemplates,
} from "./hooks";
import {
  WA_ACTIONS, WA_ACTION_CATALOG,
  type WaActionBinding, type WaActionKey, type WaTemplate,
} from "@crestly/shared";
import { useAuth } from "@/lib/auth-store";
import { getErrorMessage } from "@/lib/api";

/* ============================================================
   WhatsApp Templates & Bindings — ports erp/settings/wa-templates.php.
   Two halves: synced-template directory + one accordion per action
   with template picker, recipient-field picker, body preview, per-
   {{N}} variable map with dynamic/fixed kind toggle.
   ============================================================ */

function statusPillClass(status: string | null): string {
  switch ((status ?? "").toUpperCase()) {
    case "APPROVED": return "pill--success";
    case "PENDING":  return "pill--warn";
    case "REJECTED": return "pill--error";
    case "PAUSED":   return "pill--neutral";
    default:         return "pill--neutral";
  }
}

export function WhatsappTemplatesPage() {
  const { user } = useAuth();
  const canBind = (user?.permissions ?? []).includes("whatsapp.bind") ||
                  (user?.permissions ?? []).includes("whatsapp.configure");

  const { data: templates, isLoading: tplLoading, error: tplError, refetch: tplRefetch, isFetching: tplFetching } = useWaTemplates();
  const { data: bindings,  isLoading: bndLoading } = useWaBindings();
  const refresh = useRefreshTemplates();

  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr]     = useState<string | null>(null);

  async function onRefresh() {
    setErr(null);
    setFlash(null);
    try {
      const r = await refresh.mutateAsync();
      setFlash(`Synced ${r.synced.toLocaleString("en-IN")} templates from Meta.`);
      setTimeout(() => setFlash(null), 4000);
    } catch (e) {
      setErr(getErrorMessage(e, "Refresh failed"));
    }
  }

  const bindingByAction = useMemo(() => {
    const m = new Map<string, WaActionBinding>();
    for (const b of bindings ?? []) m.set(b.actionKey, b);
    return m;
  }, [bindings]);

  return (
    <>
      <PageHead
        group="SYSTEM · SETTINGS · WHATSAPP"
        meta="TEMPLATES"
        title="Templates & bindings"
        lede="Sync your Meta-approved templates here, then bind each app action (fee received, voucher pending, …) to a template plus a variable map."
        actions={
          <Link to="/settings/whatsapp" className="btn btn--ghost btn--sm">← WhatsApp</Link>
        }
      />

      {flash && (
        <div className="banner banner--success">
          <Icon name="check" size={16} /><span>{flash}</span>
        </div>
      )}
      {err && (
        <div className="banner banner--error">
          <Icon name="alert" size={16} /><span>{err}</span>
        </div>
      )}

      <QueryError error={tplError} refetch={tplRefetch} isFetching={tplFetching} label="templates" />

      {/* Refresh toolbar */}
      <div className="toolbar card" style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center" }}>
        <div>
          <div className="label">TEMPLATES IN CACHE</div>
          <div className="display-m" style={{ fontSize: 18, marginTop: 2 }}>
            {templates ? templates.length.toLocaleString("en-IN") : "—"}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {canBind && (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={onRefresh}
            disabled={refresh.isPending}
          >
            <Icon name="features" size={14} />
            {refresh.isPending ? " Syncing…" : " Refresh from Meta"}
          </button>
        )}
      </div>

      {/* Synced templates table */}
      <div className="card" style={{ padding: 0, marginTop: 18 }}>
        <div className="table-card__head" style={{ padding: "14px 20px" }}>
          <h3 className="table-card__title">Synced templates<BrandDot /></h3>
        </div>

        {tplLoading ? (
          <div style={{ padding: 16 }}><Skeleton.Table rows={6} cols={5} /></div>
        ) : (templates?.length ?? 0) === 0 ? (
          <div style={{ padding: "32px 20px" }}>
            <div className="muted body-s">
              No templates cached yet. Click <b>Refresh from Meta</b> above after you've added templates in Meta Business Manager → WhatsApp → Message templates.
            </div>
          </div>
        ) : (
          <div>
            <div className="wat-head">
              <span>NAME</span>
              <span>LANG</span>
              <span>VARS</span>
              <span>STATUS</span>
              <span>BODY</span>
            </div>
            {(templates ?? []).map((t) => <TemplateRow key={t.id} t={t} />)}
          </div>
        )}
      </div>

      {/* Action bindings */}
      <h2 style={{ margin: "32px 0 10px", fontFamily: "var(--font-display)", fontSize: 22 }}>
        Action bindings<BrandDot />
      </h2>
      <p className="muted" style={{ margin: "0 0 18px" }}>
        Each action below fires automatically when the underlying event happens in Crestly. Pick the template and tell Crestly how to fill in each variable.
      </p>

      {bndLoading ? (
        <div className="card"><Skeleton.Title width="40%" /></div>
      ) : (
        WA_ACTIONS.map((action) => (
          <ActionBindingCard
            key={action}
            actionKey={action}
            binding={bindingByAction.get(action)}
            templates={templates ?? []}
            canBind={canBind}
          />
        ))
      )}

      <style>{TPL_CSS}</style>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Template row                                                        */
/* ------------------------------------------------------------------ */

function TemplateRow({ t }: { t: WaTemplate }) {
  return (
    <div className="wat-row">
      <span>
        <b>{t.name}</b>
        <div className="muted body-s" style={{ fontSize: 11 }}>
          {t.category ?? "—"}
        </div>
      </span>
      <span className="mono body-s">{t.language}</span>
      <span className="mono body-s">{t.variableCount}</span>
      <span>
        <span className={`pill ${statusPillClass(t.status)}`} style={{ fontSize: 10, padding: "1px 7px" }}>
          {t.status ?? "—"}
        </span>
      </span>
      <span className="wat-row__body">
        {t.bodyText
          ? t.bodyText.length > 110 ? `${t.bodyText.slice(0, 110)}…` : t.bodyText
          : <span className="muted">no body</span>}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-action accordion                                                */
/* ------------------------------------------------------------------ */

function ActionBindingCard({
  actionKey, binding, templates, canBind,
}: {
  actionKey: WaActionKey;
  binding: WaActionBinding | undefined;
  templates: WaTemplate[];
  canBind: boolean;
}) {
  const def = WA_ACTION_CATALOG[actionKey];

  const upsert = useUpsertBinding();
  const [templateKey, setTemplateKey] = useState<string>(
    binding ? `${binding.templateName}||${binding.templateLang}` : "",
  );
  const [recipientField, setRecipientField] = useState<string>(binding?.recipientField ?? "");
  const [isEnabled, setIsEnabled]           = useState<boolean>(binding?.isEnabled ?? true);
  const [varMap, setVarMap]                 = useState<Record<string, VarSlot>>(() => {
    const v: Record<string, VarSlot> = {};
    const m = (binding?.variableMap ?? {}) as Record<string, unknown>;
    for (const [k, raw] of Object.entries(m)) {
      const slot = raw as { kind?: string; field?: unknown; value?: unknown } | null;
      if (!slot) { v[k] = { kind: "dynamic", field: "" }; continue; }
      v[k] = slot.kind === "fixed"
        ? { kind: "fixed", value: String(slot.value ?? "") }
        : { kind: "dynamic", field: String(slot.field ?? "") };
    }
    return v;
  });
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saved, setSaved]     = useState(false);

  const [tmplName, tmplLang] = templateKey ? templateKey.split("||") : ["", ""];
  const boundTmpl = templates.find(
    (t) => t.name === tmplName && t.language === (tmplLang || "en"),
  );
  const varCount = boundTmpl?.variableCount ?? 0;

  function setVar(slot: number, next: VarSlot) {
    setVarMap((prev) => ({ ...prev, [String(slot)]: next }));
    setSaved(false);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!boundTmpl) {
      setSaveErr("Pick a template before saving.");
      return;
    }
    setSaveErr(null);
    setSaved(false);
    try {
      // Normalise: only include slots up to varCount.
      const map: Record<string, VarSlot> = {};
      for (let i = 1; i <= varCount; i++) {
        const cur = varMap[String(i)];
        map[String(i)] = cur ?? { kind: "dynamic", field: "" };
      }
      await upsert.mutateAsync({
        actionKey,
        templateName: boundTmpl.name,
        templateLang: boundTmpl.language,
        recipientField: recipientField || null,
        variableMap: map as unknown as Record<string, unknown>,
        isEnabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveErr(getErrorMessage(e, "Save failed"));
    }
  }

  return (
    <details className="card act-card" open={!!binding}>
      <summary>
        <div className="act-card__head">
          <div>
            <div className="act-card__title">{def.label}</div>
            <div className="muted body-s" style={{ marginTop: 2 }}>{def.description}</div>
          </div>
          <div className="act-card__pills">
            {binding ? (
              <>
                <span className={`pill ${binding.isEnabled ? "pill--success" : "pill--neutral"}`}>
                  {binding.isEnabled ? "Live" : "Paused"}
                </span>
                <span className="muted body-s mono" style={{ fontSize: 11 }}>
                  → {binding.templateName}
                </span>
              </>
            ) : (
              <span className="pill pill--neutral">Not configured</span>
            )}
          </div>
        </div>
      </summary>

      <form className="act-card__body" onSubmit={onSave}>
        <div className="form-grid">
          <div className="field span-2">
            <label className="field__label">Template</label>
            <select
              className="select"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              disabled={!canBind}
            >
              <option value="">— pick a template —</option>
              {templates.map((t) => {
                const k = `${t.name}||${t.language}`;
                const disabled = (t.status ?? "").toUpperCase() !== "APPROVED";
                return (
                  <option key={k} value={k} disabled={disabled}>
                    {t.name} · {t.language} · {t.status ?? "—"} · {t.variableCount} vars
                  </option>
                );
              })}
            </select>
            <span className="field__hint">
              Only APPROVED templates can be sent. Change template + save to re-map variables.
            </span>
          </div>

          <div className="field">
            <label className="field__label">Recipient field</label>
            <select
              className="select"
              value={recipientField}
              onChange={(e) => setRecipientField(e.target.value)}
              disabled={!canBind}
            >
              <option value="">— pick a recipient field —</option>
              {Object.entries(def.recipientOptions).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <span className="field__hint">Which context field carries the to-phone for this action.</span>
          </div>

          <div className="field">
            <label className="field__label">Status</label>
            <label className="check" style={{ display: "flex", alignItems: "center", gap: 8, height: 42 }}>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                disabled={!canBind}
              />
              <span>Enabled · fire when this event happens</span>
            </label>
          </div>
        </div>

        {boundTmpl ? (
          <>
            {/* Body preview */}
            <div className="tpl-preview">{boundTmpl.bodyText ?? "(no body)"}</div>

            {varCount > 0 ? (
              <>
                <div className="label" style={{ margin: "18px 0 8px" }}>
                  VARIABLE MAPPING · {varCount} placeholder{varCount === 1 ? "" : "s"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Array.from({ length: varCount }, (_, idx) => {
                    const slot = idx + 1;
                    const cur = varMap[String(slot)] ?? { kind: "dynamic", field: "" };
                    return (
                      <VarRow
                        key={slot}
                        slot={slot}
                        cur={cur}
                        fields={def.fields}
                        canEdit={canBind}
                        onChange={(next) => setVar(slot, next)}
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="muted body-s" style={{ marginTop: 14 }}>
                This template has no variables — it sends as-is.
              </p>
            )}
          </>
        ) : binding?.templateName ? (
          <p className="muted body-s" style={{ marginTop: 14 }}>
            ⚠ The bound template <code className="mono">{binding.templateName}</code> isn't in the
            synced list. Click <b>Refresh from Meta</b> above.
          </p>
        ) : null}

        {saveErr && (
          <div className="banner banner--error" style={{ marginTop: 14 }}>
            <Icon name="alert" size={16} /><span>{saveErr}</span>
          </div>
        )}
        {saved && (
          <div className="banner banner--success" style={{ marginTop: 14 }}>
            <Icon name="check" size={16} /><span>Binding saved.</span>
          </div>
        )}

        <div
          style={{
            display: "flex", gap: 10, marginTop: 18, paddingTop: 14,
            borderTop: "1px solid var(--rule-soft)",
          }}
        >
          {canBind && (
            <button type="submit" className="btn btn--primary" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : "Save binding"}
            </button>
          )}
        </div>
      </form>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Variable mapping row                                                */
/* ------------------------------------------------------------------ */

type VarSlot =
  | { kind: "dynamic"; field: string }
  | { kind: "fixed"; value: string };

function VarRow({
  slot, cur, fields, canEdit, onChange,
}: {
  slot: number;
  cur: VarSlot;
  fields: Record<string, string>;
  canEdit: boolean;
  onChange: (next: VarSlot) => void;
}) {
  return (
    <div className="var-row">
      <div className="var-row__num"><code className="mono">{`{{${slot}}}`}</code></div>
      <select
        className="select"
        value={cur.kind}
        onChange={(e) => {
          const kind = e.target.value as "dynamic" | "fixed";
          onChange(kind === "dynamic" ? { kind, field: "" } : { kind, value: "" });
        }}
        disabled={!canEdit}
      >
        <option value="dynamic">Dynamic (from event)</option>
        <option value="fixed">Fixed value</option>
      </select>
      {cur.kind === "dynamic" ? (
        <select
          className="select"
          value={cur.field}
          onChange={(e) => onChange({ kind: "dynamic", field: e.target.value })}
          disabled={!canEdit}
        >
          <option value="">— pick a field —</option>
          {Object.entries(fields).map(([k, label]) => (
            <option key={k} value={k}>{label} · {k}</option>
          ))}
        </select>
      ) : (
        <input
          className="input"
          type="text"
          placeholder="Type fixed text"
          value={cur.value}
          onChange={(e) => onChange({ kind: "fixed", value: e.target.value })}
          disabled={!canEdit}
        />
      )}
    </div>
  );
}

const TPL_CSS = `
  .wat-head, .wat-row {
    display: grid;
    grid-template-columns: 1.5fr 80px 60px 100px 2fr;
    gap: 14px;
    padding: 10px 20px;
    align-items: center;
  }
  .wat-head {
    background: var(--cream-soft);
    border-bottom: 1px solid var(--rule);
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.14em;
    color: var(--ink-60);
  }
  .wat-row { border-bottom: 1px solid var(--rule-soft); font-size: 13px; }
  .wat-row:last-child { border-bottom: 0; }
  .wat-row__body {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--ink-60);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  @media (max-width: 900px) {
    .wat-head, .wat-row { grid-template-columns: 1fr 60px 50px 80px 1.2fr; padding: 10px 12px; gap: 8px; }
  }

  .act-card { margin-top: 14px; padding: 0; }
  .act-card > summary {
    padding: 16px 22px;
    cursor: pointer;
    list-style: none;
  }
  .act-card > summary::-webkit-details-marker { display: none; }
  .act-card__head { display: flex; align-items: center; gap: 12px; }
  .act-card__title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--ink);
  }
  .act-card__pills {
    margin-left: auto;
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .act-card[open] > summary { border-bottom: 1px solid var(--rule-soft); }
  .act-card__body { padding: 18px 22px 22px; }

  .tpl-preview {
    background: var(--cream-soft);
    border: 1px solid var(--rule-soft);
    border-radius: 8px;
    padding: 14px 16px;
    margin-top: 14px;
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--ink);
    white-space: pre-wrap;
    line-height: 1.5;
  }

  .var-row {
    display: grid;
    grid-template-columns: 60px 160px 1fr;
    gap: 10px;
    align-items: center;
  }
  .var-row__num {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink-60);
  }
  @media (max-width: 720px) {
    .var-row { grid-template-columns: 1fr; gap: 6px; }
  }
`;
