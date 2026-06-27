import React, { useState, useEffect } from 'react';
import { Users, Hammer, CreditCard, Check, X, Trash2, ShieldAlert, UserCircle, ListChecks, Ban, ShieldCheck } from 'lucide-react';
import { API_URL } from '../../App';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import DashboardLayout from '../../components/shared/DashboardLayout';
import AdminSidebar from '../../components/admin/AdminSidebar';
import StatusBadge from '../../components/shared/StatusBadge';
import EmptyState from '../../components/shared/EmptyState';
import Pagination from '../../components/shared/Pagination';

export default function AdminDashboard({ user }) {
  const toast = useToast();
  const confirm = useConfirm();
  // Statistics and States
  const [workers, setWorkers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [constructionJobs, setConstructionJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [paymentsStats, setPaymentsStats] = useState({ totalEarnings: 0, pendingEarnings: 0, completedJobsCount: 0 });
  const [complaints, setComplaints] = useState([]);
  const [expandedComplaint, setExpandedComplaint] = useState(null);
  const [resolveData, setResolveData] = useState({}); // complaintId -> { refundAmount, adminNote }
  const [resolving, setResolving] = useState({});

  const itemsPerPage = 10;
  const [workerPage, setWorkerPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [serviceHistoryPage, setServiceHistoryPage] = useState(1);
  const [constructionPage, setConstructionPage] = useState(1);
  const [escrowPage, setEscrowPage] = useState(1);
  const [complaintPage, setComplaintPage] = useState(1);

  // Assignment states
  const [selectedWorkers, setSelectedWorkers] = useState({}); // jobId -> workerId mapping
  const [customQuote, setCustomQuote] = useState({}); // jobId -> quote amount mapping

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      
      // Load Workers list
      const wRes = await fetch(`${API_URL}/api/admin/workers`, { headers });
      const wData = await wRes.json();
      if (wRes.ok) setWorkers(wData);

      const cRes = await fetch(`${API_URL}/api/admin/customers`, { headers });
      const cData = await cRes.json();
      if (cRes.ok) setCustomers(cData);

      // Load Jobs list
      const jRes = await fetch(`${API_URL}/api/jobs/admin`, { headers });
      const jData = await jRes.json();
      if (jRes.ok) {
        setAllJobs(jData);
        setConstructionJobs(jData.filter(job => job.type === 'construction'));
      }

      // Load Payment Statistics
      const pRes = await fetch(`${API_URL}/api/admin/payments`, { headers });
      const pData = await pRes.json();
      if (pRes.ok) setPaymentsStats(pData);

      // Load Complaints
      const compRes = await fetch(`${API_URL}/api/admin/complaints`, { headers });
      const compData = await compRes.json();
      if (compRes.ok) setComplaints(compData);

      setWorkerPage(1);
      setCustomerPage(1);
      setServiceHistoryPage(1);
      setConstructionPage(1);
      setEscrowPage(1);
      setComplaintPage(1);
    } catch (error) {
      console.error("Admin data loading failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // Worker approval / rejection
  const handleApproveWorker = async (workerId, status) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/workers/${workerId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        toast.success(`Worker status updated to ${status}.`);
        loadAdminData();
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to update worker status.');
    }
  };

  const handleConstructorApproval = async (workerId, constructorStatus) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/workers/${workerId}/constructor-approval`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ constructorStatus })
      });
      if (response.ok) {
        toast.success(`Constructor verification ${constructorStatus}.`);
        loadAdminData();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update constructor request status.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to update constructor request status.');
    }
  };

  const handleRemoveWorker = async (workerId) => {
    const confirmed = await confirm({
      title: 'Remove Worker',
      message: 'Are you sure you want to remove this worker from the team? This action cannot be undone.',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (!confirmed) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/workers/${workerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        toast.success('Worker removed successfully.');
        loadAdminData();
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove worker.');
    }
  };

  const handleBlockWorker = async (workerId, blocked) => {
    const action = blocked ? 'block' : 'unblock';
    const confirmed = await confirm({
      title: blocked ? 'Block Worker' : 'Unblock Worker',
      message: blocked
        ? 'This worker will be unable to log in or receive job requests. Continue?'
        : 'This worker will be able to log in and receive jobs again. Continue?',
      confirmLabel: blocked ? 'Block' : 'Unblock',
      cancelLabel: 'Cancel',
      danger: blocked,
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/workers/${workerId}/block`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ blocked })
      });
      if (response.ok) {
        toast.success(`Worker ${action}ed successfully.`);
        loadAdminData();
      } else {
        const data = await response.json();
        toast.error(data.error || `Failed to ${action} worker.`);
      }
    } catch (error) {
      console.error(error);
      toast.error(`Failed to ${action} worker.`);
    }
  };

  const handleBlockCustomer = async (customerId, blocked) => {
    const action = blocked ? 'block' : 'unblock';
    const confirmed = await confirm({
      title: blocked ? 'Block Customer' : 'Unblock Customer',
      message: blocked
        ? 'This customer will be unable to log in or book new services. Continue?'
        : 'This customer will be able to log in and book services again. Continue?',
      confirmLabel: blocked ? 'Block' : 'Unblock',
      cancelLabel: 'Cancel',
      danger: blocked,
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/customers/${customerId}/block`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ blocked })
      });
      if (response.ok) {
        toast.success(`Customer ${action}ed successfully.`);
        loadAdminData();
      } else {
        const data = await response.json();
        toast.error(data.error || `Failed to ${action} customer.`);
      }
    } catch (error) {
      console.error(error);
      toast.error(`Failed to ${action} customer.`);
    }
  };

  const handleAssignWorker = async (jobId) => {
    const workerId = selectedWorkers[jobId];
    const amount = customQuote[jobId];

    if (!workerId) return toast.warning('Please select a worker first');

    try {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ workerId, amount: amount ? Number(amount) : undefined })
      });

      if (response.ok) {
        toast.success('Contractor assigned to project successfully.');
        loadAdminData();
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to assign contractor.');
    }
  };

  const handleResolveComplaint = async (complaintId, action) => {
    const data = resolveData[complaintId] || {};
    const confirmed = await confirm({
      title: action === 'approve' ? 'Approve Dispute & Issue Refund' : 'Reject Dispute & Release Payment',
      message: action === 'approve'
        ? `Issue a refund of PKR ${data.refundAmount || '(full amount)'} to the customer? This will execute a Stripe refund.`
        : 'Reject this complaint and release the held funds to the worker?',
      confirmLabel: action === 'approve' ? 'Approve & Refund' : 'Reject & Release',
      danger: action === 'approve',
    });
    if (!confirmed) return;

    setResolving(prev => ({ ...prev, [complaintId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/admin/complaints/${complaintId}/resolve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          action,
          refundAmount: data.refundAmount ? Number(data.refundAmount) : undefined,
          adminNote: data.adminNote || ''
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to resolve complaint');
      toast.success(result.message);
      setExpandedComplaint(null);
      loadAdminData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResolving(prev => ({ ...prev, [complaintId]: false }));
    }
  };

  const updateResolveField = (complaintId, field, value) => {
    setResolveData(prev => ({
      ...prev,
      [complaintId]: { ...(prev[complaintId] || {}), [field]: value }
    }));
  };

  const getPaginatedItems = (items, page) => items.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const getTotalPages = (items) => Math.max(1, Math.ceil(items.length / itemsPerPage));

  const visibleWorkers = getPaginatedItems(workers, workerPage);
  const visibleCustomers = getPaginatedItems(customers, customerPage);
  const visibleServiceHistory = getPaginatedItems(allJobs, serviceHistoryPage);
  const visibleConstructionJobs = getPaginatedItems(constructionJobs, constructionPage);
  const visibleEscrowJobs = getPaginatedItems(allJobs, escrowPage);
  const visibleComplaints = getPaginatedItems(complaints, complaintPage);

  const workerTotalPages = getTotalPages(workers);
  const customerTotalPages = getTotalPages(customers);
  const serviceHistoryTotalPages = getTotalPages(allJobs);
  const constructionTotalPages = getTotalPages(constructionJobs);
  const escrowTotalPages = getTotalPages(allJobs);
  const complaintTotalPages = getTotalPages(complaints);

  // Dropdown helper to filter approved workers by matching category skills
  const getMatchingWorkers = (category) => {
    // Map construction categories to matching worker skills if needed, or simple string match
    return workers.filter(w => w.status === 'approved' && !w.isBlocked && w.skills.includes(category));
  };

  const pageMeta = {
    overview: {
      title: 'Overview',
      subtitle: 'Platform-wide stats for workers, jobs, and escrow funds.',
    },
    'worker-approval': {
      title: 'Worker Management',
      subtitle: 'Review registrations, approve skills, block accounts, and manage your worker roster.',
    },
    'customer-management': {
      title: 'Customer Management',
      subtitle: 'View all registered customers, their activity, and block or unblock accounts.',
    },
    'service-history': {
      title: 'Service History',
      subtitle: 'Full platform log of every daily and construction service request.',
    },
    'construction-assignment': {
      title: 'Construction Projects',
      subtitle: 'Match construction requests with approved contractors and set quotes.',
    },
    'escrow-ledger': {
      title: 'Escrow Ledger',
      subtitle: 'Monitor held funds, releases, and payment status across all jobs.',
    },
    complaints: {
      title: 'Complaints & Disputes',
      subtitle: 'Review and resolve customer disputes and refund requests.',
    },
  }[activeTab];

  return (
    <DashboardLayout
      sidebar={<AdminSidebar activeTab={activeTab} onChange={setActiveTab} />}
      title={pageMeta.title}
      subtitle={pageMeta.subtitle}
      userName={user?.name}
      loading={loading}
    >

      {activeTab === 'overview' && (
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-card__label">Total Customers</span>
            <h3 className="stat-card__value stat-card__value--accent">{customers.length}</h3>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Total System Workers</span>
            <h3 className="stat-card__value stat-card__value--accent">{workers.length}</h3>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Total Jobs Processed</span>
            <h3 className="stat-card__value stat-card__value--accent">{allJobs.length}</h3>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Funds Secured in Escrow</span>
            <h3 className="stat-card__value stat-card__value--success">{paymentsStats.pendingEarnings} PKR</h3>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Total Released Payments</span>
            <h3 className="stat-card__value stat-card__value--success">{paymentsStats.totalEarnings} PKR</h3>
          </div>
        </div>
      )}

      {activeTab === 'worker-approval' && (
        <div className="card card--padded">
          <div className="section-header">
            <Users size={20} color="var(--primary-orange)" />
            <div className="section-header__text">
              <h3>Worker Approval & Staff Management</h3>
              <p>Approve pending workers or remove staff from the platform.</p>
            </div>
          </div>

          {workers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No workers registered"
              description="Worker registrations will appear here for review and approval."
            />
          ) : (
            <>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-grey)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px' }}>Worker Name</th>
                      <th style={{ padding: '12px' }}>Email</th>
                      <th style={{ padding: '12px' }}>Phone</th>
                      <th style={{ padding: '12px' }}>Skills</th>
                      <th style={{ padding: '12px' }}>Role</th>
                      <th style={{ padding: '12px' }}>Approval Status</th>
                      <th style={{ padding: '12px' }}>Constructor Request</th>
                      <th style={{ padding: '12px' }}>Account</th>
                      <th style={{ padding: '12px' }}>Requests Stats</th>
                      <th style={{ padding: '12px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleWorkers.map(w => (
                      <tr key={w._id} style={{ borderBottom: '1px solid var(--border-grey)' }}>
                        <td style={{ padding: '12px', fontWeight: '700', color: '#fff' }}>{w.name}</td>
                        <td style={{ padding: '12px' }}>{w.email}</td>
                        <td style={{ padding: '12px' }}>{w.phone}</td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {w.skills.map(s => <StatusBadge key={s} status="info" label={s} className="badge-sm" />)}
                          </div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {w.isConstructor ? (
                            <StatusBadge status="info" label="Constructor" />
                          ) : (
                            <StatusBadge status="info" label="Worker" />
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <StatusBadge status={w.status} />
                        </td>
                        <td style={{ padding: '12px' }}>
                          {w.constructorDetails?.status === 'pending' ? (
                            <div style={{ display: 'grid', gap: '6px' }}>
                              <StatusBadge status="pending" label="Pending Review" />
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => handleConstructorApproval(w._id, 'approved')}
                                  className="btn btn-primary"
                                  style={{ padding: '6px 10px', fontSize: '11px', background: 'var(--success-color)' }}
                                >
                                  <Check size={12} /> Approve
                                </button>
                                <button
                                  onClick={() => handleConstructorApproval(w._id, 'rejected')}
                                  className="btn btn-danger"
                                  style={{ padding: '6px 10px', fontSize: '11px' }}
                                >
                                  <X size={12} /> Reject
                                </button>
                              </div>
                            </div>
                          ) : (
                            <StatusBadge
                              status={w.constructorDetails?.status === 'none' ? 'info' : w.constructorDetails?.status || 'info'}
                              label={w.constructorDetails?.status === 'none' ? 'No Request' : undefined}
                            />
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <StatusBadge status={w.isBlocked ? 'blocked' : 'active'} label={w.isBlocked ? 'Blocked' : 'Active'} />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div>
                            <span>Total: <strong>{w.totalRequests}</strong></span> | <span>Done: <strong style={{ color: 'var(--success-color)' }}>{w.completedRequests}</strong></span>
                          </div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {w.status === 'pending' ? (
                              <>
                                <button 
                                  onClick={() => handleApproveWorker(w._id, 'approved')} 
                                  className="btn btn-primary" 
                                  style={{ padding: '6px 10px', fontSize: '11px', background: 'var(--success-color)' }}
                                >
                                  <Check size={12} /> Approve
                                </button>
                                <button 
                                  onClick={() => handleApproveWorker(w._id, 'rejected')} 
                                  className="btn btn-danger" 
                                  style={{ padding: '6px 10px', fontSize: '11px' }}
                                >
                                  <X size={12} /> Reject
                                </button>
                              </>
                            ) : (
                              <>
                                {w.isBlocked ? (
                                  <button
                                    onClick={() => handleBlockWorker(w._id, false)}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--success-color)', borderColor: 'rgba(16,185,129,0.3)' }}
                                  >
                                    <ShieldCheck size={12} /> Unblock
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleBlockWorker(w._id, true)}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--warning-color)', borderColor: 'rgba(245,158,11,0.3)' }}
                                  >
                                    <Ban size={12} /> Block
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleRemoveWorker(w._id)} 
                                  className="btn btn-secondary" 
                                  style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--error-color)', borderColor: 'rgba(239,68,68,0.2)' }}
                                >
                                  <Trash2 size={12} /> Remove
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={workerPage}
                totalPages={workerTotalPages}
                totalItems={workers.length}
                pageSize={itemsPerPage}
                onPageChange={setWorkerPage}
                itemLabel="workers"
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'customer-management' && (
        <div className="card card--padded">
          <div className="section-header">
            <UserCircle size={20} color="var(--primary-orange)" />
            <div className="section-header__text">
              <h3>Registered Customers</h3>
              <p>View customer profiles, booking activity, and manage account access.</p>
            </div>
          </div>

          {customers.length === 0 ? (
            <EmptyState
              icon={UserCircle}
              title="No customers registered"
              description="Customer accounts will appear here once they sign up."
            />
          ) : (
            <>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-grey)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px' }}>Customer Name</th>
                      <th style={{ padding: '12px' }}>Email</th>
                      <th style={{ padding: '12px' }}>Phone</th>
                      <th style={{ padding: '12px' }}>Total Bookings</th>
                      <th style={{ padding: '12px' }}>Completed</th>
                      <th style={{ padding: '12px' }}>Account</th>
                      <th style={{ padding: '12px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCustomers.map(c => (
                      <tr key={c._id} style={{ borderBottom: '1px solid var(--border-grey)' }}>
                        <td style={{ padding: '12px', fontWeight: '700', color: '#fff' }}>{c.name}</td>
                        <td style={{ padding: '12px' }}>{c.email}</td>
                        <td style={{ padding: '12px' }}>{c.phone}</td>
                        <td style={{ padding: '12px' }}><strong>{c.totalJobs || 0}</strong></td>
                        <td style={{ padding: '12px', color: 'var(--success-color)' }}><strong>{c.completedJobs || 0}</strong></td>
                        <td style={{ padding: '12px' }}>
                          <StatusBadge status={c.isBlocked ? 'blocked' : 'active'} label={c.isBlocked ? 'Blocked' : 'Active'} />
                        </td>
                        <td style={{ padding: '12px' }}>
                          {c.isBlocked ? (
                            <button
                              onClick={() => handleBlockCustomer(c._id, false)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--success-color)', borderColor: 'rgba(16,185,129,0.3)' }}
                            >
                              <ShieldCheck size={12} /> Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBlockCustomer(c._id, true)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--warning-color)', borderColor: 'rgba(245,158,11,0.3)' }}
                            >
                              <Ban size={12} /> Block
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={customerPage}
                totalPages={customerTotalPages}
                totalItems={customers.length}
                pageSize={itemsPerPage}
                onPageChange={setCustomerPage}
                itemLabel="customers"
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'service-history' && (
        <div className="card card--padded">
          <div className="section-header">
            <ListChecks size={20} color="var(--primary-orange)" />
            <div className="section-header__text">
              <h3>All Service History</h3>
              <p>Complete log of every daily and construction service on the platform.</p>
            </div>
          </div>

          {allJobs.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No service records"
              description="Service requests will appear here as customers book jobs."
            />
          ) : (
            <>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-grey)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px' }}>Date</th>
                      <th style={{ padding: '12px' }}>Job ID</th>
                      <th style={{ padding: '12px' }}>Type</th>
                      <th style={{ padding: '12px' }}>Category</th>
                      <th style={{ padding: '12px' }}>Customer</th>
                      <th style={{ padding: '12px' }}>Worker</th>
                      <th style={{ padding: '12px' }}>Location</th>
                      <th style={{ padding: '12px' }}>Status</th>
                      <th style={{ padding: '12px' }}>Amount</th>
                      <th style={{ padding: '12px' }}>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleServiceHistory.map(job => (
                      <tr key={job._id} style={{ borderBottom: '1px solid var(--border-grey)' }}>
                        <td style={{ padding: '12px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {new Date(job.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'monospace' }}>{job._id.slice(-8)}</td>
                        <td style={{ padding: '12px', textTransform: 'capitalize' }}>{job.type}</td>
                        <td style={{ padding: '12px' }}>{job.category}</td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{job.customer?.name || '—'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{job.customer?.email || job.customer?.phone || ''}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {job.worker ? (
                            <>
                              <div style={{ fontWeight: 600, color: '#fff' }}>{job.worker.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{job.worker.phone}</div>
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', fontSize: '12px', maxWidth: '180px' }}>
                          {job.location?.address || '—'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <StatusBadge status={job.status} />
                        </td>
                        <td style={{ padding: '12px', fontWeight: '700' }}>
                          {job.payment?.amount ? `${job.payment.amount.toLocaleString()} PKR` : '—'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <StatusBadge
                            status={job.payment?.status === 'paid' ? 'paid' : 'pending'}
                            label={job.payment?.status === 'paid' ? 'Paid' : 'Pending'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={serviceHistoryPage}
                totalPages={serviceHistoryTotalPages}
                totalItems={allJobs.length}
                pageSize={itemsPerPage}
                onPageChange={setServiceHistoryPage}
                itemLabel="services"
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'construction-assignment' && (
        <div className="card card--padded">
          <div className="section-header">
            <Hammer size={20} color="var(--primary-orange)" />
            <div className="section-header__text">
              <h3>Construction Project Assignment</h3>
              <p>Match construction requests with approved contractors and set quotes.</p>
            </div>
          </div>

          {constructionJobs.length === 0 ? (
            <EmptyState
              icon={Hammer}
              title="No construction projects"
              description="Customer construction requests will appear here for assignment."
            />
          ) : (
            <>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-grey)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px' }}>Client Info</th>
                      <th style={{ padding: '12px' }}>Project Category</th>
                      <th style={{ padding: '12px' }}>Scope Details</th>
                      <th style={{ padding: '12px' }}>Est. Budget</th>
                      <th style={{ padding: '12px' }}>Assigned Contractor</th>
                      <th style={{ padding: '12px' }}>Assignment & Quote Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleConstructionJobs.map(job => {
                      const matchingWorkers = getMatchingWorkers(job.category);
                      return (
                        <tr key={job._id} style={{ borderBottom: '1px solid var(--border-grey)' }}>
                          <td style={{ padding: '12px' }}>
                            <span style={{ fontWeight: '700', color: '#fff', display: 'block' }}>{job.customer?.name || 'Customer'}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{job.customer?.phone || '—'}</span>
                          </td>
                          <td style={{ padding: '12px', fontWeight: '600' }}>{job.category}</td>
                          <td style={{ padding: '12px', maxWidth: '280px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.description}>
                              {job.description}
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Site: {job.location.address}</span>
                          </td>
                          <td style={{ padding: '12px', fontWeight: '700' }}>{job.payment.amount} PKR</td>
                          <td style={{ padding: '12px' }}>
                            {job.worker ? (
                              <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>{job.worker?.name || 'Worker'}</span>
                            ) : (
                              <span style={{ color: 'var(--warning-color)' }}>Awaiting Assignment</span>
                            )}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {!job.worker ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '200px' }}>
                                
                                {/* Contractor Select */}
                                <select
                                  value={selectedWorkers[job._id] || ''}
                                  onChange={(e) => setSelectedWorkers({ ...selectedWorkers, [job._id]: e.target.value })}
                                  className="form-input"
                                  style={{ fontSize: '12px', padding: '6px' }}
                                >
                                  <option value="">-- Match Contractor --</option>
                                  {matchingWorkers.map(w => (
                                    <option key={w._id} value={w._id}>{w.name}</option>
                                  ))}
                                </select>

                                {/* Custom budget override */}
                                <input 
                                  type="number" 
                                  placeholder="Override Quote (PKR)"
                                  value={customQuote[job._id] || ''}
                                  onChange={(e) => setCustomQuote({ ...customQuote, [job._id]: e.target.value })}
                                  className="form-input"
                                  style={{ fontSize: '12px', padding: '6px' }}
                                />

                                <button 
                                  onClick={() => handleAssignWorker(job._id)}
                                  className="btn btn-primary"
                                  style={{ padding: '6px 12px', fontSize: '12px' }}
                                >
                                  Confirm Assignment
                                </button>
                              </div>
                            ) : (
                              <StatusBadge status="assigned" label="Assigned & Locked" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={constructionPage}
                totalPages={constructionTotalPages}
                totalItems={constructionJobs.length}
                pageSize={itemsPerPage}
                onPageChange={setConstructionPage}
                itemLabel="projects"
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'escrow-ledger' && (
        <div className="card card--padded">
          <div className="section-header">
            <CreditCard size={20} color="var(--primary-orange)" />
            <div className="section-header__text">
              <h3>Platform Escrow Ledger</h3>
              <p>Monitor held funds, releases, and payment status across all jobs.</p>
            </div>
          </div>

          {allJobs.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No escrow records"
              description="Payment and escrow data will appear as jobs are processed."
            />
          ) : (
            <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-grey)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px' }}>Job ID</th>
                  <th style={{ padding: '12px' }}>Type</th>
                  <th style={{ padding: '12px' }}>Category</th>
                  <th style={{ padding: '12px' }}>Contract Amount</th>
                  <th style={{ padding: '12px' }}>Escrow Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleEscrowJobs.map(job => (
                  <tr key={job._id} style={{ borderBottom: '1px solid var(--border-grey)' }}>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>{job._id.slice(-8)}</td>
                    <td style={{ padding: '12px', textTransform: 'capitalize' }}>{job.type}</td>
                    <td style={{ padding: '12px' }}>{job.category}</td>
                    <td style={{ padding: '12px', fontWeight: '700' }}>{job.payment.amount} PKR</td>
                    <td style={{ padding: '12px' }}>
                      <StatusBadge
                        status={job.payment.holdStatus === 'released' ? 'released' : job.payment.status === 'paid' ? 'held' : 'pending'}
                        label={
                          job.payment.holdStatus === 'released'
                            ? 'Released to Worker'
                            : job.payment.status === 'paid'
                              ? 'Held in Escrow'
                              : 'Awaiting Payment'
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={escrowPage}
            totalPages={escrowTotalPages}
            totalItems={allJobs.length}
            pageSize={itemsPerPage}
            onPageChange={setEscrowPage}
            itemLabel="jobs"
          />
            </>
          )}
        </div>
      )}

      {activeTab === 'complaints' && (
        <div className="card card--padded">
          <div className="section-header">
            <ShieldAlert size={20} color="var(--primary-orange)" />
            <div className="section-header__text">
              <h3>Customer Complaints & Disputes</h3>
              <p>Review and resolve customer disputes and refund requests.</p>
            </div>
          </div>

          {complaints.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title="No Complaints Filed"
              description="Customer disputes will appear here when filed."
            />
          ) : (
            <>
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {complaints.filter(c => c.status === 'pending').length} pending · {complaints.length} total
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {visibleComplaints.map(c => {
                  const isExpanded = expandedComplaint === c._id;
                  const isPending = c.status === 'pending';
                  const rData = resolveData[c._id] || {};
                  const isResolvingNow = resolving[c._id];
                  return (
                    <div
                      key={c._id}
                      style={{
                        background: isPending ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isPending ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: '14px',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Complaint Header Row */}
                      <div
                        style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
                        onClick={() => setExpandedComplaint(isExpanded ? null : c._id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                            background: isPending ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '18px'
                          }}>
                            {isPending ? '🚩' : c.status === 'approved' ? '✅' : '❌'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '14px', fontWeight: '700', color: '#f5f5f7', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                              {c.customerName} vs {c.workerName} · Job #{String(c.jobId).slice(-6)}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                          <StatusBadge status={c.status} />
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ paddingTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</span>
                              <p style={{ margin: '4px 0 0', fontWeight: '600', color: '#f5f5f7' }}>{c.customerName}</p>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Worker</span>
                              <p style={{ margin: '4px 0 0', fontWeight: '600', color: '#f5f5f7' }}>{c.workerName}</p>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px', gridColumn: '1/-1' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Complaint Details</span>
                              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#d1d5db', lineHeight: '1.6' }}>{c.details}</p>
                            </div>
                            {c.evidenceUrl && (
                              <div style={{ gridColumn: '1/-1' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Evidence</span>
                                <div style={{ marginTop: '8px' }}>
                                  <a
                                    href={c.evidenceUrl.startsWith('http') ? c.evidenceUrl : `${API_URL}${c.evidenceUrl}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: 'var(--primary-orange)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                  >
                                    📎 View Uploaded Evidence
                                  </a>
                                </div>
                              </div>
                            )}
                            {c.refundAmount > 0 && (
                              <div style={{ gridColumn: '1/-1', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '10px', padding: '12px' }}>
                                <span style={{ fontSize: '12px', color: '#4ade80' }}>✅ Refunded: PKR {c.refundAmount.toLocaleString()}</span>
                                {c.adminNote && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0' }}>Admin note: {c.adminNote}</p>}
                              </div>
                            )}
                          </div>

                          {/* Resolution Controls — only for pending complaints */}
                          {isPending && (
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px' }}>
                              <p style={{ fontSize: '13px', fontWeight: '600', color: '#f5f5f7', marginBottom: '12px' }}>⚖️ Resolve Dispute</p>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                <div>
                                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Refund Amount (PKR)</label>
                                  <input
                                    type="number"
                                    placeholder="Leave blank for full refund"
                                    value={rData.refundAmount || ''}
                                    onChange={e => updateResolveField(c._id, 'refundAmount', e.target.value)}
                                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-grey)', borderRadius: '8px', padding: '9px 12px', color: '#f5f5f7', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Admin Note (Optional)</label>
                                  <input
                                    type="text"
                                    placeholder="Internal resolution note"
                                    value={rData.adminNote || ''}
                                    onChange={e => updateResolveField(c._id, 'adminNote', e.target.value)}
                                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-grey)', borderRadius: '8px', padding: '9px 12px', color: '#f5f5f7', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                  />
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                  onClick={() => handleResolveComplaint(c._id, 'approve')}
                                  disabled={isResolvingNow}
                                  style={{
                                    flex: 1, padding: '10px', borderRadius: '9px', border: 'none',
                                    background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff',
                                    fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                                    opacity: isResolvingNow ? 0.6 : 1
                                  }}
                                >
                                  {isResolvingNow ? '⏳ Processing…' : '✅ Approve & Refund Customer'}
                                </button>
                                <button
                                  onClick={() => handleResolveComplaint(c._id, 'reject')}
                                  disabled={isResolvingNow}
                                  style={{
                                    flex: 1, padding: '10px', borderRadius: '9px', border: 'none',
                                    background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)',
                                    fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                                    opacity: isResolvingNow ? 0.6 : 1
                                  }}
                                >
                                  {isResolvingNow ? '⏳ Processing…' : '❌ Reject & Release to Worker'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <Pagination
                page={complaintPage}
                totalPages={complaintTotalPages}
                totalItems={complaints.length}
                pageSize={itemsPerPage}
                onPageChange={setComplaintPage}
                itemLabel="complaints"
              />
            </>
          )}
        </div>
      )}

    </DashboardLayout>
  );
}
