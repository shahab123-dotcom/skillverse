import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { User, HardHat, Mail, Lock, Phone, Wrench, MapPin, CreditCard, ArrowLeft } from 'lucide-react';
import { API_URL } from '../../App';

const SKILLS_LIST = [
  'Plumbing', 'Electrical', 'Cleaning', 'Appliance Repair', 'Pest Control',
  'Structural', 'Paint', 'Masonry', 'Woodwork', 'Roofing',
];

const ROLE_OPTIONS = [
  {
    id: 'customer',
    label: 'Customer',
    description: 'Book repairs & track workers',
    icon: User,
    register: true,
    login: true,
  },
  {
    id: 'worker',
    label: 'Worker',
    description: 'Accept jobs & earn',
    icon: HardHat,
    register: true,
    login: true,
  },
];

const BRAND_FEATURES = [
  { icon: MapPin, text: 'Real-time GPS matching with nearby professionals' },
  { icon: CreditCard, text: 'Secure escrow payments with transparent pricing' },
  { icon: Wrench, text: 'Daily services and construction projects in one place' },
];

export default function Auth({ login }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [isLogin, setIsLogin] = useState(true);
  const [loginRole, setLoginRole] = useState('customer');
  const [registerRole, setRegisterRole] = useState('customer');
  const role = isLogin ? loginRole : registerRole;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedSkills, setSelectedSkills] = useState([]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const visibleRoles = ROLE_OPTIONS.filter((r) => (isLogin ? r.login : r.register));

  const handleSkillToggle = (skill) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const switchMode = (loginMode) => {
    setIsLogin(loginMode);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin
      ? { email, password, role }
      : {
          name,
          email,
          password,
          phone,
          role,
          skills: role === 'worker' ? selectedSkills : [],
        };

    console.log('Current mode:', isLogin ? 'LOGIN' : 'REGISTER');
    console.log('Current role state:', role);
    console.log('Submitting payload:', payload);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Something went wrong');

      if (isLogin) {
        login(data.token, data.user);
        if (data.user.role === 'customer') {
          navigate(location.state?.redirectTo || '/customer');
        } else if (data.user.role === 'worker') {
          navigate('/worker');
        }
      } else {
        setSuccess(data.message || 'Registration successful! Please sign in.');
        setIsLogin(true);
        setLoginRole(role);
        setName('');
        setPhone('');
        setPassword('');
        setSelectedSkills([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-brand" aria-hidden="false">
        <div className="auth-brand__glow" />
        <div className="auth-brand__content">
          <Link to="/" className="auth-brand__logo">
            <Wrench size={22} />
            Skills<span>verse</span>
          </Link>

          <h2 className="auth-brand__title">
            Your trusted marketplace for home services
          </h2>
          <p className="auth-brand__lead">
            Connect with verified workers, track jobs live, and pay securely through escrow.
          </p>

          <ul className="auth-brand__features">
            {BRAND_FEATURES.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span className="auth-brand__feature-icon">
                  <Icon size={18} />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="auth-main">
        <Link to="/" className="auth-back-link">
          <ArrowLeft size={16} />
          Back to home
        </Link>

        <div className="auth-card">
          <header className="auth-card__header">
            <p className="auth-card__eyebrow">Account access</p>
            <h1 className="auth-card__title">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="auth-card__subtitle">
              {isLogin
                ? 'Sign in to continue to your dashboard.'
                : 'Register to book services or join as a skilled worker.'}
            </p>
          </header>

          <div className="auth-mode-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={isLogin}
              className={`auth-mode-tab ${isLogin ? 'active' : ''}`}
              onClick={() => switchMode(true)}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isLogin}
              className={`auth-mode-tab ${!isLogin ? 'active' : ''}`}
              onClick={() => switchMode(false)}
            >
              Create account
            </button>
          </div>

          <div className="auth-section">
            <span className="form-label">I am a</span>
            <div className="auth-role-grid auth-role-grid--2">
              {visibleRoles.map(({ id, label, description, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`auth-role-card ${role === id ? 'active' : ''}`}
                  onClick={() => {
                    console.log('Selected role:', id);
                    if (isLogin) {
                      setLoginRole(id);
                    } else {
                      setRegisterRole(id);
                    }
                  }}
                >
                  <span className="auth-role-card__icon">
                    <Icon size={20} />
                  </span>
                  <span className="auth-role-card__label">{label}</span>
                  <span className="auth-role-card__desc">{description}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="auth-alert auth-alert--error" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="auth-alert auth-alert--success" role="status">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-name">Full name</label>
                <div className="input-with-icon">
                  <User size={16} className="input-icon" />
                  <input
                    id="auth-name"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="auth-email">Email address</label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input
                  id="auth-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {!isLogin && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-phone">Phone number</label>
                <div className="input-with-icon">
                  <Phone size={16} className="input-icon" />
                  <input
                    id="auth-phone"
                    type="tel"
                    placeholder="e.g. 03001234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="form-input"
                    autoComplete="tel"
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="auth-password">Password</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  id="auth-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                />
              </div>
            </div>

            {!isLogin && role === 'worker' && (
              <div className="form-group">
                <div className="auth-skills-header">
                  <label className="form-label">Your skills</label>
                  <span className="auth-skills-count">
                    {selectedSkills.length} selected
                  </span>
                </div>
                <div className="auth-skills-grid">
                  {SKILLS_LIST.map((skill) => {
                    const checked = selectedSkills.includes(skill);
                    return (
                      <label
                        key={skill}
                        className={`auth-skill-chip ${checked ? 'active' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleSkillToggle(skill)}
                        />
                        <span>{skill}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedSkills.length === 0 && (
                  <p className="auth-field-hint">Select at least one skill to receive job requests.</p>
                )}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary auth-submit-btn"
              disabled={loading || (!isLogin && role === 'worker' && selectedSkills.length === 0)}
            >
              {loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="auth-card__footer">
            {isLogin ? "Don't have an account?" : 'Already registered?'}{' '}
            <button
              type="button"
              className="auth-inline-link"
              onClick={() => switchMode(!isLogin)}
            >
              {isLogin ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
