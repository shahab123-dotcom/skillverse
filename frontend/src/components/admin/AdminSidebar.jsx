import './AdminSidebar.css';
import { Shield, Users, UserCircle, Hammer, CreditCard, ShieldAlert, ListChecks } from 'lucide-react';

const ADMIN_MENU = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'worker-approval', label: 'Worker Management', icon: Users },
  { id: 'customer-management', label: 'Customer Management', icon: UserCircle },
  { id: 'service-history', label: 'Service History', icon: ListChecks },
  { id: 'construction-assignment', label: 'Construction Projects', icon: Hammer },
  { id: 'contractor-requests', label: 'Contractor Requests', icon: Hammer },
  { id: 'escrow-ledger', label: 'Escrow Ledger', icon: CreditCard },
  { id: 'complaints', label: 'Complaints', icon: ShieldAlert }
];

export default function AdminSidebar({ activeTab, onChange }) {
  return (
    <aside className="admin-dashboard-sidebar">
      <div className="admin-sidebar-panel">
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-brand__icon">
            <Shield size={22} />
          </div>
          <div>
            <p className="admin-sidebar-role">Admin</p>
            <h3 className="admin-sidebar-title">Control Panel</h3>
          </div>
        </div>

        <nav className="admin-sidebar-items" aria-label="Admin navigation">
          {ADMIN_MENU.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`admin-sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => onChange(item.id)}
              >
                <Icon size={18} />
                <span className="admin-sidebar-item__label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
