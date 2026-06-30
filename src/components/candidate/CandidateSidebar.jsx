import { Zap, Hammer, Clock, ShieldAlert } from 'lucide-react';

const CANDIDATE_TABS = [
  { id: 'daily', label: 'Daily Service', icon: Zap },
  { id: 'construction', label: 'Construction', icon: Hammer },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'complaints', label: 'Complaints', icon: ShieldAlert },
];

export default function CandidateSidebar({ activeTab, onChange }) {
  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-panel">
        <div className="sidebar-brand">
          <div className="sidebar-brand__icon">
            <Zap size={22} />
          </div>
          <div>
            <p className="sidebar-role">Customer</p>
            <h3 className="sidebar-title">Service Center</h3>
          </div>
        </div>

        <div className="sidebar-items">
          {CANDIDATE_TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => onChange(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
