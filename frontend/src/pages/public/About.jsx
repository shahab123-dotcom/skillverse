import './About.css';
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, BadgeCheck, Users, Compass, ShieldCheck } from 'lucide-react';

const FOUNDERS = [
  {
    name: 'Naeem Ullah Shahab',
    role: 'Founder',
    image: '/Founder.png',
    bio: 'Naeem Ullah Shahab is a builder of practical digital solutions with a strong focus on trust, reliability, and service quality. He envisions a platform where people can access skilled help quickly and confidently.',
    highlight: 'Focused on creating a dependable platform for everyday service needs.',
  },
  {
    name: 'Saqib Ali',
    role: 'Co-Founder',
    image: '/Co-Founder.jpg',
    bio: 'Saqib Ali brings a people-first perspective to the platform, ensuring that workers are empowered with better opportunities and customers receive professional support at every step.',
    highlight: 'Dedicated to helping workers grow through visibility, fair access, and better tools.',
  },
];

const VISION_POINTS = [
  {
    icon: Users,
    title: 'More opportunities for workers',
    text: 'We want every skilled worker to gain visibility, find meaningful work, and build a reliable income stream through a professional marketplace.',
  },
  {
    icon: Compass,
    title: 'Work made simpler',
    text: 'Our mission is to remove friction for both customers and workers by bringing booking, communication, tracking, and payments into one thoughtful experience.',
  },
  {
    icon: ShieldCheck,
    title: 'Professional and trustworthy service',
    text: 'We believe quality work should be easy to discover, easy to trust, and easy to deliver with confidence.',
  },
];

export default function About() {
  return (
    <div className="about-page">
      <section className="about-hero">
        <div className="about-hero__content">
          <p className="home-section__eyebrow">About Skillsverse</p>
          <h1>Built by founders who believe work should be easier, fairer, and more professional.</h1>
          <p>
            Skillsverse was created to connect customers with skilled professionals in a way that feels simple, transparent, and trustworthy.
          </p>
          <div className="about-hero__actions">
            <Link to="/auth" className="btn btn-primary btn-lg">
              Join the platform <ArrowRight size={18} />
            </Link>
            <Link to="/" className="btn btn-secondary btn-lg">
              Explore services
            </Link>
          </div>
        </div>

        <div className="about-hero__card">
          <div className="about-hero__icon">
            <Sparkles size={24} />
          </div>
          <h2>Our promise</h2>
          <p>
            We are creating a professional ecosystem where workers gain more opportunities and customers receive dependable support whenever they need it.
          </p>
        </div>
      </section>

      <section className="about-founders">
        <div className="home-section__header">
          <p className="home-section__eyebrow">Founders</p>
          <h2 className="home-section__title">Meet the people behind the mission</h2>
        </div>
        <div className="about-founders__grid">
          {FOUNDERS.map((founder) => (
            <article key={founder.name} className="about-founder-card">
              <div className="about-founder-card__image-wrapper">
                <img
                  src={founder.image}
                  alt={founder.name}
                  className="about-founder-card__image"
                />
                <div className="about-founder-card__badge">
                  <BadgeCheck size={16} />
                  {founder.role}
                </div>
              </div>
              <div className="about-founder-card__content">
                <h3>{founder.name}</h3>
                <p className="about-founder-card__bio">{founder.bio}</p>
                <p className="about-founder-card__highlight">{founder.highlight}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-vision">
        <div className="about-vision__content">
          <p className="home-section__eyebrow">Our vision</p>
          <h2>We want to make work easier for workers and open more opportunities for a stronger future.</h2>
          <p>
            Skillsverse is built with the belief that professional work should be accessible, organized, and rewarding. We are making it easier for workers to be discovered, trusted, and supported while helping customers find the right help without hassle.
          </p>
        </div>

        <div className="about-vision__grid">
          {VISION_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <article key={point.title} className="about-vision-card">
                <div className="about-vision-card__icon">
                  <Icon size={20} />
                </div>
                <h3>{point.title}</h3>
                <p>{point.text}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
