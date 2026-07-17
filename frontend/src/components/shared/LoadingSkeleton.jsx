import './LoadingSkeleton.css';

export function SkeletonLine({ width = '100%', height = '14px' }) {
  return <div className="skeleton skeleton-line" style={{ width, height }} />;
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <SkeletonLine width="40%" height="18px" />
      <SkeletonLine width="70%" />
      <SkeletonLine width="55%" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table__head">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} height="12px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="skeleton-table__row">
          {Array.from({ length: cols }).map((_, col) => (
            <SkeletonLine key={col} height="12px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }) {
  return (
    <div className="stat-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card skeleton-stat">
          <SkeletonLine width="60%" height="10px" />
          <SkeletonLine width="40%" height="28px" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton">
      <StatCardsSkeleton count={4} />
      <TableSkeleton rows={4} cols={6} />
    </div>
  );
}