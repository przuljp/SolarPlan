import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { ArrowIcon, PlusIcon } from "../components/Icons";
import { ProjectList } from "../components/ProjectList";
import { api } from "../lib/api";

export function DashboardPage() {
  const { user } = useAuth();
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const firstName = user?.full_name.split(" ")[0];

  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <div>
          <h1>Good to see you, {firstName}.</h1>
          <p>Continue a roof assessment or begin a new project.</p>
        </div>
        <Link className="button button-primary" to="/projects/new"><PlusIcon />New project</Link>
      </header>

      <section className="dashboard-grid">
        <div className="content-panel project-panel">
          <div className="panel-heading">
            <div><h2>Your projects</h2><p>Private workspaces for each property you assess.</p></div>
            {projects.data && projects.data.length > 0 && <Link className="text-link" to="/projects">View all</Link>}
          </div>
          {projects.isPending && <ProjectListSkeleton />}
          {projects.isError && <QueryError onRetry={() => projects.refetch()} />}
          {projects.data && <ProjectList projects={projects.data.slice(0, 4)} />}
        </div>

        <aside className="content-panel guide-panel">
          <div className="guide-roof" aria-hidden="true">
            <span /><span /><span /><span /><span /><span />
          </div>
          <h2>From a real roof to an understandable estimate.</h2>
          <ol>
            <li><span>1</span><div><strong>Locate the property</strong><small>Set the coordinates that shape the energy estimate.</small></div></li>
            <li><span>2</span><div><strong>Describe the roof</strong><small>Add usable dimensions, tilt, and orientation.</small></div></li>
            <li><span>3</span><div><strong>Compare configurations</strong><small>Review panel fit and estimated production.</small></div></li>
          </ol>
          <Link className="guide-link" to="/projects/new">Start with a project <ArrowIcon /></Link>
        </aside>
      </section>
    </main>
  );
}

export function ProjectListSkeleton() {
  return (
    <div className="skeleton-list" role="status" aria-live="polite">
      <span className="sr-only">Loading projects…</span>
      {Array.from({ length: 3 }, (_, i) => <span aria-hidden="true" key={i} />)}
    </div>
  );
}

export function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="query-error" role="alert">
      <div><strong>We could not load your projects.</strong><p>Check that the SolarPlan API is running, then try again.</p></div>
      <button className="button button-secondary button-small" type="button" onClick={onRetry}>Try again</button>
    </div>
  );
}
