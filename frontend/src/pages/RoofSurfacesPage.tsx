import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { ArrowIcon, RoofIcon } from "../components/Icons";
import { api } from "../lib/api";
import type { RoofSurface } from "../types/api";

const dimensions = (surface: RoofSurface) => surface.shape_type === "trapezoid"
  ? `${surface.top_width_m} m top · ${surface.bottom_width_m} m bottom · ${surface.length_m} m long`
  : `${surface.bottom_width_m} × ${surface.length_m} m`;

export function RoofSurfacesPage() {
  const { projectId } = useParams();
  const [search] = useSearchParams();
  const queryClient = useQueryClient();
  const surfaces = useQuery({ queryKey: ["projects", projectId, "roof-surfaces"], queryFn: () => api.roofSurfaces(projectId!) });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteRoofSurface(projectId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "roof-surfaces"] }),
  });
  if (surfaces.isPending) return <main className="workspace-page"><div className="form-page-skeleton" /></main>;
  const totalPanels = (surfaces.data ?? []).reduce((sum, item) => sum + (item.panel_layout?.panel_count ?? 0), 0);
  const totalKwp = (surfaces.data ?? []).reduce((sum, item) => sum + (item.panel_layout?.installed_kwp ?? 0), 0);
  const sharedPanel = (surfaces.data ?? []).find((item) => item.panel_layout)?.panel_layout?.solar_panel;
  const analysisReady = Boolean(surfaces.data?.length) && surfaces.data!.every((item) => item.panel_layout);
  return <main className="workspace-page roof-surfaces-page">
    <Link className="back-link" to={`/projects/${projectId}`}>← Project overview</Link>
    <header className="project-detail-heading"><div><h1>Roof surfaces</h1><p>Add every usable side of the roof. Each surface can be rectangular or trapezoidal, while the panel model stays common.</p></div><Link className="button button-primary" to={`/projects/${projectId}/roof-surfaces/new`}>Add roof surface <ArrowIcon /></Link></header>
    {search.get("saved") && <div className="form-success" role="status">Panel layout saved. The project overview below is now up to date.</div>}
    <section className="content-panel roof-portfolio-summary"><strong>{(surfaces.data ?? []).length} roof surfaces</strong><span>{totalPanels} panels · {totalKwp.toFixed(2)} kWp total</span>{sharedPanel && <small>Shared module: {sharedPanel.manufacturer} {sharedPanel.model_sku}</small>}</section>
    {analysisReady && <section className="analysis-next-step"><div><strong>Your complete roof model is ready.</strong><span>Estimate annual and monthly production for all saved surfaces together.</span></div><Link className="button button-primary" to={`/projects/${projectId}/analysis`}>Open production analysis <ArrowIcon /></Link></section>}
    <div className="roof-surface-grid">
      {(surfaces.data ?? []).map((surface) => <article className="content-panel roof-surface-card" key={surface.id}>
        <div className="panel-heading"><div><RoofIcon /><h2>{surface.name}</h2></div><span className={`status-badge ${surface.panel_layout ? "status-complete" : ""}`}>{surface.panel_layout ? "Layout saved" : "Needs layout"}</span></div>
        <dl className="roof-measurements"><div><dt>Shape</dt><dd className="surface-shape-value">{surface.shape_type === "trapezoid" ? "Trapezoid" : "Rectangle"}<small>{dimensions(surface)}</small></dd></div><div><dt>Tilt</dt><dd>{surface.tilt_deg}°</dd></div><div><dt>Azimuth</dt><dd>{surface.azimuth_deg}°</dd></div><div><dt>Array</dt><dd>{surface.panel_layout ? `${surface.panel_layout.panel_count} panels · ${surface.panel_layout.installed_kwp.toFixed(2)} kWp` : "Not calculated"}</dd></div></dl>
        <div className="surface-card-actions"><Link className="button button-secondary button-small" to={`/projects/${projectId}/roof-surfaces/${surface.id}/edit`}>Edit surface</Link><Link className="button button-primary button-small" to={surface.panel_layout ? `/projects/${projectId}/roof-surfaces/${surface.id}/layout?panel=${surface.panel_layout.solar_panel_id}` : `/projects/${projectId}/roof-surfaces/${surface.id}/panels`}>{surface.panel_layout ? "Review layout" : "Choose panel"} <ArrowIcon /></Link><button className="text-link danger-link" onClick={() => window.confirm(`Delete ${surface.name}?`) && remove.mutate(surface.id)}>Delete</button></div>
      </article>)}
    </div>
    {!surfaces.data?.length && <section className="content-panel roof-placeholder"><RoofIcon /><h2>No roof surfaces yet</h2><p>Start with one roof side. You can add the others afterwards.</p><Link className="button button-primary" to={`/projects/${projectId}/roof-surfaces/new`}>Add first surface <ArrowIcon /></Link></section>}
  </main>;
}
