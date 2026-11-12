import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ArrowIcon } from "../components/Icons";
import { api, ApiError } from "../lib/api";

export function ProjectDetailPage() {
  const { projectId } = useParams(); const navigate = useNavigate(); const qc = useQueryClient();
  const project = useQuery({ queryKey: ["projects", projectId], queryFn: () => api.project(projectId!) });
  const location = useQuery({ queryKey: ["projects", projectId, "location"], queryFn: async () => { try { return await api.projectLocation(projectId!); } catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; } } });
  const surfaces = useQuery({ queryKey: ["projects", projectId, "roof-surfaces"], queryFn: () => api.roofSurfaces(projectId!) });
  const deletion = useMutation({ mutationFn: () => api.deleteProject(projectId!), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["projects"] }); navigate("/projects"); } });
  if (project.isPending || location.isPending || surfaces.isPending) return <main className="workspace-page"><div className="form-page-skeleton" role="status"><span className="sr-only">Loading project overview…</span></div></main>;
  if (project.isError || location.isError || surfaces.isError) return <main className="workspace-page"><Link className="back-link" to="/projects">← All projects</Link><div className="query-error" role="alert"><p>Project overview could not be loaded. Please try again.</p><button className="button button-secondary" onClick={() => { project.refetch(); location.refetch(); surfaces.refetch(); }}>Try again</button></div></main>;
  if (!project.data) return <main className="workspace-page"><div className="query-error">Project not found.</div></main>;
  const totalPanels = (surfaces.data ?? []).reduce((sum, item) => sum + (item.panel_layout?.panel_count ?? 0), 0);
  const totalKwp = (surfaces.data ?? []).reduce((sum, item) => sum + (item.panel_layout?.installed_kwp ?? 0), 0);
  const sharedPanel = (surfaces.data ?? []).find((item) => item.panel_layout)?.panel_layout?.solar_panel;
  const analysisReady = Boolean(surfaces.data?.length) && surfaces.data!.every((item) => item.panel_layout);
  const label = location.data?.location_label || "Selected project location";
  const locationParts = label.split(",").map((part) => part.trim()).filter(Boolean);
  const shortLocation = locationParts.length > 4 ? [...locationParts.slice(0, 2), ...locationParts.slice(-2)].join(", ") : label;
  return <main className="workspace-page project-overview-page">
    <Link className="back-link" to="/projects">← All projects</Link>
    <header className="project-detail-heading overview-heading"><div><div className="overview-title"><h1>{project.data.name}</h1><span className={`status-badge ${project.data.status === "analyzed" ? "status-complete" : ""}`}>{project.data.status === "analyzed" ? "Analyzed" : "Draft"}</span></div><p>{project.data.description || "No description has been added yet."}</p></div><div className="detail-actions"><Link className="button button-secondary" to={`/projects/${projectId}/edit`}>Edit details</Link><button type="button" className="button button-danger" disabled={deletion.isPending} onClick={() => window.confirm(`Delete ${project.data.name}?`) && deletion.mutate()}>{deletion.isPending ? "Deleting…" : "Delete project"}</button></div></header>
    {deletion.isError && <p className="form-error" role="alert">{deletion.error instanceof Error ? deletion.error.message : "Project could not be deleted. Please try again."}</p>}
    <section className="content-panel overview-summary" aria-labelledby="overview-summary-title"><h2 id="overview-summary-title">Project summary</h2>
      <div className="overview-location"><div><span>Project location</span><strong title={location.data ? label : undefined}>{location.data ? shortLocation : "Location not set"}</strong></div><Link to={`/projects/${projectId}/location`}>{location.data ? "Edit location" : "Set project location"}</Link></div>
      <dl className="overview-stats"><div><dt>Roof surfaces</dt><dd>{surfaces.data?.length ?? 0}</dd></div><div><dt>Solar panels</dt><dd>{totalPanels}</dd></div><div><dt>Installed capacity</dt><dd>{totalKwp.toFixed(2)} <small>kWp</small></dd></div></dl>
      <p className="overview-module"><span>Selected solar panel</span><strong>{sharedPanel ? `${sharedPanel.manufacturer} ${sharedPanel.model_sku}` : "Not selected yet"}</strong></p>
    </section>
    {location.data ? <>
      <section className="overview-main-actions" aria-labelledby="overview-actions-title"><h2 id="overview-actions-title">Main project actions</h2><div className="overview-action-grid">
        <Link className="overview-action" to={`/projects/${projectId}/roof-surfaces`}><strong>Manage roof surfaces <ArrowIcon /></strong><span>Manage roof geometry and panel layouts.</span><small>{surfaces.data?.length ? `${surfaces.data.filter((surface) => surface.panel_layout).length} of ${surfaces.data.length} layouts saved` : "No roof surfaces yet"}</small></Link>
        <Link className="overview-action" to={`/projects/${projectId}/consumption`}><strong>Energy consumption <ArrowIcon /></strong><span>Enter electricity usage for comparison.</span></Link>
      </div><div className="overview-production"><div><h3>Production analysis</h3><p>{analysisReady ? "Review estimated monthly and annual solar production." : "Save a panel layout for every roof surface to enable analysis."}</p></div>{analysisReady ? <Link className="button button-primary" to={`/projects/${projectId}/analysis`}>View production analysis <ArrowIcon /></Link> : <button className="button button-primary" disabled>View production analysis</button>}</div></section>
      {(analysisReady || project.data.status === "analyzed") && <section className="overview-additional"><h2>Additional analysis</h2><div>{analysisReady && <Link to={`/projects/${projectId}/optimizer`}>Compare configurations <ArrowIcon /></Link>}{project.data.status === "analyzed" && <Link to={`/projects/${projectId}/simulations`}>Simulation history <ArrowIcon /></Link>}</div></section>}
    </> : <p className="overview-setup-note">Set the project location to continue with roof surfaces and energy planning.</p>}
  </main>;
}
