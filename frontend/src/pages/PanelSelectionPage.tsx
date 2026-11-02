import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ArrowIcon } from "../components/Icons";
import { api } from "../lib/api";
import type { SolarPanelCategory } from "../types/api";

const labels: Record<SolarPanelCategory | "all", string> = { all: "All sizes", compact: "Compact roof", standard: "Standard", "high-power": "High power" };

export function PanelSelectionPage() {
  const { projectId, surfaceId } = useParams(); const navigate = useNavigate();
  const [category, setCategory] = useState<SolarPanelCategory | "all">("all"); const [manufacturer, setManufacturer] = useState("all"); const [selectedId, setSelectedId] = useState<string | null>(null);
  const panels = useQuery({ queryKey: ["solar-panels"], queryFn: api.solarPanels });
  const surfaces = useQuery({ queryKey: ["projects", projectId, "roof-surfaces"], queryFn: () => api.roofSurfaces(projectId!) });
  const commonPanelId = surfaces.data?.find((surface) => surface.panel_layout)?.panel_layout?.solar_panel_id ?? null;
  const effectiveSelected = commonPanelId ?? selectedId;
  const manufacturers = useMemo(() => [...new Set((panels.data ?? []).map((panel) => panel.manufacturer))].sort(), [panels.data]);
  const visible = (panels.data ?? []).filter((panel) => (category === "all" || panel.category === category) && (manufacturer === "all" || panel.manufacturer === manufacturer));
  return <main className="workspace-page">
    <Link className="back-link" to={`/projects/${projectId}/roof-surfaces`}>← Roof surfaces</Link>
    <header className="workspace-heading panel-catalog-heading"><div><h1>{commonPanelId ? "Use the project panel" : "Choose a verified panel"}</h1><p>{commonPanelId ? "This model is already used by another roof surface, so it remains common across the project." : "Choose one model now. The same model will be used on every roof surface in this project."}</p></div><div className="catalog-count"><strong>{visible.length}</strong><span>matching modules</span></div></header>
    <section className="catalog-method-note"><strong>One project, one module model</strong><p>Different roof surfaces may have different panel counts and orientations, but procurement and electrical planning stay consistent.</p></section>
    <div className="catalog-filters"><label>Panel class<select value={category} onChange={(e) => setCategory(e.target.value as SolarPanelCategory | "all")}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Manufacturer<select value={manufacturer} onChange={(e) => setManufacturer(e.target.value)}><option value="all">All manufacturers</option>{manufacturers.map((name) => <option key={name}>{name}</option>)}</select></label></div>
    <div className="panel-catalog">{visible.map((panel) => {
      const locked = Boolean(commonPanelId && panel.id !== commonPanelId); const selected = panel.id === effectiveSelected;
      return <article className={`panel-spec-card ${selected ? "is-selected" : ""} ${locked ? "is-locked" : ""}`} key={panel.id}><label className="panel-card-select"><input type="radio" disabled={locked} checked={selected} onChange={() => setSelectedId(panel.id)} /><span>{selected ? "Project panel" : locked ? "Different model" : "Select panel"}</span></label><div className="panel-card-title"><div><small>{panel.manufacturer}</small><h2>{panel.model_sku}</h2></div><strong>{panel.power_wp}<span> Wp</span></strong></div><dl className="panel-specs"><div><dt>Dimensions</dt><dd>{panel.length_mm} × {panel.width_mm} mm</dd></div><div><dt>Efficiency</dt><dd>{panel.efficiency_percent}%</dd></div><div><dt>Technology</dt><dd>{panel.cell_technology}</dd></div></dl><div className="panel-source-links"><a href={panel.datasheet_url} target="_blank" rel="noreferrer">Technical source ↗</a><a href={panel.bih_source_url} target="_blank" rel="noreferrer">BiH listing ↗</a></div></article>;
    })}</div>
    <div className="catalog-action-bar"><div><strong>{effectiveSelected ? "Panel ready" : "Choose one model"}</strong><span>Next, calculate the fit for this roof surface.</span></div><button className="button button-primary" disabled={!effectiveSelected} onClick={() => navigate(`/projects/${projectId}/roof-surfaces/${surfaceId}/layout?panel=${effectiveSelected}`)}>Calculate surface layout <ArrowIcon /></button></div>
  </main>;
}
