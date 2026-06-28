import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { LogOut, Wrench, Shield, User, HardHat, Compass, Menu, X, Building2 } from 'lucide-react';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import Home from './pages/public/Home';
import Auth from './pages/public/Auth';
import About from './pages/public/About';
import AdminAuth from './pages/public/AdminAuth';
import CustomerDashboard from './pages/candidate/CandidateDashboard';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import Footer from './components/shared/Footer';

export const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

function Navigation({ user, logout }) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  return (
    <header className="header">
      <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <Wrench size={24} />
        Skills<span>verse</span>
      </div>

      <button 
        className="mobile-menu-toggle" 
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <nav className={`nav-links ${mobileMenuOpen ? 'nav-links--open' : ''}`}>
        <Link to="/" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Home</Link>
        <Link to="/about" className="nav-link" onClick={() => setMobileMenuOpen(false)}>About</Link>
        {user ? (
          <>
            {user.role === 'customer' && (
              <Link to="/customer" className="nav-link flex items-center gap-1" onClick={() => setMobileMenuOpen(false)}>
                <Compass size={16} /> Customer Portal
              </Link>
            )}
            {user.role === 'worker' && (
              <Link to="/worker" className="nav-link flex items-center gap-1" onClick={() => setMobileMenuOpen(false)}>
                {user.isContractor ? <Building2 size={16} /> : <HardHat size={16} />}
                {user.isContractor ? 'Contractor Workspace' : 'Worker Workspace'}
              </Link>
            )}
            {user.role === 'admin' && (
              <Link to="/admin" className="nav-link flex items-center gap-1" onClick={() => setMobileMenuOpen(false)}>
                <Shield size={16} /> Admin panel
              </Link>
            )}
            <div className="nav-link flex items-center gap-1" style={{ color: '#fff', fontWeight: 600 }}>
              <User size={16} style={{ color: 'var(--primary-orange)' }} /> {user.name}
              {user.isContractor && (
                <span style={{ fontSize: '11px', background: 'var(--primary-orange)', padding: '2px 8px', borderRadius: '4px', marginLeft: '8px' }}>Contractor</span>
              )}
            </div>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
              <LogOut size={14} /> Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/admin/login" className="nav-link nav-link--admin flex items-center gap-1" onClick={() => setMobileMenuOpen(false)}>
              <Shield size={16} /> Admin
            </Link>
            <Link to="/auth" className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={() => setMobileMenuOpen(false)}>
              Get Started
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-dark)' }}>
        <div style={{ color: 'var(--primary-orange)', fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 'bold' }}>
          Loading Skillsverse...
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <ConfirmProvider>
        <Router>
          <div className="app-container">
            <Navigation user={user} logout={logout} />
            <main className="app-main">
              <Routes>
                <Route path="/" element={<Home user={user} />} />
                <Route path="/about" element={<About />} />
                <Route path="/auth" element={<Auth login={login} />} />
                <Route path="/admin/login" element={<AdminAuth login={login} />} />
                <Route path="/customer" element={<CustomerDashboard user={user} />} />
                <Route path="/complaints" element={<Navigate to="/customer" state={{ activeTab: 'complaints' }} replace />} />
                <Route path="/worker" element={<WorkerDashboard user={user} />} />
                <Route path="/admin" element={<AdminDashboard user={user} />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
