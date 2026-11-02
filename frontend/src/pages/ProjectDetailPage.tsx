import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ArrowIcon, RoofIcon } from "../components/Icons";
import { api, ApiError } from "../lib/api";

const compassDirections = [
  "North",
  "North-east",
  "East",
  "South-east",
  "South",
  "South-west",
  "West",
  "North-west",
];

function compassDirection(azimuth: number) {
  return compassDirections[Math.round(azimuth / 45) % compassDirections.length];
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const project = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => api.project(projectId!),
    enabled: Boolean(projectId),
  });
  const roof = useQuery({
    queryKey: ["projects", projectId, "roof"],
    queryFn: async () => {
      try {
        return await api.roofConfiguration(projectId!);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 404) return null;
        throw caught;
      }
    },
    enabled: Boolean(projectId),
  });
  const deletion = useMutation({
    mutationFn: () => api.deleteProject(projectId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate("/projects");
    },
  });

  if (project.isPending || roof.isPending) return <main className="workspace-page"><div className="form-page-skeleton" /></main>;
  if (project.isError) return <main className="workspace-page"><div className="query-error"><strong>Project not found.</strong><Link to="/projects">Return to projects</Link></div></main>;

  const loadedProject = project.data;
  const roofConfiguration = roof.data ?? null;
  const lastUpdated = roofConfiguration && roofConfiguration.updated_at > loadedProject.updated_at
    ? roofConfiguration.updated_at
    : loadedProject.updated_at;
  const updated = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastUpdated));

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
          {roof.isError ? (
            <div className="query-error">
              <div><strong>Roof setup could not be loaded.</strong><p>Your saved data has not been changed.</p></div>
              <button className="button button-secondary" type="button" onClick={() => roof.refetch()}>Try again</button>
            </div>
          ) : roofConfiguration ? (
            <>
              <div className="panel-heading"><div><h2>Measured roof</h2></div><span className="status-badge status-complete">Roof configured</span></div>
              <div className="roof-summary">
                <div className="roof-summary-location">
                  <RoofIcon />
                  <div>
                    <strong>{roofConfiguration.location_label || "Selected roof location"}</strong>
                    <small>{roofConfiguration.lat.toFixed(5)}, {roofConfiguration.lon.toFixed(5)}</small>
                  </div>
                </div>
                <dl className="roof-measurements">
                  <div><dt>Usable plane</dt><dd>{roofConfiguration.width_m} × {roofConfiguration.length_m} m</dd></div>
                  <div><dt>Roof tilt</dt><dd>{roofConfiguration.tilt_deg}°</dd></div>
                  <div><dt>Orientation</dt><dd>{roofConfiguration.azimuth_deg}° · {compassDirection(roofConfiguration.azimuth_deg)}</dd></div>
                  <div><dt>Edge margin</dt><dd>{roofConfiguration.edge_margin_m} m</dd></div>
                </dl>
              </div>
              <Link className="button button-secondary" to={`/projects/${projectId}/location`}>Review roof setup <ArrowIcon /></Link>
            </>
          ) : (
            <>
              <div className="panel-heading"><div><h2>Your measured roof starts here</h2></div><span className="status-badge">Not started</span></div>
              <div className="roof-placeholder">
                <RoofIcon />
                <p>Add the location and simple roof measurements before choosing a panel model.</p>
              </div>
              <Link className="button button-primary" to={`/projects/${projectId}/location`}>Set location and roof <ArrowIcon /></Link>
            </>
          )}
        </div>
        <aside className="content-panel detail-register">
          <h2>Project register</h2>
          <dl>
            <div><dt>Status</dt><dd>Draft</dd></div>
            <div><dt>Roof step</dt><dd>{roof.isError ? "Unavailable" : roofConfiguration ? "Configured" : "Not started"}</dd></div>
            <div><dt>Last updated</dt><dd>{updated}</dd></div>
            <div><dt>Project ID</dt><dd className="technical-id">{loadedProject.id.slice(0, 8)}</dd></div>
          </dl>
          <p className="estimate-note">Energy results will always be presented as estimates and include the assumptions used.</p>
        </aside>
      </section>
    </main>
  );
}
