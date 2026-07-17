import React from 'react';
import { User, CheckCircle, CreditCard, ListChecks, Hammer } from 'lucide-react';
import './WorkerOverview.css';
import StatusBadge from '../../components/shared/StatusBadge';
import { WORKER_SERVICE_OPTIONS } from '../../constants/workerServices';

export default function WorkerOverview({
  profile,
  earningsSummary,
  recentReviews,
  isContractorUser,
  contractorForm,
  contractorError,
  contractorSuccess,
  contractorLoading,
  handleContractorSubmit,
  profileRef,
  availabilityRef
}) {
  const serviceSummary = [
    { label: 'Completed Services', value: earningsSummary.completedJobs, icon: CheckCircle },
    { label: 'Total Earned', value: `PKR ${earningsSummary.totalEarned.toLocaleString()}`, icon: CreditCard },
    { label: 'Pending Payment', value: `PKR ${earningsSummary.pendingAmount.toLocaleString()}`, icon: ListChecks }
  ];

  return (
    <>
      <div className="stat-grid stat-grid--3">
        {serviceSummary.map((item) => (
          <div key={item.label} className="stat-card">
            <span className="stat-card__label">{item.label}</span>
            <h3 className="stat-card__value stat-card__value--accent">{item.value}</h3>
          </div>
        ))}
      </div>

      <div className="card card--padded">
        <div className="section-header">
          <User size={20} color="var(--primary-orange)" />
          <div className="section-header__text">
            <h3>Worker Profile</h3>
            <p>Your registered details and skill categories.</p>
          </div>
        </div>
        <div className="worker-profile-grid">
          <div>
            <span className="form-label">Full Name</span>
            <p className="worker-profile-value">{profile.name}</p>
          </div>
          <div>
            <span className="form-label">Email</span>
            <p className="worker-profile-value">{profile.email}</p>
          </div>
          <div>
            <span className="form-label">Total Jobs</span>
            <p className="worker-profile-value">{profile.totalRequests}</p>
          </div>
          <div>
            <span className="form-label">Completed</span>
            <p className="worker-profile-value worker-profile-value--success">{profile.completedRequests}</p>
          </div>
        </div>

        {profile.averageRating !== undefined && profile.totalReviews !== undefined && (
          <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: 'var(--bg-dashboard)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
            <h4 style={{ fontSize: '15px', color: '#fbbf24', marginBottom: '12px' }}>Worker Rating & Feedback</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff', lineHeight: '1' }}>{profile.averageRating.toFixed(1)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', color: '#fbbf24', fontSize: '18px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star}>{star <= Math.round(profile.averageRating) ? '★' : '☆'}</span>
                  ))}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Based on {profile.totalReviews} reviews</span>
              </div>
            </div>
            {recentReviews.length > 0 && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Recent Feedback</span>
                {recentReviews.slice(0, 3).map(review => (
                  <div key={review._id} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{review.customer?.name || 'Customer'}</span>
                      <span style={{ color: '#fbbf24', fontSize: '12px' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                    </div>
                    {review.feedback && <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>"{review.feedback}"</p>}
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '20px' }}>
          <span className="form-label">Registered Skills</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            {(Array.isArray(profile?.skills) && profile.skills.length > 0 ? profile.skills : WORKER_SERVICE_OPTIONS)
              .filter(Boolean)
              .map((s) => (
                <StatusBadge key={s} status="info" label={s} />
              ))}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px' }}>
            These are the service categories available to customers on signup and in your worker dashboard.
          </p>
        </div>

        {isContractorUser && (
          <div style={{ marginTop: '20px' }}>
            <span className="form-label">Contractor Profile</span>
            <div className="worker-profile-grid" style={{ marginTop: '10px' }}>
              <div>
                <span className="form-label">Company</span>
                <p className="worker-profile-value">{profile.contractorProfile?.companyName || 'Not provided'}</p>
              </div>
              <div>
                <span className="form-label">Specialization</span>
                <p className="worker-profile-value">{profile.contractorProfile?.specialization || 'Not provided'}</p>
              </div>
              <div>
                <span className="form-label">Service Area</span>
                <p className="worker-profile-value">{profile.contractorProfile?.serviceArea || 'Not provided'}</p>
              </div>
              <div>
                <span className="form-label">Status</span>
                <p className="worker-profile-value">{profile.contractorProfile?.status === 'approved' ? 'Approved' : profile.contractorProfile?.status === 'pending' ? 'Pending review' : profile.contractorProfile?.status === 'rejected' ? 'Rejected' : 'Not submitted'}</p>
              </div>
            </div>
          </div>
        )}

        {!isContractorUser && (
          <div style={{ marginTop: '30px', padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-grey)', borderRadius: '12px' }}>
            <h4 style={{ color: 'var(--primary-orange)', marginBottom: '16px' }}>Become a Contractor</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Register as a contractor to access large-scale construction projects and submit competitive bids.
            </p>
            {contractorError && <div style={{ color: 'var(--error-color)', fontSize: '13px', marginBottom: '16px' }}>{contractorError}</div>}
            {contractorSuccess && <div style={{ color: 'var(--success-color)', fontSize: '13px', marginBottom: '16px' }}>{contractorSuccess}</div>}
            <form onSubmit={handleContractorSubmit} style={{ display: 'grid', gap: '16px' }}>
              <div className="worker-mobile-stack">
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input type="text" className="form-input" value={contractorForm.companyName} onChange={e => setContractorForm({ ...contractorForm, companyName: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Experience (Years)</label>
                  <input type="number" className="form-input" value={contractorForm.experienceYears} onChange={e => setContractorForm({ ...contractorForm, experienceYears: e.target.value })} required />
                </div>
              </div>
              <div className="worker-mobile-stack">
                <div className="form-group">
                  <label className="form-label">Specialization</label>
                  <input type="text" className="form-input" placeholder="e.g. Structural, Plumbing" value={contractorForm.specialization} onChange={e => setContractorForm({ ...contractorForm, specialization: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <select className="form-input" value={contractorForm.city} onChange={e => setContractorForm({ ...contractorForm, city: e.target.value })} required>
                    <option value="">Select City</option>
                    {['Lahore', 'Karachi', 'Islamabad', 'Rahim Yar Khan', 'Multan', 'Faisalabad', 'Rawalpindi', 'Bahawalpur'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="worker-mobile-stack">
                <div className="form-group">
                  <label className="form-label">Residence Area</label>
                  <input type="text" className="form-input" placeholder="e.g. Clifton Block 5" value={contractorForm.residenceArea} onChange={e => setContractorForm({ ...contractorForm, residenceArea: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Exact Location / Address</label>
                  <input type="text" className="form-input" placeholder="Detailed address" value={contractorForm.exactLocation} onChange={e => setContractorForm({ ...contractorForm, exactLocation: e.target.value })} required />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={contractorLoading} style={{ justifySelf: 'start', padding: '10px 20px' }}>
                {contractorLoading ? 'Submitting...' : 'Submit Contractor Profile'}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
