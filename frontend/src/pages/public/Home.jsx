import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Hammer,
  Zap,
  CheckCircle,
  MapPin,
  Shield,
  CreditCard,
  ArrowRight,
  Mic,
  Users,
  HardHat,
  Wrench,
} from 'lucide-react';

const STATS = [
  { value: '500+', label: 'Verified workers' },
  { value: '24/7', label: 'On-demand dispatch' },
  { value: 'PKR', label: 'Secure escrow payments' },
  { value: '3 min', label: 'Avg. match time' },
];

const STEPS = [
  {
    step: '01',
    icon: Mic,
    title: 'Describe your need',
    description: 'Choose a service category, add details by text or voice, and share your location.',
  },
  {
    step: '02',
    icon: MapPin,
    title: 'Get matched instantly',
    description: 'We dispatch the nearest available skilled worker based on GPS and category.',
  },
  {
    step: '03',
    icon: CreditCard,
    title: 'Pay with confidence',
    description: 'Funds are held in escrow and released only when you are satisfied with the work.',
  },
];

const SERVICES = [
  {
    id: 'daily',
    icon: Zap,
    title: 'Daily Services',
    subtitle: 'Instant home repairs',
    description:
      'Plumbing, electrical, cleaning, appliance repair, and pest control — matched to the nearest online technician in minutes.',
    tags: ['Plumbing', 'Electrical', 'Cleaning', 'Live GPS'],
    accent: 'primary',
    cta: 'Book a service',
  },
  {
    id: 'construction',
    icon: Hammer,
    title: 'Construction Projects',
    subtitle: 'Large-scale work',
    description:
      'Renovations, structural work, painting, masonry, and woodwork. Submit your scope and get a certified contractor assigned by admin.',
    tags: ['Structural', 'Paint', 'Masonry', 'Admin-reviewed'],
    accent: 'success',
    cta: 'Submit a project',
  },
];

const FEATURES = [
  {
    icon: Shield,
    title: 'Admin-verified workers',
    description: 'Every worker is reviewed and approved before receiving job requests on the platform.',
  },
  {
    icon: MapPin,
    title: 'Real-time tracking',
    description: 'Follow your assigned worker on a live map from dispatch through job completion.',
  },
  {
    icon: CreditCard,
    title: 'Escrow protection',
    description: 'Payments are secured in escrow with a clear release workflow and dispute handling.',
  },
  {
    icon: Users,
    title: 'In-app communication',
    description: 'Chat with your worker via text or voice messages throughout the service.',
  },
];

export default function Home({ user }) {
  const navigate = useNavigate();

  const handleService = (target) => {
    if (!user) {
      navigate('/auth', { state: { redirectTo: target } });
    } else {
      navigate('/customer', { state: { activeTab: target } });
    }
  };

  const handleGetStarted = () => {
    navigate(user ? '/customer' : '/auth');
  };

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="home-hero-section">
        <div className="home-hero-section__glow" aria-hidden="true" />
        <div className="home-hero-section__inner">
          <p className="home-eyebrow">
            <Wrench size={14} />
            Pakistan&apos;s on-demand services marketplace
          </p>
          <h1 className="home-hero-title">
            Trusted home repairs &amp; construction,
            <span className="home-hero-title__accent"> delivered on demand</span>
          </h1>
          <p className="home-hero-lead">
            Skillsverse connects homeowners with verified technicians and contractors.
            Book instantly, track live, and pay securely through escrow.
          </p>
          <div className="home-hero-actions">
            <button type="button" onClick={() => handleService('daily')} className="btn btn-primary btn-lg">
              Book daily service
              <ArrowRight size={18} />
            </button>
            <button type="button" onClick={() => handleService('construction')} className="btn btn-secondary btn-lg">
              Post construction project
            </button>
          </div>
          {!user && (
            <p className="home-hero-note">
              Are you a skilled worker?{' '}
              <Link to="/auth" className="home-inline-link">Join as a worker</Link>
            </p>
          )}
        </div>

        <div className="home-stats">
          {STATS.map(({ value, label }) => (
            <div key={label} className="home-stat">
              <span className="home-stat__value">{value}</span>
              <span className="home-stat__label">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="home-section">
        <div className="home-section__header">
          <p className="home-section__eyebrow">How it works</p>
          <h2 className="home-section__title">From request to completion in three steps</h2>
          <p className="home-section__subtitle">
            A streamlined workflow built for speed, transparency, and trust.
          </p>
        </div>
        <div className="home-steps">
          {STEPS.map(({ step, icon: Icon, title, description }) => (
            <article key={step} className="home-step-card">
              <span className="home-step-card__number">{step}</span>
              <div className="home-step-card__icon">
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="home-section">
        <div className="home-section__header">
          <p className="home-section__eyebrow">Our services</p>
          <h2 className="home-section__title">Choose the right service for your needs</h2>
        </div>
        <div className="home-services-grid">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <article
                key={service.id}
                className={`home-service-card home-service-card--${service.accent}`}
                onClick={() => handleService(service.id)}
                onKeyDown={(e) => e.key === 'Enter' && handleService(service.id)}
                role="button"
                tabIndex={0}
              >
                <div className="home-service-card__top">
                  <div className="home-service-card__icon">
                    <Icon size={26} />
                  </div>
                  <div>
                    <p className="home-service-card__subtitle">{service.subtitle}</p>
                    <h3>{service.title}</h3>
                  </div>
                </div>
                <p className="home-service-card__desc">{service.description}</p>
                <div className="home-service-card__tags">
                  {service.tags.map((tag) => (
                    <span key={tag} className="home-tag">{tag}</span>
                  ))}
                </div>
                <span className="home-service-card__cta">
                  {service.cta} <ArrowRight size={16} />
                </span>
              </article>
            );
          })}
        </div>
      </section>

      {/* Features */}
      <section className="home-section home-section--muted">
        <div className="home-section__header">
          <p className="home-section__eyebrow">Why Skillsverse</p>
          <h2 className="home-section__title">Built for quality, speed, and peace of mind</h2>
        </div>
        <div className="home-features-grid">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <article key={title} className="home-feature-card">
              <div className="home-feature-card__icon">
                <Icon size={22} />
              </div>
              <h4>{title}</h4>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="home-section">
        <div className="home-roles">
          <div className="home-role-card">
            <Users size={24} />
            <div>
              <h4>For customers</h4>
              <p>Book services, track workers, and manage payments from one dashboard.</p>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleGetStarted}>
              Get started
            </button>
          </div>
          <div className="home-role-card">
            <HardHat size={24} />
            <div>
              <h4>For workers</h4>
              <p>Register your skills, go online, and receive nearby job requests in real time.</p>
            </div>
            <Link to="/auth" className="btn btn-secondary btn-sm">
              Join as worker
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="home-cta">
        <div className="home-cta__content">
          <h2>Ready to get started?</h2>
          <p>Join thousands of customers and skilled workers on Skillsverse today.</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={handleGetStarted}>
            Create free account
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}
