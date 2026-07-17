import React from 'react';
import { Clock, CreditCard } from 'lucide-react';
import './History.css';
import { API_URL } from '../../App';
import { useToast } from '../../context/ToastContext';
import Pagination from '../../components/shared/Pagination';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';
import EmptyState from '../../components/shared/EmptyState';

const StatusBadge = ({ status }) => {
  const colors = {
    pending: { background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.4)' },
    assigned: { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' },
    en_route: { background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.4)' },
    completed: { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' },
    cancelled: { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' },
  };
  return (
    <span style={{
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      ...(colors[status] || colors.pending)
    }}>
      {status}
    </span>
  );
};

export default function History({
  jobsHistory,
  historyLoading,
  historyPage,
  setHistoryPage,
  itemsPerPage,
  complaintMap,
  setActiveJob,
  setShowPaymentModal,
  setFeedbackJob,
  setFeedbackRating,
  setFeedbackText,
  setShowFeedbackModal,
  openComplaintModal,
  setActiveTab,
  setDispatchStatus,
  setWorkerDetails,
  setWorkerCoords,
  setupSocket
}) {
  const toast = useToast();

  const getPaginatedItems = (items, page) => items.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const getTotalPages = (items) => Math.max(1, Math.ceil(items.length / itemsPerPage));

  const visibleHistory = getPaginatedItems(jobsHistory, historyPage);
  const historyTotalPages = getTotalPages(jobsHistory);

  return (
    <div className="card">
      <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>Job Booking & Project History</h3>

      {historyLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : jobsHistory.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No service requests yet"
          description="Book a daily service or submit a construction project to see your history here."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setActiveTab('daily')}>
              Book a Service
            </button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-grey)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px' }}>Service Type</th>
                  <th style={{ padding: '12px' }}>Category</th>
                  <th style={{ padding: '12px' }}>Worker</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Payment</th>
                  <th style={{ padding: '12px' }}>Your Review</th>
                  <th style={{ padding: '12px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleHistory.map((job) => (
                  <tr key={job._id} style={{ borderBottom: '1px solid var(--border-grey)' }}>
                    <td style={{ padding: '12px', textTransform: 'capitalize' }}>
                      <span style={{ fontWeight: '700', color: job.type === 'daily' ? 'var(--primary-orange)' : '#10b981' }}>
                        {job.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>{job.category}</td>
                    <td style={{ padding: '12px' }}>
                      {job.worker ? (
                        <div>
                          <div>{job.worker.name}</div>
                          {job.worker.averageRating !== undefined && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: '#fbbf24' }}>★</span>
                              <span style={{ fontWeight: 'bold', color: '#fff' }}>{job.worker.averageRating}</span>
                              <span>({job.worker.totalReviews})</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Not Assigned</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <StatusBadge status={job.status} />
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {job.type === 'construction' ? (
                          <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Budget Hidden</span>
                        ) : (
                          <span style={{ fontWeight: '600' }}>{job.payment.amount} PKR</span>
                        )}
                        <span style={{ fontSize: '11px', color: job.payment.status === 'paid' ? 'var(--success-color)' : 'var(--warning-color)' }}>
                          {job.payment.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                        {job.type !== 'construction' && (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Hold: {job.payment.holdStatus || 'held'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {job.review?.rating ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1,2,3,4,5].map(s => (
                              <span key={s} style={{ fontSize: '16px', color: s <= job.review.rating ? '#fbbf24' : 'var(--text-muted)' }}>★</span>
                            ))}
                          </div>
                          {job.review.feedback && (
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              "{job.review.feedback}"
                            </span>
                          )}
                        </div>
                      ) : job.status === 'completed' && job.worker ? (
                        <button
                          onClick={() => {
                            setFeedbackJob(job);
                            setFeedbackRating(5);
                            setFeedbackText('');
                            setShowFeedbackModal(true);
                          }}
                          style={{
                            background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))',
                            border: '1px solid rgba(251,191,36,0.4)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            color: '#fbbf24',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.25)'; e.currentTarget.style.borderColor = '#fbbf24'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))'; e.currentTarget.style.borderColor = 'rgba(251,191,36,0.4)'; }}
                        >
                          ★ Leave Review
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

                        {/* Pay Now – for completed but unpaid jobs */}
                        {job.status === 'completed' && job.payment.status !== 'paid' && (
                          <button
                            onClick={() => {
                              setActiveJob(job);
                              setShowPaymentModal(true);
                            }}
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <CreditCard size={12} /> Pay Now
                          </button>
                        )}

                        {/* Complaint – filed already */}
                        {complaintMap[job._id] ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Complaint</span>
                            <span className={`complaint-status complaint-status--${complaintMap[job._id].status}`}>
                              {complaintMap[job._id].status}
                            </span>
                          </div>
                        ) : job.status === 'completed' && job.payment.status === 'paid' ? (
                          (() => {
                            const paidAt = job.payment.paidAt ? new Date(job.payment.paidAt) : null;
                            const windowExpired = paidAt && (Date.now() - paidAt.getTime() > 24 * 60 * 60 * 1000);
                            return windowExpired ? (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={11} /> Complaint window expired
                              </span>
                            ) : (
                              <button
                                onClick={() => openComplaintModal(job)}
                                className="btn btn-danger"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                              >
                                🚩 File Complaint
                              </button>
                            );
                          })()
                        ) : null}

                        {/* Track Live */}
                        {['assigned', 'en_route'].includes(job.status) && (
                          <button
                            onClick={() => {
                              setActiveJob(job);
                              setDispatchStatus('accepted');
                              if (job.worker) {
                                setWorkerDetails(job.worker);
                                setWorkerCoords({ latitude: job.worker.latitude, longitude: job.worker.longitude });
                              }
                              setActiveTab('daily');
                              setupSocket(job._id);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            Track Live
                          </button>
                        )}

                        {/* Resume Match */}
                        {job.status === 'pending' && job.type === 'daily' && (
                          <button
                            onClick={() => {
                              setActiveJob(job);
                              setDispatchStatus('searching');
                              setActiveTab('daily');
                              setupSocket(job._id);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            Resume Match
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={historyPage}
            totalPages={historyTotalPages}
            totalItems={jobsHistory.length}
            pageSize={itemsPerPage}
            onPageChange={setHistoryPage}
            itemLabel="records"
          />
        </div>
      )}
    </div>
  );
}
