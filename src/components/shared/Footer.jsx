import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, Wrench, ArrowRight } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <div className="site-footer__logo">
            <Wrench size={20} />
            Skills<span>verse</span>
          </div>
          <p>
            Skillsverse helps customers connect with trusted workers and contractors while giving skilled professionals more visibility and opportunities.
          </p>
        </div>

        <div className="site-footer__links">
          <div>
            <h4>Explore</h4>
            <Link to="/">Home</Link>
            <Link to="/about">About us</Link>
            <Link to="/auth">Get started</Link>
          </div>
          <div>
            <h4>Contact</h4>
            <a href="mailto:hello@skillsverse.com">
              <Mail size={15} /> hello@skillsverse.com
            </a>
            <a href="tel:+923001112233">
              <Phone size={15} /> +92 300 111 2233
            </a>
            <span>
              <MapPin size={15} /> Karachi, Pakistan
            </span>
          </div>
        </div>
      </div>

      <div className="site-footer__bottom">
        <p>© 2026 Skillsverse. Built for trusted local services.</p>
        <Link to="/about" className="site-footer__cta">
          Meet the founders <ArrowRight size={16} />
        </Link>
      </div>
    </footer>
  );
}
