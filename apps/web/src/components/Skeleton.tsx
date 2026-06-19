/**
 * Skeleton — animated placeholder shimmer used while a query is loading.
 *
 * Usage:
 *   {isLoading ? <Skeleton.Table cols={6} rows={5} /> : <RealTable rows={data} />}
 *   <Skeleton width="60%" />
 *   <Skeleton.Stat />
 */
import type { CSSProperties } from "react";

interface BlockProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: CSSProperties;
}

function Block({ width, height, className, style }: BlockProps) {
  const final: CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    ...style,
  };
  return <span className={`skeleton ${className ?? ""}`} style={final} />;
}

function SkeletonTitle(props: BlockProps) {
  return <Block className="skeleton--title" {...props} />;
}
function SkeletonText(props: BlockProps) {
  return <Block className="skeleton--text" {...props} />;
}
function SkeletonPill(props: BlockProps) {
  return <Block className="skeleton--pill" {...props} />;
}
function SkeletonCircle({ size = 32, ...rest }: BlockProps & { size?: number }) {
  return <Block className="skeleton--circle" width={size} height={size} {...rest} />;
}

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  /** Optional CSS grid-template-columns; defaults to equal fr. */
  cols_template?: string;
}
function SkeletonTable({ rows = 5, cols = 6, cols_template }: TableSkeletonProps) {
  const template = cols_template ?? `repeat(${cols}, 1fr)`;
  return (
    <div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-row" style={{ gridTemplateColumns: template }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Block
              key={c}
              height={14}
              width={c === 0 ? "60%" : c === cols - 1 ? "40%" : "80%"}
            />
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

function SkeletonDetailList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="detail-list" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="detail-row">
          <div className="detail-row__k"><Block height={14} width="50%" /></div>
          <div className="detail-row__v"><Block height={14} width="80%" /></div>
        </div>
      ))}
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
  DetailList: SkeletonDetailList,
});
