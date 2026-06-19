import { BrandDot } from "./BrandDot";

/**
 * Crestly page header pattern — replicates the PHP `.page-head` block:
 *
 *   <div class="page-head">
 *     <div class="page-head__main">
 *       <div class="page-head__crumb">…</div>
 *       <h1 class="page-head__title">Title<span class="brand-dot">.</span></h1>
 *       <p class="page-head__lede">Description sentence.</p>
 *     </div>
 *     <div class="page-head__actions">…buttons…</div>
 *   </div>
 *
 * Actions render top-right alongside the title on desktop, and drop to a
 * right-aligned row below the title on ≤960px (see components.css).
 */
export function PageHead({
  group,
  meta,
  title,
  lede,
  actions,
}: {
  group?: string;
  meta?: string;
  title: string;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="page-head__main">
        {(group || meta) && (
          <div className="page-head__crumb">
            {group && (
              <span className="label" style={{ color: "var(--orange)" }}>
                {group}
              </span>
            )}
            {group && meta && <span className="page-head__crumb-sep">·</span>}
            {meta && <span className="label">{meta}</span>}
          </div>
        )}
        <h1 className="page-head__title">
          {title}
          <BrandDot />
        </h1>
        {lede && <p className="page-head__lede">{lede}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}
