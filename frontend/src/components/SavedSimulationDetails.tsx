import type { EnergySimulation } from "../types/api";
import { SavedMonthlyChart, savedNumber } from "./SavedMonthlyChart";
import { SimulationReportActions } from "./SimulationReportActions";
import { AiExplanationPanel } from "./AiExplanationPanel";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
export function SavedSimulationDetails({ simulation: s }: { simulation: EnergySimulation }) {
  const surfaces = Array.isArray(s.input_snapshot.surfaces) ? s.input_snapshot.surfaces.map(record) : [];
  const panel = record(s.input_snapshot.panel ?? surfaces.find(surface => surface.panel)?.panel);
  const count = surfaces.length && surfaces.every(surface => typeof surface.panel_count === "number") ? surfaces.reduce((total, surface) => total + Number(surface.panel_count), 0) : null;
  return <>
    <section className="saved-detail-information"><h2>Simulation information</h2><dl><div><dt>Panel model</dt><dd>{[panel.manufacturer, panel.model_sku].filter(v => typeof v === "string").join(" ") || "Unavailable in saved snapshot"}</dd></div><div><dt>Roof surfaces</dt><dd>{s.surface_results.length}</dd></div><div><dt>Panel count</dt><dd>{savedNumber(count)}</dd></div><div><dt>System losses</dt><dd>{savedNumber(s.system_loss_percent, 1)}%</dd></div></dl></section>
    <section className="saved-detail-energy"><h2>Energy results</h2><dl><div><dt>Annual production</dt><dd>{savedNumber(s.annual_kwh)} <small>kWh/year</small></dd></div><div><dt>Installed capacity</dt><dd>{savedNumber(s.installed_kwp, 2)} <small>kWp</small></dd></div><div><dt>Specific yield</dt><dd>{savedNumber(s.specific_yield_kwh_per_kwp)} <small>kWh/kWp</small></dd></div></dl></section>
    <section className="saved-detail-monthly"><h2>Monthly production</h2><SavedMonthlyChart older={s.monthly_results ?? []} olderLabel="Saved simulation" /></section>
    <section className="saved-detail-surfaces"><h2>Roof-surface breakdown</h2>{s.surface_results.map(surface => {
      const snapshot = surfaces.find(v => v.roof_surface_id === surface.roof_surface_id);
      return <article key={surface.roof_surface_id}><h3>{surface.name}</h3><p>{savedNumber(surface.annual_kwh)} kWh/year · {savedNumber(surface.installed_kwp, 2)} kWp · {savedNumber(surface.specific_yield_kwh_per_kwp)} kWh/kWp</p><p>{savedNumber(surface.tilt_deg)}° slope · {savedNumber(surface.azimuth_deg)}° direction{snapshot && <> · {savedNumber(snapshot.panel_count)} panels{typeof snapshot.orientation === "string" && ` · ${snapshot.orientation}`}</>}</p></article>;
    })}</section>
    <p className="saved-history-assumptions">Preliminary PVGIS estimate using saved location, roof direction, slope and installed power. Nearby shading, structural limits and inverter selection are not modelled.</p>
    <SimulationReportActions projectId={s.project_id} simulationId={s.id} />
    <AiExplanationPanel projectId={s.project_id} simulationId={s.id} />
  </>;
}
