import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { StatTile } from "@/components/StatTile";
import { Skeleton } from "@/components/Skeleton";
import { useWaLog } from "./hooks";
import type { WaLogEntry } from "@crestly/shared";

/* ============================================================
   WhatsApp message log — ports erp/settings/wa-log.php.
   Last 200 sends with status + action filters. Each row expands
   to show error message + Meta ID + variables + context.
   ============================================================ */

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${date} · ${time}`;
}
function statusPillClass(s: WaLogEntry["status"]): string {
  switch (s) {
    case "sent":   return "pill--success";
    case "failed": return "pill--error";
    case "queued": return "pill--info";
  }
}

export function WhatsappLogPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const action = params.get("action") ?? "";

  const { data: rows, isLoading, error, refetch, isFetching } = useWaLog();

  // Filter client-side; the API returns the last 200 unfiltered (matches
  // PHP — filters only apply to the current load, no pagination yet).
  const filtered = useMemo(() => {
    if (!rows) return [] as WaLogEntry[];
    return rows.filter((r) =>
      (status === "" || r.status === status) &&
      (action === "" || (r.actionKey ?? "") === action),
    );
  }, [rows, status, action]);

  const last7Days = useMemo(() => {
    if (!rows) return { sent: 0, failed: 0, queued: 0 };
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    const out = { sent: 0, failed: 0, queued: 0 };
    for (const r of rows) {
      const t = new Date(r.createdAt).getTime();
      if (t < cutoff) continue;
      out[r.status]++;
    }
    return out;
  }, [rows]);

  const actionOptions = useMemo(() => {
    if (!rows) return [] as string[];
    return Array.from(new Set(rows.map((r) => r.actionKey).filter((a): a is string => !!a))).sort();
  }, [rows]);

  function setParam(key: string, val: string) {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    setParams(next, { replace: true });
  }
  function resetFilters() {
    setParams(new URLSearchParams(), { replace: true });
  }

  return (
    <>
      <PageHead
        group="SYSTEM · SETTINGS · WHATSAPP"
        meta="MESSAGE LOG"
        title="Message log"
        lede="Last 200 send attempts. Failures keep the error response from Meta so you can debug — expand a row to see variables, context, and Meta's message ID."
        actions={
          <>
            <Link to="/settings/whatsapp" className="btn btn--ghost btn--sm">← WhatsApp</Link>
            <Link to="/settings/whatsapp/templates" className="btn btn--ghost btn--sm">Templates →</Link>
          </>
        }
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="WhatsApp log" />

      {/* Stat tiles — 7-day rolling totals match PHP */}
      <div className="grid grid--cols-3 grid--gap-sm">
        <StatTile
          tint="mint"
          icon="check"
          label="SENT (7d)"
          value={last7Days.sent.toLocaleString("en-IN")}
          delta="via Cloud API"
        />
        <StatTile
          tint="rose"
          icon="x"
          label="FAILED (7d)"
          value={last7Days.failed.toLocaleString("en-IN")}
          delta="expand row for error"
          deltaTone={last7Days.failed > 0 ? "error" : undefined}
        />
        <StatTile
          tint="wheat"
          icon="clock"
          label="QUEUED"
          value={last7Days.queued.toLocaleString("en-IN")}
          delta="awaiting dispatch"
        />
      </div>

      {/* Toolbar */}
      <div
        className="toolbar card"
        style={{ padding: "12px 16px", marginTop: 18, display: "flex", gap: 10, alignItems: "center" }}
      >
        <select className="select" value={status} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="queued">Queued</option>
        </select>
        <select className="select" value={action} onChange={(e) => setParam("action", e.target.value)}>
          <option value="">All actions</option>
          {actionOptions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        {(status || action) && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={resetFilters}>
            Reset
          </button>
        )}
      </div>

      {/* Log rows */}
      <div className="card" style={{ padding: 0, marginTop: 18 }}>
        {isLoading ? (
          <div style={{ padding: 16 }}><Skeleton.Table rows={8} cols={6} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO MESSAGES</div>
            <div className="muted body-s">
              {rows && rows.length > 0
                ? "No messages match the current filters."
                : "No messages have been sent yet. Bind an action in Templates and trigger an event."}
            </div>
          </div>
        ) : (
          <div>
            <div className="walog-head">
              <span>WHEN</span>
              <span>ACTION</span>
              <span>TEMPLATE</span>
              <span>TO</span>
              <span>STATUS</span>
              <span></span>
            </div>
            {filtered.map((r) => <LogRow key={r.id} r={r} />)}
          </div>
        )}
      </div>

      <style>{LOG_CSS}</style>
    </>
  );
}

function LogRow({ r }: { r: WaLogEntry }) {
  return (
    <details className="walog-row">
      <summary>
        <span className="mono body-s">{fmtWhen(r.createdAt)}</span>
        <span className="body-s">{r.actionKey ?? <span className="muted">—</span>}</span>
        <span className="body-s mono" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r.templateName ?? <span className="muted">—</span>}
        </span>
        <span className="mono body-s">{r.toPhone}</span>
        <span>
          <span className={`pill ${statusPillClass(r.status)}`} style={{ fontSize: 10, padding: "1px 7px" }}>
            {r.status}
          </span>
        </span>
        <span className="muted body-s" aria-hidden="true">›</span>
      </summary>
      <div className="walog-row__detail">
        {r.errorMessage && (
          <>
            <div className="label" style={{ marginBottom: 4 }}>ERROR</div>
            <pre className="walog-pre" style={{ color: "var(--error)" }}>{r.errorMessage}</pre>
          </>
        )}
        {r.metaMessageId && (
          <>
            <div className="label" style={{ margin: "8px 0 4px" }}>META ID</div>
            <code className="body-s mono">{r.metaMessageId}</code>
          </>
        )}
        <div className="label" style={{ margin: "10px 0 4px" }}>VARIABLES SENT</div>
        <pre className="walog-pre">{prettyJson(r.variables)}</pre>
        {Object.keys(r.context).length > 0 && (
          <>
            <div className="label" style={{ margin: "8px 0 4px" }}>CONTEXT</div>
            <pre className="walog-pre">{prettyJson(r.context)}</pre>
          </>
        )}
      </div>
    </details>
  );
}

function prettyJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

const LOG_CSS = `
  .walog-head, .walog-row > summary {
    display: grid;
    grid-template-columns: 140px 1.2fr 1.4fr 130px 90px 20px;
    gap: 14px;
    padding: 10px 18px;
    align-items: center;
  }
  .walog-head {
    background: var(--cream-soft);
    border-bottom: 1px solid var(--rule);
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.14em;
    color: var(--ink-60);
  }
  .walog-row { border-bottom: 1px solid var(--rule-soft); }
  .walog-row:last-child { border-bottom: 0; }
  .walog-row > summary {
    cursor: pointer;
    list-style: none;
    font-size: 13px;
  }
  .walog-row > summary::-webkit-details-marker { display: none; }
  .walog-row[open] > summary { background: var(--cream-soft); }
  .walog-row__detail {
    padding: 14px 22px 18px;
    background: var(--cream-soft);
    border-top: 1px solid var(--rule-soft);
  }
  .walog-pre {
    background: var(--white);
    border: 1px solid var(--rule-soft);
    border-radius: 6px;
    padding: 10px 12px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }
  @media (max-width: 900px) {
    .walog-head, .walog-row > summary {
      grid-template-columns: 110px 1fr 1fr 100px 70px 20px;
      padding: 10px 12px;
      gap: 8px;
      font-size: 12px;
    }
  }
`;
