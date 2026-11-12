import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { ArrowIcon, RoofIcon } from "../components/Icons";
import { api } from "../lib/api";
import type { RoofSurface } from "../types/api";

const dimensions = (surface: RoofSurface) => surface.shape_type === "trapezoid"
  ? `${surface.top_width_m} m top · ${surface.bottom_width_m} m bottom · ${surface.length_m} m long`
  : `${surface.bottom_width_m} × ${surface.length_m} m`;

const directionNames: Record<number, string> = { 0: "North (N)", 45: "Northeast (NE)", 90: "East (E)", 135: "Southeast (SE)", 180: "South (S)", 225: "Southwest (SW)", 270: "West (W)", 315: "Northwest (NW)" };
const orientation = (degrees: number) => directionNames[degrees] ?? `Saved direction · ${degrees}°`;
const slopeNames: Record<number, string> = { 3: "Flat roof", 20: "Gentle slope", 40: "Steep slope" };
const slope = (degrees: number) => slopeNames[degrees] ? `${slopeNames[degrees]} · ${degrees}°` : `Saved slope · ${degrees}°`;

export function RoofSurfacesPage() {
  const { projectId } = useParams();
  const [search, setSearch] = useSearchParams();
  const queryClient = useQueryClient();
  const surfaces = useQuery({ queryKey: ["projects", projectId, "roof-surfaces"], queryFn: () => api.roofSurfaces(projectId!) });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteRoofSurface(projectId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "roof-surfaces"] }),
  });
  if (surfaces.isPending) return <main className="workspace-page"><p role="status">Loading roof surfaces…</p><div className="form-page-skeleton" aria-hidden="true" /></main>;
  if (surfaces.isError) return <main className="workspace-page"><Link className="back-link" to={`/projects/${projectId}`}>← Project overview</Link><h1>Roof surfaces</h1><div className="query-error" role="alert"><p>Roof surfaces could not be loaded. Please try again.</p><button className="button button-secondary" onClick={() => surfaces.refetch()}>Try again</button></div></main>;
  const totalPanels = (surfaces.data ?? []).reduce((sum, item) => sum + (item.panel_layout?.panel_count ?? 0), 0);
  const totalKwp = (surfaces.data ?? []).reduce((sum, item) => sum + (item.panel_layout?.installed_kwp ?? 0), 0);
  const sharedPanel = (surfaces.data ?? []).find((item) => item.panel_layout)?.panel_layout?.solar_panel;
  const analysisReady = Boolean(surfaces.data?.length) && surfaces.data!.every((item) => item.panel_layout);
  return <main className="workspace-page roof-surfaces-page roof-surfaces-redesign">
    <Link className="back-link" to={`/projects/${projectId}`}>← Project overview</Link>
    <header className="project-detail-heading"><div><h1>Roof surfaces</h1><p>Manage each roof surface, review saved panel layouts, and prepare your energy estimate.</p></div>{surfaces.data.length > 0 && <Link className="button button-primary" to={`/projects/${projectId}/roof-surfaces/new`}>Add roof surface <ArrowIcon /></Link>}</header>
    {search.get("saved") && <div className="roof-save-notice" role="status"><span>Panel layout saved.</span><button type="button" aria-label="Dismiss saved notification" onClick={() => { const next = new URLSearchParams(search); next.delete("saved"); setSearch(next, { replace: true }); }}>Dismiss</button></div>}
    {remove.isError && <p className="form-error" role="alert">{remove.error instanceof Error ? remove.error.message : "The surface could not be deleted. Please try again."}</p>}
    <dl className="roof-summary-stats" aria-label="Project summary">
      <div><dt>Roof surfaces</dt><dd>{surfaces.data.length}</dd></div>
      <div><dt>Solar panels</dt><dd>{totalPanels}</dd></div>
      <div><dt>Total capacity</dt><dd>{totalKwp.toFixed(2)} <small>kWp</small></dd></div>
    </dl>
    {sharedPanel && <p className="roof-shared-module">Shared panel model: <strong>{sharedPanel.manufacturer} {sharedPanel.model_sku}</strong></p>}
    {surfaces.data.length > 0 && <div className={`roof-surface-grid ${surfaces.data.length === 1 ? "roof-single-surface" : ""}`}>
      {(surfaces.data ?? []).map((surface) => <article className="content-panel roof-surface-card" key={surface.id}>
        <div className="panel-heading"><div><RoofIcon /><h2>{surface.name}</h2></div><span className={`status-badge ${surface.panel_layout ? "status-complete" : ""}`}>{surface.panel_layout ? "Layout saved" : "Needs layout"}</span></div>
        <dl className="roof-card-facts">
          <div className="roof-geometry-fact"><dt>Roof shape & dimensions</dt><dd>{surface.shape_type === "trapezoid" ? "Trapezoid" : "Rectangle"}<small>{dimensions(surface)}</small></dd></div>
          <div><dt>Orientation</dt><dd>{orientation(surface.azimuth_deg)}</dd></div>
          <div><dt>Slope</dt><dd>{slope(surface.tilt_deg)}</dd></div>
          <div><dt>Solar panels</dt><dd>{surface.panel_layout ? surface.panel_layout.panel_count : "Not arranged"}</dd></div>
          <div><dt>Capacity</dt><dd>{surface.panel_layout ? `${surface.panel_layout.installed_kwp.toFixed(2)} kWp` : "Not calculated"}</dd></div>
        </dl>
        <div className="surface-card-actions"><Link className="button button-secondary button-small" to={`/projects/${projectId}/roof-surfaces/${surface.id}/edit`}>Edit surface</Link><Link className="button button-primary button-small" to={surface.panel_layout ? `/projects/${projectId}/roof-surfaces/${surface.id}/layout?panel=${surface.panel_layout.solar_panel_id}` : `/projects/${projectId}/roof-surfaces/${surface.id}/panels`}>{surface.panel_layout ? "Review layout" : "Choose panel"} <ArrowIcon /></Link><button className="text-link danger-link" disabled={remove.isPending} aria-label={`Delete ${surface.name}`} onClick={() => window.confirm(`Delete ${surface.name}?`) && remove.mutate(surface.id)}>Delete</button></div>
      </article>)}
    </div>}
    {analysisReady && <section className="roof-analysis-cta"><div><h2>Explore your roof’s energy potential</h2><p>Estimate monthly and annual electricity production across your saved roof surfaces.</p></div><Link className="button button-primary" to={`/projects/${projectId}/analysis`}>Open production analysis <ArrowIcon /></Link></section>}
    {!surfaces.data?.length && <section className="content-panel roof-empty-state"><span className="roof-empty-icon" aria-hidden="true"><RoofIcon /></span><h2>Start with your first roof surface</h2><p>Add the dimensions, direction and slope of your roof to begin planning your solar system.</p><Link className="button button-primary" to={`/projects/${projectId}/roof-surfaces/new`}>Add roof surface <ArrowIcon /></Link></section>}
  </main>;
}
