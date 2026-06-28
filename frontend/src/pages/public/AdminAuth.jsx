import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Mail, Lock, ArrowLeft, Server, KeyRound, Activity } from 'lucide-react';
import { API_URL } from '../../App';

const ADMIN_FEATURES = [
  { icon: Server, text: 'Worker approvals & platform roster control' },
  { icon: Activity, text: 'Live escrow ledger & payment oversight' },
  { icon: KeyRound, text: 'Construction assignment & dispute resolution' },
];

export default function AdminAuth({ login }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const parseResponse = async (response) => {
    const bodyText = await response.text();
    if (!bodyText) return {};
    try {
      return JSON.parse(bodyText);
    } catch {
      return { error: bodyText.replace(/<[^>]*>/g, ' ').trim() || `Server error ${response.status}` };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'admin' }),
      });

      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      if (data.user.role !== 'admin') {
        throw new Error('This account does not have administrator privileges.');
      }

      login(data.token, data.user);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth-shell">
      <div className="admin-auth-grid-bg" aria-hidden="true" />

      <aside className="admin-auth-brand">
        <div className="admin-auth-brand__badge">
          <Shield size={28} />
        </div>
        <p className="admin-auth-brand__eyebrow">Restricted access</p>
        <h1 className="admin-auth-brand__title">Skillsverse Control Center</h1>
        <p className="admin-auth-brand__lead">
          Secure portal for platform administrators. Manage workers, escrow funds, construction assignments, and customer disputes.
        </p>
        <ul className="admin-auth-brand__list">
          {ADMIN_FEATURES.map(({ icon: Icon, text }) => (
            <li key={text}>
              <Icon size={16} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <p className="admin-auth-brand__notice">
          Unauthorized access is prohibited and monitored.
        </p>
      </aside>

      <main className="admin-auth-main">
        <Link to="/auth" className="admin-auth-back">
          <ArrowLeft size={16} />
          User login
        </Link>

        <div className="admin-auth-card">
          <header className="admin-auth-card__header">
            <div className="admin-auth-card__icon">
              <Shield size={22} />
            </div>
            <div>
              <h2>Administrator sign in</h2>
              <p>Enter your credentials to access the admin dashboard.</p>
            </div>
          </header>

          {error && (
            <div className="admin-auth-alert" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="admin-auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="admin-email">Admin email</label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input
                  id="admin-email"
                  type="email"
                  placeholder="admin@skillsverse.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input admin-auth-input"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-password">Password</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  id="admin-password"
                  type="password"
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input admin-auth-input"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn admin-auth-submit" disabled={loading}>
              {loading ? 'Verifying…' : 'Access control panel'}
            </button>
          </form>

          <p className="admin-auth-card__footer">
            Not an administrator?{' '}
            <Link to="/auth" className="admin-auth-link">Sign in as customer or worker</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
