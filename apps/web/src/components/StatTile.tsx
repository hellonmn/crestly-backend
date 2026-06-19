import { Icon, type IconName } from "@crestly/icons";

type Tint = "mint" | "peach" | "rose" | "mustard" | "wheat" | "sky";

/**
 * The 40×40 tinted-icon KPI tile used on every landing page.
 * Markup mirrors the CDS .stat-tile pattern.
 *
 *   <StatTile tint="mint" icon="users" label="ACTIVE STUDENTS" value="824" delta="+12 this month" />
 */
export function StatTile({
  tint,
  icon,
  label,
  value,
  delta,
  deltaTone,
}: {
  tint: Tint;
  icon: IconName;
  label: string;
  value: string | number;
  delta?: string;
  deltaTone?: "success" | "error";
}) {
  return (
    <div className="stat-tile">
      <span className={`stat-tile__icon icon-tint-${tint}`}>
        <Icon name={icon} size={16} />
      </span>
      <div className="stat-tile__body">
        <div className="stat-tile__label">{label}</div>
        <div className="stat-tile__value">{value}</div>
        {delta && (
          <div
            className="stat-tile__delta"
            style={deltaTone ? { color: `var(--${deltaTone})` } : undefined}
          >
            {delta}
          </div>
        )}
      </div>
    </div>
  );
}
