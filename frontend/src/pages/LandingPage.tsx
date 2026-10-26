import { Link, Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Brand } from "../components/Brand";
import { ArrowIcon, RoofIcon } from "../components/Icons";

export function LandingPage() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <main className="landing">
      <header className="public-header">
        <Brand />
        <nav aria-label="Public navigation">
          <Link className="text-link" to="/login">Log in</Link>
          <Link className="button button-primary button-small" to="/register">Create account</Link>
        </nav>
      </header>
      <section className="landing-hero">
        <div className="hero-copy">
          <h1>Understand what solar could mean for your roof.</h1>
          <p>
            Plan with real panel specifications, a roof-aware layout, and transparent energy
            estimates — explained one decision at a time.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/register">Start a solar project <ArrowIcon /></Link>
            <span>No pricing promises. No hidden assumptions.</span>
          </div>
        </div>
        <div className="roof-survey" aria-label="Illustration of a measured residential roof">
          <div className="survey-heading">
            <span>Roof survey preview</span>
            <strong>South-east · 31°</strong>
          </div>
          <div className="roof-plane">
            <div className="panel-grid">
              {Array.from({ length: 12 }, (_, index) => <span key={index} />)}
            </div>
            <span className="measure measure-width">8.4 m</span>
            <span className="measure measure-height">6.2 m</span>
          </div>
          <div className="survey-data">
            <span><small>Estimated capacity</small><strong>5.4 kWp</strong></span>
            <span><small>Panel fit</small><strong>12 modules</strong></span>
            <span><small>Next</small><strong>Energy analysis</strong></span>
          </div>
        </div>
      </section>
      <section className="landing-principles" aria-label="How SolarPlan works">
        <article><span>01</span><h2>Describe your roof</h2><p>Choose a location and enter simple dimensions, tilt, and orientation.</p></article>
        <article><span>02</span><h2>Compare real panels</h2><p>See which documented models fit and how their technical differences matter.</p></article>
        <article><span>03</span><h2>Read the energy story</h2><p>Compare estimated production with consumption using clear units and assumptions.</p></article>
      </section>
      <footer className="landing-note"><RoofIcon /><p>SolarPlan provides preliminary energy estimates, not an official engineering assessment.</p></footer>
    </main>
  );
}
