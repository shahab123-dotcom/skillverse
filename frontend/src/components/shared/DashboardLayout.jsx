import './DashboardLayout.css';
import DashboardPageHeader from './DashboardPageHeader';
import { DashboardSkeleton } from './LoadingSkeleton';

export default function DashboardLayout({ sidebar, title, subtitle, userName, loading = false, children }) {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-layout">
        {sidebar}
        <div className="dashboard-main">
          {(title || subtitle) && (
            <DashboardPageHeader title={title} subtitle={subtitle} userName={userName} />
          )}
          {loading ? <DashboardSkeleton /> : children}
        </div>
      </div>
    </div>
  );
}
