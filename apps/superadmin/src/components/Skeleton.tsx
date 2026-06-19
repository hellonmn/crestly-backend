/* Mirror of apps/web/src/components/Skeleton.tsx. Kept duplicated so the
 * super-admin app stays self-contained; if we ever extract a shared UI
 * package, this is the file to dedupe. */
import type { CSSProperties } from "react";

interface BlockProps { width?: string | number; height?: string | number; className?: string; style?: CSSProperties; }

function Block({ width, height, className, style }: BlockProps) {
  const final: CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    ...style,
  };
  return <span className={`skeleton ${className ?? ""}`} style={final} />;
}

const SkeletonTitle = (p: BlockProps) => <Block className="skeleton--title" {...p} />;
const SkeletonText = (p: BlockProps) => <Block className="skeleton--text" {...p} />;
const SkeletonPill = (p: BlockProps) => <Block className="skeleton--pill" {...p} />;
const SkeletonCircle = ({ size = 32, ...rest }: BlockProps & { size?: number }) =>
  <Block className="skeleton--circle" width={size} height={size} {...rest} />;

function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-row" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Block key={c} height={14} width={c === 0 ? "60%" : c === cols - 1 ? "40%" : "80%"} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkeletonStat() {
  return (
    <div className="stat-tile" aria-busy="true">
      <SkeletonCircle size={40} />
      <div className="stat-tile__body">
        <Block className="skeleton--text" width="50%" height={10} />
        <Block height={22} width="70%" style={{ marginTop: 6 }} />
        <Block className="skeleton--text" width="40%" style={{ marginTop: 6 }} />
      </div>
    </div>
  );
}

function SkeletonStatRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid--cols-4 grid--gap-sm" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => <SkeletonStat key={i} />)}
    </div>
  );
}

export const Skeleton = Object.assign(Block, {
  Title: SkeletonTitle,
  Text: SkeletonText,
  Pill: SkeletonPill,
  Circle: SkeletonCircle,
  Table: SkeletonTable,
  Stat: SkeletonStat,
  StatRow: SkeletonStatRow,
});
