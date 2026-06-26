import { useState, useRef } from 'react';

export default function ComplaintModal({ job, token, onClose, onSuccess }) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('Please enter a complaint title.'); return; }
    if (!details.trim() || details.length < 20) { setError('Please provide at least 20 characters of details.'); return; }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('jobId', job._id);
      formData.append('title', title);
      formData.append('details', details);
      formData.append('category', job.category || '');
      if (evidence) formData.append('evidence', evidence);

      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      onSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="complaint-modal" onClick={e => e.stopPropagation()}>
        <div className="complaint-modal__header">
          <h2>🚩 File a Complaint</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {job && (
          <div className="complaint-modal__job-ref">
            <span className="pill pill--red">{job.category}</span>
            <span className="text-muted">Job #{job._id?.slice(-6)}</span>
            {job.worker?.name && <span>Worker: <strong>{job.worker.name}</strong></span>}
          </div>
        )}

        <form onSubmit={handleSubmit} className="complaint-form">
          <div className="form-group">
            <label htmlFor="c-title">Complaint Title *</label>
            <input
              id="c-title"
              type="text"
              placeholder="Brief title of the issue"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="c-details">Details *</label>
            <textarea
              id="c-details"
              rows={5}
              placeholder="Describe the problem in detail (minimum 20 characters)…"
              value={details}
              onChange={e => setDetails(e.target.value)}
              required
            />
            <span className="form-hint">{details.length} / 20+ characters</span>
          </div>

          <div className="form-group">
            <label>Evidence (Photo/Video/Document) — Optional</label>
            <div
              className="evidence-drop-zone"
              onClick={() => fileRef.current?.click()}
            >
              {evidence
                ? <><span className="ev-icon">📎</span><span>{evidence.name}</span></>
                : <><span className="ev-icon">⬆️</span><span>Click to upload evidence</span></>
              }
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,.pdf"
              style={{ display: 'none' }}
              onChange={e => setEvidence(e.target.files[0] || null)}
            />
          </div>

          {error && <div className="pm-error">{error}</div>}

          <div className="complaint-notice">
            ⚠️ Once submitted, the payment for this job will be placed <strong>under review</strong> and held until admin resolves the dispute.
          </div>

          <div className="complaint-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-danger" disabled={loading}>
              {loading ? '⏳ Submitting…' : '🚩 Submit Complaint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
