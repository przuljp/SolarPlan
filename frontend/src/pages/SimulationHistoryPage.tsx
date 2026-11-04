import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../lib/api";
import type { EnergySimulationSummary } from "../types/api";
import { AnalysisResult } from "./ProductionAnalysisPage";

const wholeNumber = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

function sourceLabel(source: EnergySimulationSummary["source"]): string {
  return source === "configuration_optimizer" ? "Optimizer configuration" : "Manual analysis";
}

function SimulationHistoryRow({ simulation, latest, selected, selectionDisabled, onSelect }: {
  simulation: EnergySimulationSummary;
  latest: boolean;
  selected: boolean;
  selectionDisabled: boolean;
  onSelect: () => void;
}) {
  const panelName = simulation.panel_manufacturer && simulation.panel_model_sku
    ? `${simulation.panel_manufacturer} ${simulation.panel_model_sku}`
    : "Saved panel configuration";

  return <li>
    <article className={`simulation-history-row${selected ? " is-selected" : ""}`}>
      <label className="simulation-select-control">
        <input type="checkbox" checked={selected} disabled={selectionDisabled} onChange={onSelect} />
        <span>{selected ? "Selected" : "Select"}<small>for comparison</small></span>
      </label>
      <div className="simulation-history-identity">
        <div className="simulation-history-badges">
          <span className="status-badge">{sourceLabel(simulation.source)}</span>
          {latest && <span className="status-badge status-complete">Latest</span>}
        </div>
        <time dateTime={simulation.created_at}>{dateTime.format(new Date(simulation.created_at))}</time>
        <span>{panelName}</span>
      </div>
      <dl className="simulation-history-values">
        <div><dt>Annual production</dt><dd>{wholeNumber.format(simulation.annual_kwh)} <small>kWh</small></dd></div>
        <div><dt>System size</dt><dd>{decimal.format(simulation.installed_kwp)} <small>kWp</small></dd></div>
        <div><dt>Panels</dt><dd>{simulation.panel_count}</dd></div>
        <div><dt>System loss</dt><dd>{decimal.format(simulation.system_loss_percent)}<small>%</small></dd></div>
      </dl>
      <Link className="button button-secondary" to={`/projects/${simulation.project_id}/simulations/${simulation.id}`}>View details</Link>
    </article>
  </li>;
}

export function SimulationHistoryPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const history = useQuery({
    queryKey: ["projects", projectId, "simulations", "history"],
    queryFn: () => api.energySimulations(projectId!),
  });

  if (history.isPending) return <main className="workspace-page"><div className="form-page-skeleton" role="status"><span className="sr-only">Loading simulation history…</span></div></main>;
  if (history.isError) return <main className="workspace-page"><div className="query-error"><div><strong>Simulation history could not be loaded.</strong><p>Check the connection and try again.</p></div><button className="button button-secondary" onClick={() => history.refetch()}>Try again</button></div></main>;
  const simulations = history.data;

  function toggleSelection(simulationId: string) {
    setSelectedIds((current) => current.includes(simulationId)
      ? current.filter((id) => id !== simulationId)
      : current.length < 2 ? [...current, simulationId] : current);
  }

  function openComparison() {
    const selected = simulations
      .filter((simulation) => selectedIds.includes(simulation.id))
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
    if (selected.length !== 2) return;
    const query = new URLSearchParams({ baseline: selected[0].id, comparison: selected[1].id });
    navigate(`/projects/${projectId}/simulations/compare?${query}`);
  }

  return <main className="workspace-page simulation-history-page">
    <Link className="back-link" to={`/projects/${projectId}`}>← Project overview</Link>
    <header className="simulation-history-heading">
      <div><h1>Simulation history</h1><p>Review every saved production calculation without changing the current roof plan or requesting a new PVGIS estimate.</p></div>
      <Link className="button button-primary" to={`/projects/${projectId}/analysis`}>Open current analysis</Link>
    </header>

    {simulations.length === 0 ? <section className="content-panel simulation-history-empty">
      <h2>No saved simulations yet</h2>
      <p>Run the first production analysis to create a permanent calculation snapshot for this project.</p>
      <Link className="button button-primary" to={`/projects/${projectId}/analysis`}>Run production analysis</Link>
    </section> : <>
      <div className="simulation-history-summary" aria-label="Simulation history summary">
        <div><span>Saved calculations</span><strong>{simulations.length}</strong></div>
        <div><span>Latest production</span><strong>{wholeNumber.format(simulations[0].annual_kwh)} <small>kWh/year</small></strong></div>
        <div><span>Latest system</span><strong>{decimal.format(simulations[0].installed_kwp)} <small>kWp</small></strong></div>
      </div>
      <section className="simulation-compare-control" aria-label="Simulation comparison selection">
        <div>
          <strong>Compare saved results</strong>
          <span>{selectedIds.length === 0 ? "Select two simulations below." : selectedIds.length === 1 ? "Select one more simulation." : "Ready — the older result will be the baseline."}</span>
        </div>
        <button className="button button-primary" type="button" disabled={selectedIds.length !== 2} onClick={openComparison}>Compare selected</button>
      </section>
      <ol className="simulation-history-list">
        {simulations.map((simulation, index) => <SimulationHistoryRow
          key={simulation.id}
          simulation={simulation}
          latest={index === 0}
          selected={selectedIds.includes(simulation.id)}
          selectionDisabled={selectedIds.length === 2 && !selectedIds.includes(simulation.id)}
          onSelect={() => toggleSelection(simulation.id)}
        />)}
      </ol>
      <p className="simulation-history-note">Each entry is an immutable calculation snapshot. Current roof changes do not rewrite older results.</p>
    </>}
  </main>;
}

export function SimulationHistoryDetailPage() {
  const { projectId, simulationId } = useParams();
  const simulation = useQuery({
    queryKey: ["projects", projectId, "simulations", simulationId],
    queryFn: () => api.energySimulation(projectId!, simulationId!),
  });

  if (simulation.isPending) return <main className="workspace-page"><div className="form-page-skeleton" role="status"><span className="sr-only">Loading saved simulation…</span></div></main>;
  if (simulation.isError) return <main className="workspace-page"><div className="query-error"><div><strong>Saved simulation could not be loaded.</strong><p>It may no longer exist or belong to this project.</p></div><Link className="button button-secondary" to={`/projects/${projectId}/simulations`}>Back to history</Link></div></main>;

  const source = simulation.data.input_snapshot.source === "configuration_optimizer" ? "Optimizer configuration" : "Manual analysis";
  return <main className="workspace-page simulation-detail-page">
    <Link className="back-link" to={`/projects/${projectId}/simulations`}>← Simulation history</Link>
    <header className="simulation-detail-heading">
      <div><h1>Simulation details</h1><p>Saved on {dateTime.format(new Date(simulation.data.created_at))} from {source.toLowerCase()}.</p></div>
      <Link className="button button-secondary" to={`/projects/${projectId}/analysis`}>Open current analysis</Link>
    </header>
    <section className="simulation-snapshot-note" aria-label="Saved snapshot information">
      <div><strong>Read-only calculation snapshot</strong><span>This view uses the inputs and PVGIS result saved at calculation time. It does not recalculate or restore the roof plan.</span></div>
      <dl><div><dt>Source</dt><dd>{source}</dd></div><div><dt>Provider</dt><dd>PVGIS {simulation.data.provider_version}</dd></div><div><dt>Method</dt><dd>{simulation.data.method_version}</dd></div></dl>
    </section>
    <AnalysisResult simulation={simulation.data} />
  </main>;
}
