import { HardHat, LayoutDashboard, Briefcase, Clock, User } from 'lucide-react';

const WORKER_TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'active-job', label: 'Active Job', icon: Briefcase },
  { id: 'history', label: 'Service History', icon: Clock },
];

export default function WorkerSidebar({
  activeTab,
  onChange,
  profile,
  isAvailable,
  onToggleAvailability,
  hasActiveJob = false,
  profileRef,
  availabilityRef,
}) {
  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-panel sidebar-panel--worker">
        <div className="sidebar-brand">
          <div className="sidebar-brand__icon">
            <HardHat size={22} />
          </div>
          <div>
            <p className="sidebar-role">Worker</p>
            <h3 className="sidebar-title">Workspace</h3>
          </div>
        </div>

        <nav className="sidebar-items" aria-label="Worker navigation">
          {WORKER_TABS.map((item) => {
            const Icon = item.icon;
            const showLiveBadge = item.id === 'active-job' && hasActiveJob;
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => onChange(item.id)}
              >
                <Icon size={18} />
                <span className="sidebar-item__label">{item.label}</span>
                {showLiveBadge && <span className="sidebar-nav-badge">Live</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div ref={profileRef} className="sidebar-profile">
            <div className="sidebar-profile__avatar">
              <User size={18} />
            </div>
            <div className="sidebar-profile__info">
              <p className="sidebar-profile__name">{profile?.name || 'Worker'}</p>
              <p className="sidebar-profile__meta">
                {profile?.skills?.length || 0} skill{(profile?.skills?.length || 0) !== 1 ? 's' : ''} registered
              </p>
            </div>
          </div>

          <div ref={availabilityRef} className="sidebar-availability">
            <div className="sidebar-availability__text">
              <span className={`sidebar-status-dot ${isAvailable ? 'sidebar-status-dot--online' : ''}`} />
              <div>
                <p className="sidebar-availability__label">Availability</p>
                <p className={`sidebar-availability__state ${isAvailable ? 'is-online' : ''}`}>
                  {isAvailable ? 'Online — receiving jobs' : 'Offline'}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="switch-container"
              onClick={onToggleAvailability}
              aria-label={isAvailable ? 'Go offline' : 'Go online'}
              aria-pressed={isAvailable}
            >
              <div className={`switch-track ${isAvailable ? 'active' : ''}`}>
                <div className="switch-thumb" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
