import { Route, Routes } from "react-router-dom";

function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Residential solar planning</p>
        <h1 id="hero-title">Plan a solar system around your actual roof.</h1>
        <p className="hero-copy">
          SolarPlan will combine verified panel specifications, roof layout, PVGIS energy
          estimates, and household consumption in one transparent analysis.
        </p>
        <div className="status-card">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <strong>Development foundation ready</strong>
            <p>Frontend, API, database configuration, and local containers are prepared.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  );
}

