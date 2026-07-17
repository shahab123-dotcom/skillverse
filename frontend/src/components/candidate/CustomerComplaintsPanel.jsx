import './CustomerComplaintsPanel.css';
import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import ComplaintModal from './ComplaintModal';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { API_URL } from '../../App';

export default function CustomerComplaintsPanel() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [paidJobs, setPaidJobs] = useState([]);

  useEffect(() => {
    loadComplaints();
    loadPaidJobs();
  }, []);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/complaints/customer`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (res.ok) setComplaints(data);
    } catch (err) {
      console.error('Failed to load complaints', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPaidJobs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/jobs/customer`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (res.ok) {
        // Filter jobs that are paid and don't have existing complaints
        const paid = data.filter(job => 
          job.payment.status === 'paid' && 
          !complaints.some(c => String(c.jobId) === String(job._id))
        );
        setPaidJobs(paid);
      }
    } catch (err) {
      console.error('Failed to load paid jobs', err);
    }
  };

  const openModalFor = (job) => {
    setSelectedJob(job);
    setShowModal(true);
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    setSelectedJob(null);
    loadComplaints();
    loadPaidJobs();
  };

  if (loading) {
    return (
      <div className="card card--padded">
        <TableSkeleton rows={3} cols={4} />
      </div>
    );
  }

  return (
    <div className="card card--padded">
      <div className="section-header">
        <ShieldAlert size={20} color="var(--primary-orange)" />
        <div className="section-header__text">
          <h3>My Complaints & Disputes</h3>
          <p>Track dispute status and submit new complaints for recent jobs.</p>
        </div>
        <button 
          type="button" 
          onClick={() => openModalFor(paidJobs[0] || null)} 
          className="btn btn-primary btn-sm"
          disabled={paidJobs.length === 0}
        >
          File New Complaint
        </button>
      </div>

      {complaints.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No complaints filed"
          description={paidJobs.length === 0 
            ? "You have no paid jobs to file complaints against. Complete and pay for a job first." 
            : "You have no disputes yet. File a complaint if you need help with a recent job."}
          action={
            paidJobs.length > 0 ? (
              <button type="button" className="btn btn-primary" onClick={() => openModalFor(paidJobs[0])}>
                File a Complaint
              </button>
            ) : null
          }
        />
      ) : (
        <div className="complaint-grid">
          {complaints.map((c) => (
            <div key={c._id} className="card complaint-row">
              <div>
                <div className="complaint-meta">
                  {c.title}{' '}
                  <span className="complaint-time">({c.category})</span>
                </div>
                <div className="complaint-detail">{c.details}</div>
                <div className="complaint-time">
                  Status: <StatusBadge status={c.status} />
                </div>
              </div>
              <div className="complaint-actions">
                <div className="complaint-time">{new Date(c.createdAt).toLocaleString()}</div>
                {c.evidenceUrl && (
                  <a
                    href={c.evidenceUrl.startsWith('http') ? c.evidenceUrl : `${API_URL}${c.evidenceUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    View Evidence
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ComplaintModal
          job={selectedJob}
          paidJobs={paidJobs}
          token={localStorage.getItem('token')}
          onClose={() => setShowModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
