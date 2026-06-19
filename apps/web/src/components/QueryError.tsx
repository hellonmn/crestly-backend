import { useEffect, useRef } from "react";
import { Icon } from "@crestly/icons";
import { getErrorMessage } from "@/lib/api";

/**
 * Inline error banner for failed React Query reads.
 *
 * Distinguishes "API failed" from "no data exists" — without this,
 * pages render their empty-state for both, which looks identical
 * to the user and is the root cause of the "kabhi kabhi data 0
 * dikha raha hai" reports.
 *
 * Pass the query's `error` + `refetch` straight through. Renders
 * nothing when `error` is falsy so callers can drop it inline.
 *
 *   const q = useThing();
 *   <QueryError error={q.error} refetch={q.refetch} isFetching={q.isFetching} />
 *   {q.isLoading ? <Skeleton /> : q.error ? null : ...}
 */
export function QueryError({
  error, refetch, isFetching, label,
}: {
  error: unknown;
  refetch?: () => void;
  isFetching?: boolean;
  /** Optional context, e.g. "periods" → "Couldn't load periods." */
  label?: string;
}) {
  // Auto-retry on dev-only "api still booting" errors so the user doesn't
  // have to click Retry once the API process finally comes up. Kept inside
  // the hook chain (always called) so React doesn't complain when error
  // toggles between truthy/falsy. Ref tracks the current timer.
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!error || !refetch) return;
    const msg = getErrorMessage(error, "");
    const isBoot = /api server still booting|api_starting|ECONNREFUSED/i.test(msg);
    if (!isBoot) return;
    timerRef.current = window.setInterval(() => {
      if (!isFetching) refetch();
    }, 3000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [error, refetch, isFetching]);

  if (!error) return null;
  const detail = getErrorMessage(error, "");
  const isBoot = /api server still booting|api_starting|ECONNREFUSED/i.test(detail);
  const head = isBoot
    ? "Waiting for the API…"
    : label ? `Couldn't load ${label}.` : "Couldn't load.";
  return (
    <div className={`banner ${isBoot ? "banner--info" : "banner--error"}`} role="alert">
      <Icon name={isBoot ? "info" : "alert"} size={16} />
      <span>
        <b>{head}</b>
        {isBoot
          ? <> Auto-retrying every 3s. You don't need to do anything.</>
          : detail && <> {detail}</>}
      </span>
      {refetch && (
        <button
          type="button"
          className="banner__link"
          style={{ marginLeft: "auto", background: "transparent", border: 0, cursor: "pointer", font: "inherit", textDecoration: "underline" }}
          onClick={() => refetch()}
          disabled={!!isFetching}
        >
          {isFetching ? "Retrying…" : "Retry now"}
        </button>
      )}
    </div>
  );
}
