import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ArrowIcon, RoofIcon } from "../components/Icons";
import { api } from "../lib/api";

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const project = useQuery({ queryKey: ["projects", projectId], queryFn: () => api.project(projectId!) });
  const deletion = useMutation({
    mutationFn: () => api.deleteProject(projectId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate("/projects");
    },
  });

  if (project.isPending) return <main className="workspace-page"><div className="form-page-skeleton" /></main>;
  if (project.isError) return <main className="workspace-page"><div className="query-error"><strong>Project not found.</strong><Link to="/projects">Return to projects</Link></div></main>;

  const loadedProject = project.data;
  const updated = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(loadedProject.updated_at));

  function confirmDelete() {
    if (window.confirm(`Delete “${loadedProject.name}”? This cannot be undone.`)) deletion.mutate();
  }

  return (
    <main className="workspace-page">
      <Link className="back-link" to="/projects">← All projects</Link>
      <header className="project-detail-heading">
        <div><h1>{loadedProject.name}</h1><p>{loadedProject.description || "No description has been added yet."}</p></div>
        <div className="detail-actions">
          <Link className="button button-secondary" to={`/projects/${projectId}/edit`}>Edit details</Link>
          <button className="button button-danger" type="button" onClick={confirmDelete} disabled={deletion.isPending}>{deletion.isPending ? "Deleting…" : "Delete"}</button>
        </div>
      </header>

      {deletion.isError && <div className="form-error" role="alert">The project could not be deleted. Please try again.</div>}

      <section className="project-overview-grid">
        <div className="content-panel survey-panel">
          <div className="panel-heading"><div><h2>Your measured roof starts here</h2></div><span className="status-badge">Not started</span></div>
          <div className="roof-placeholder">
            <RoofIcon />
            <p>Add the location and simple roof measurements before choosing a panel model.</p>
          </div>
          <Link className="button button-primary" to={`/projects/${projectId}/location`}>Set location and roof <ArrowIcon /></Link>
        </div>
        <aside className="content-panel detail-register">
          <h2>Project register</h2>
          <dl>
            <div><dt>Status</dt><dd>Setup</dd></div>
            <div><dt>Last updated</dt><dd>{updated}</dd></div>
            <div><dt>Project ID</dt><dd className="technical-id">{loadedProject.id.slice(0, 8)}</dd></div>
          </dl>
          <p className="estimate-note">Energy results will always be presented as estimates and include the assumptions used.</p>
        </aside>
      </section>
    </main>
  );
}
