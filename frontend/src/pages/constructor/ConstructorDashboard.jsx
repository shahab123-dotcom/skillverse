import React, { useState, useEffect } from 'react';
import { Building2, HardHat, CheckCircle, Clock, DollarSign, List, Plus } from 'lucide-react';
import { API_URL } from '../../App';
import { useToast } from '../../context/ToastContext';
import DashboardLayout from '../../components/shared/DashboardLayout';
import StatusBadge from '../../components/shared/StatusBadge';
import EmptyState from '../../components/shared/EmptyState';

export default function ConstructorDashboard({ user }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [constructionProjects, setConstructionProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState({ totalEarned: 0, pendingAmount: 0, completedProjects: 0 });

  useEffect(() => {
    loadConstructionProjects();
    loadEarnings();
  }, []);

  const loadConstructionProjects = async () => {
    try {
      const response = await fetch(`${API_URL}/api/jobs?type=construction`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (response.ok) {
        setConstructionProjects(data.filter(job => String(job.worker) === user._id));
      }
    } catch (error) {
      console.error('Error loading construction projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEarnings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/workers/earnings`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (response.ok) {
        setEarnings(data);
      }
    } catch (error) {
      console.error('Error loading earnings:', error);
    }
  };

  const sidebar = (
    <div className="sidebar-panel">
      <div className="sidebar-brand">
        <div className="sidebar-brand__icon">
          <Building2 size={20} />
        </div>
        <div>
          <p className="sidebar-role">Constructor</p>
          <h3 className="sidebar-title">{user.name}</h3>
        </div>
      </div>
      <div className="sidebar-items">
        <button 
          className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <List size={16} /> Overview
        </button>
        <button 
          className={`sidebar-item ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          <Building2 size={16} /> Projects
        </button>
      </div>
    </div>
  );

  return (
    <DashboardLayout
      sidebar={sidebar}
      title="Constructor Portal"
      subtitle="Manage your construction projects"
      userName={user.name}
      loading={loading}
    >
      {activeTab === 'overview' && (
        <>
          <div className="stat-grid stat-grid--3">
            <div className="stat-card">
              <span className="stat-card__label">Total Earned</span>
              <h3 className="stat-card__value stat-card__value--success">
                ${earnings.totalEarned.toLocaleString()}
              </h3>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Pending Amount</span>
              <h3 className="stat-card__value stat-card__value--accent">
                ${earnings.pendingAmount.toLocaleString()}
              </h3>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Completed Projects</span>
              <h3 className="stat-card__value">{earnings.completedProjects}</h3>
            </div>
          </div>

          <div className="card card--padded">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px' }}>Recent Construction Projects</h3>
            </div>
            {constructionProjects.length === 0 ? (
              <EmptyState
                icon={<Building2 size={48} />}
                title="No construction projects yet"
                description="You will see construction projects assigned to you here"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {constructionProjects.slice(0, 5).map((project) => (
                  <div 
                    key={project._id}
                    style={{
                      padding: '16px',
                      background: 'var(--bg-input)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-grey)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{project.category}</h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{project.location.address}</p>
                      </div>
                      <StatusBadge status={project.status} label={project.status} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary-orange)' }}>
                        ${project.payment.amount.toLocaleString()}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'projects' && (
        <div className="card card--padded">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px' }}>All Construction Projects</h3>
          </div>
          {constructionProjects.length === 0 ? (
            <EmptyState
              icon={<Building2 size={48} />}
              title="No construction projects"
              description="Construction projects will appear here when assigned"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {constructionProjects.map((project) => (
                <div 
                  key={project._id}
                  style={{
                    padding: '16px',
                    background: 'var(--bg-input)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-grey)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{project.category}</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{project.description}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{project.location.address}</p>
                    </div>
                    <StatusBadge status={project.status} label={project.status} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary-orange)' }}>
                      ${project.payment.amount.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
