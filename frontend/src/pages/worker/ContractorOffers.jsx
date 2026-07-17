import React from 'react';
import { Briefcase } from 'lucide-react';
import Pagination from '../../components/shared/Pagination';
import './ContractorOffers.css';

export default function ContractorOffers({
  profile,
  filteredContractorOffers,
  contractorCityFilter,
  setContractorCityFilter,
  constructionPage,
  setConstructionPage,
  itemsPerPage,
  selectedBidJob,
  setSelectedBidJob,
  bidForm,
  setBidForm,
  handleBidSubmit,
  handleConstructionResponse
}) {
  const getPaginatedItems = (items, page) => items.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const getTotalPages = (items) => Math.max(1, Math.ceil(items.length / itemsPerPage));

  const visibleOffers = getPaginatedItems(filteredContractorOffers, constructionPage);
  const totalPages = getTotalPages(filteredContractorOffers);

  return (
    <div className="card card--padded">
      <div className="section-header">
        <Briefcase size={20} color="var(--primary-orange)" />
        <div className="section-header__text">
          <h3>Contractor Offers</h3>
          <p>Contractor opportunities and profile review updates appear here.</p>
        </div>
      </div>
      <div className="worker-profile-grid">
        <div>
          <span className="form-label">Current contractor status</span>
          <p className="worker-profile-value">{profile.contractorProfile?.status === 'approved' ? 'Approved for contractor projects' : profile.contractorProfile?.status === 'pending' ? 'Pending admin review' : profile.contractorProfile?.status === 'rejected' ? 'Rejected by admin' : 'Profile not submitted'}</p>
        </div>
        <div>
          <span className="form-label">Service area</span>
          <p className="worker-profile-value">{profile.contractorProfile?.serviceArea || 'Not provided yet'}</p>
        </div>
        <div>
          <span className="form-label">Available opportunities</span>
          <p className="worker-profile-value">{filteredContractorOffers.length > 0 ? `${filteredContractorOffers.length} offer${filteredContractorOffers.length > 1 ? 's' : ''} available` : 'No contractor offers yet'}</p>
        </div>
      </div>

      <div className="worker-dashboard-filter-row" style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Search projects by city
          </label>
          <input
            type="text"
            value={contractorCityFilter}
            onChange={(e) => {
              setContractorCityFilter(e.target.value);
              setConstructionPage(1);
            }}
            placeholder="Type city or neighborhood"
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-grey)', borderRadius: '8px', padding: '10px 12px', color: '#f5f5f7', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>
        <div className="worker-dashboard-filter-hint" style={{ minWidth: '220px', color: 'var(--text-secondary)', fontSize: '13px' }}>
          {contractorCityFilter.trim()
            ? `Filtering offers by city: "${contractorCityFilter.trim()}"`
            : 'Showing all contractor offers.'}
        </div>
      </div>

      {filteredContractorOffers.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>No contractor offers available at this time.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
          {visibleOffers.map((job) => (
            <div key={job._id} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-grey)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '16px', marginBottom: '4px' }}>{job.title || job.category}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{job.category}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer</span>
                  <p style={{ fontSize: '13px', color: '#fff' }}>{job.customer?.name || 'Unknown'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Budget</span>
                  <p style={{ fontSize: '13px', color: '#fff' }}>{job.paymentAmount ? `PKR ${Number(job.paymentAmount).toLocaleString()}` : 'Not specified'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Location</span>
                  <p style={{ fontSize: '13px', color: '#fff' }}>{job.location?.city || 'Not specified'}</p>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>{job.description}</p>

              <button
                onClick={() => {
                  setSelectedBidJob(job);
                  setBidForm({ bidAmount: '', completionDays: '', notes: '' });
                }}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                Submit Bid
              </button>
            </div>
          ))}

          <Pagination
            page={constructionPage}
            totalPages={totalPages}
            totalItems={filteredContractorOffers.length}
            pageSize={itemsPerPage}
            onPageChange={setConstructionPage}
            itemLabel="offers"
          />
        </div>
      )}

      {/* Bid Modal */}
      {selectedBidJob && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.85)', zIndex: 10001,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>Submit Bid for {selectedBidJob.title}</h3>
            <form onSubmit={handleBidSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Bid Amount (PKR)</label>
                <input
                  type="number"
                  className="form-input"
                  value={bidForm.bidAmount}
                  onChange={(e) => setBidForm({ ...bidForm, bidAmount: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Estimated Completion (Days)</label>
                <input
                  type="number"
                  className="form-input"
                  value={bidForm.completionDays}
                  onChange={(e) => setBidForm({ ...bidForm, completionDays: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  value={bidForm.notes}
                  onChange={(e) => setBidForm({ ...bidForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setSelectedBidJob(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Submit Bid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
