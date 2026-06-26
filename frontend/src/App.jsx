import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { LogOut, Wrench, Shield, User, HardHat, Compass } from 'lucide-react';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import Home from './pages/public/Home';
import Auth from './pages/public/Auth';
import AdminAuth from './pages/public/AdminAuth';
import CustomerDashboard from './pages/candidate/CandidateDashboard';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

export const API_URL = 'http://localhost:5000';

function Navigation({ user, logout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="header">
      <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <Wrench size={24} />
        Skills<span>verse</span>
      </div>

      <nav className="nav-links">
        <Link to="/" className="nav-link">Home</Link>
        {user ? (
          <>
            {user.role === 'customer' && (
              <Link to="/customer" className="nav-link flex items-center gap-1">
                <Compass size={16} /> Customer Portal
              </Link>
            )}
            {user.role === 'worker' && (
              <Link to="/worker" className="nav-link flex items-center gap-1">
                <HardHat size={16} /> Worker Workspace
              </Link>
            )}
            {user.role === 'admin' && (
              <Link to="/admin" className="nav-link flex items-center gap-1">
                <Shield size={16} /> Admin panel
              </Link>
            )}
            <div className="nav-link flex items-center gap-1" style={{ color: '#fff', fontWeight: 600 }}>
              <User size={16} style={{ color: 'var(--primary-orange)' }} /> {user.name}
            </div>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
              <LogOut size={14} /> Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/admin/login" className="nav-link nav-link--admin flex items-center gap-1">
              <Shield size={16} /> Admin
            </Link>
            <Link to="/auth" className="btn btn-primary" style={{ padding: '8px 16px' }}>
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
                <Route path="/auth" element={<Auth login={login} />} />
                <Route path="/admin/login" element={<AdminAuth login={login} />} />
                <Route path="/customer" element={<CustomerDashboard user={user} />} />
                <Route path="/complaints" element={<Navigate to="/customer" state={{ activeTab: 'complaints' }} replace />} />
                <Route path="/worker" element={<WorkerDashboard user={user} />} />
                <Route path="/admin" element={<AdminDashboard user={user} />} />
              </Routes>
            </main>
          </div>
        </Router>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
