import { BrandDot } from "./BrandDot";

export function PageHead({
  group, meta, title, lede, actions,
}: {
  group?: string;
  meta?: string;
  title: string;
  lede?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="page-head__main">
        {(group || meta) && (
          <div className="page-head__crumb">
            {group && <span className="label" style={{ color: "var(--orange)" }}>{group}</span>}
            {group && meta && <span className="page-head__crumb-sep">·</span>}
            {meta && <span className="label">{meta}</span>}
          </div>
        )}
        <h1 className="page-head__title">{title}<BrandDot /></h1>
        {lede && <p className="page-head__lede">{lede}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}
