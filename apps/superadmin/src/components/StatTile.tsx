import { Icon, type IconName } from "@crestly/icons";

type Tint = "mint" | "peach" | "rose" | "mustard" | "wheat" | "sky";

export function StatTile({ tint, icon, label, value, delta }: {
  tint: Tint; icon: IconName; label: string; value: string; delta?: string;
}) {
  return (
    <div className="stat-tile">
      <div className={`stat-tile__icon icon-tint-${tint}`}><Icon name={icon} size={20} /></div>
      <div className="stat-tile__body">
        <div className="stat-tile__label">{label}</div>
        <div className="stat-tile__value">{value}</div>
        {delta && <div className="stat-tile__delta">{delta}</div>}
      </div>
    </div>
  );
}
