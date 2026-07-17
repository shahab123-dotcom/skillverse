import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';
import {
  Wrench,
  Mail,
  MapPin,
  Phone,
  ArrowUpRight,
  Heart,
  Shield,
  Award,
  Users,
  Globe,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="site-footer">
      {/* Top decorative gradient line */}
      <div className="site-footer__accent" />

      <div className="site-footer__inner">
        {/* ─── Brand Column ─── */}
        <div className="site-footer__brand">
          <div className="site-footer__logo">
            <div className="site-footer__logo-icon">
              <Wrench size={22} />
            </div>
            <span>
              Skills<span>verse</span>
            </span>
          </div>
          <p className="site-footer__desc">
            Skillsverse helps customers connect with trusted workers and
            contractors while giving skilled professionals more visibility and
            opportunities.
          </p>

          {/* Social links */}
          <div className="site-footer__social">
            <a
              href="#"
              className="site-footer__social-link"
              aria-label="Twitter / X"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
                <path d="M4 20l6.768 -6.768m2.46 -2.46L20 4" />
              </svg>
            </a>
            <a
              href="#"
              className="site-footer__social-link"
              aria-label="GitHub"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </a>
            <a
              href="#"
              className="site-footer__social-link"
              aria-label="LinkedIn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect width="4" height="12" x="2" y="9" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
          </div>
        </div>

        {/* ─── Explore Column ─── */}
        <div className="site-footer__col">
          <h4 className="site-footer__col-title">Explore</h4>
          <nav className="site-footer__nav">
            <Link to="/">Home</Link>
            <Link to="/about">About us</Link>
            <Link to="/auth">Get started</Link>
            <Link to="/about">How it works</Link>
          </nav>
        </div>

        {/* ─── Services Column ─── */}
        <div className="site-footer__col">
          <h4 className="site-footer__col-title">Services</h4>
          <nav className="site-footer__nav">
            <span>Plumbing</span>
            <span>Electrical</span>
            <span>Construction</span>
            <span>Cleaning</span>
          </nav>
        </div>

        {/* ─── Contact Column ─── */}
        <div className="site-footer__col">
          <h4 className="site-footer__col-title">Contact</h4>
          <div className="site-footer__contact">
            <a href="mailto:hello@skillsverse.com">
              <Mail size={15} />
              hello@skillsverse.com
            </a>
            <a href="tel:+923001112233">
              <Phone size={15} />
              +92 300 111 2233
            </a>
            <span>
              <MapPin size={15} />
              Karachi, Pakistan
            </span>
          </div>
        </div>
      </div>

      {/* ─── Bottom Bar ─── */}
      <div className="site-footer__bottom">
        <div className="site-footer__bottom-inner">
          <p className="site-footer__copyright">
            &copy; {new Date().getFullYear()} Skillsverse. Built with{' '}
            <Heart size={12} className="site-footer__heart" /> for trusted local
            services.
          </p>

          <div className="site-footer__bottom-links">
            <Link to="/about" className="site-footer__cta">
              Meet the founders
              <ArrowUpRight size={15} />
            </Link>
            <button
              className="site-footer__back-to-top"
              onClick={scrollToTop}
              aria-label="Back to top"
            >
              Back to top ↑
            </button>
          </div>
        </div>
      </div>

      {/* ─── Trust Badges ─── */}
      <div className="site-footer__trust">
        <div className="site-footer__trust-item">
          <Shield size={14} />
          <span>Secure payments</span>
        </div>
        <div className="site-footer__trust-item">
          <Award size={14} />
          <span>Verified professionals</span>
        </div>
        <div className="site-footer__trust-item">
          <Users size={14} />
          <span>10K+ happy customers</span>
        </div>
      </div>
    </footer>
  );
}