import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ArrowIcon, RoofIcon } from "../components/Icons";
import { api, ApiError } from "../lib/api";

export function ProjectDetailPage() {
  const { projectId } = useParams(); const navigate = useNavigate(); const qc = useQueryClient();
  const project = useQuery({ queryKey: ["projects", projectId], queryFn: () => api.project(projectId!) });
  const location = useQuery({ queryKey: ["projects", projectId, "location"], queryFn: async () => { try { return await api.projectLocation(projectId!); } catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; } } });
  const surfaces = useQuery({ queryKey: ["projects", projectId, "roof-surfaces"], queryFn: () => api.roofSurfaces(projectId!) });
  const deletion = useMutation({ mutationFn: () => api.deleteProject(projectId!), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["projects"] }); navigate("/projects"); } });
  if (project.isPending || location.isPending || surfaces.isPending) return <main className="workspace-page"><div className="form-page-skeleton" /></main>;
  if (!project.data) return <main className="workspace-page"><div className="query-error">Project not found.</div></main>;
  const totalPanels = (surfaces.data ?? []).reduce((sum, item) => sum + (item.panel_layout?.panel_count ?? 0), 0);
  const totalKwp = (surfaces.data ?? []).reduce((sum, item) => sum + (item.panel_layout?.installed_kwp ?? 0), 0);
  const sharedPanel = (surfaces.data ?? []).find((item) => item.panel_layout)?.panel_layout?.solar_panel;
  const analysisReady = Boolean(surfaces.data?.length) && surfaces.data!.every((item) => item.panel_layout);
  return <main className="workspace-page">
    <Link className="back-link" to="/projects">← All projects</Link>
    <header className="project-detail-heading"><div><h1>{project.data.name}</h1><p>{project.data.description || "No description has been added yet."}</p></div><div className="detail-actions"><Link className="button button-secondary" to={`/projects/${projectId}/edit`}>Edit details</Link><button className="button button-danger" onClick={() => window.confirm(`Delete ${project.data.name}?`) && deletion.mutate()}>Delete</button></div></header>
    <section className="project-overview-grid"><div className="content-panel survey-panel">
      <div className="panel-heading"><div><h2>Roof survey</h2></div><span className={`status-badge ${surfaces.data?.length ? "status-complete" : ""}`}>{surfaces.data?.length ? `${surfaces.data.length} surfaces` : "Not started"}</span></div>
      {location.data ? <div className="roof-summary-location"><RoofIcon /><div><strong>{location.data.location_label || "Selected project location"}</strong><small>{location.data.lat.toFixed(5)}, {location.data.lon.toFixed(5)}</small></div></div> : <p>Add the property location before defining roof surfaces.</p>}
      <dl className="roof-measurements"><div><dt>Roof surfaces</dt><dd>{surfaces.data?.length ?? 0}</dd></div><div><dt>Installed panels</dt><dd>{totalPanels}</dd></div><div><dt>Total system</dt><dd>{totalKwp.toFixed(2)} kWp</dd></div><div><dt>Module</dt><dd>{sharedPanel ? `${sharedPanel.manufacturer} ${sharedPanel.model_sku}` : "Not selected"}</dd></div></dl>
      {!location.data ? <Link className="button button-primary" to={`/projects/${projectId}/location`}>Set project location <ArrowIcon /></Link> : <><Link className="button button-secondary" to={`/projects/${projectId}/location`}>Review location</Link><Link className="button button-secondary" to={`/projects/${projectId}/consumption`}>Energy consumption</Link><Link className="button button-primary" to={analysisReady ? `/projects/${projectId}/analysis` : `/projects/${projectId}/roof-surfaces`}>{analysisReady ? "View production analysis" : "Manage roof surfaces"} <ArrowIcon /></Link></>}
    </div><aside className="content-panel detail-register"><h2>Project register</h2><dl><div><dt>Status</dt><dd>Draft</dd></div><div><dt>Location</dt><dd>{location.data ? "Configured" : "Not set"}</dd></div><div><dt>Roof model</dt><dd>{surfaces.data?.length ? "Multiple surfaces enabled" : "Not configured"}</dd></div><div><dt>Panel layouts</dt><dd>{surfaces.data?.filter((s) => s.panel_layout).length ?? 0} of {surfaces.data?.length ?? 0}</dd></div></dl><p className="estimate-note">Every surface has independent geometry, but all layouts share one panel model.</p></aside></section>
  </main>;
}
