import { Link, useParams } from "react-router-dom";

export function ProjectLocationPage() {
  const { projectId } = useParams();
  return (
    <main className="workspace-page narrow-page">
      <Link className="back-link" to={`/projects/${projectId}`}>← Project overview</Link>
      <header className="form-page-heading"><h1>Location and roof setup</h1><p>This route is ready for the map and roof form. We will connect it when we implement the roof-configuration backend endpoint.</p></header>
      <section className="content-panel coming-soon-panel"><strong>Why this screen stops here</strong><p>The current backend stores project basics but does not yet expose the roof configuration API. Keeping this honest placeholder prevents the frontend from inventing or losing roof data.</p></section>
    </main>
  );
}
