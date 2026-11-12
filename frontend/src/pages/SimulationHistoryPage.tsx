import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../lib/api";
import type { EnergySimulationSummary } from "../types/api";
import { SavedSimulationDetails } from "../components/SavedSimulationDetails";
import { RoofIcon } from "../components/Icons";

const wholeNumber = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

function sourceLabel(source: EnergySimulationSummary["source"]): string {
  return source === "configuration_optimizer" ? "Optimizer configuration" : source === "manual_analysis" ? "Manual analysis" : "Source unavailable";
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
        <span className="sr-only">Compare simulation from {dateTime.format(new Date(simulation.created_at))}: {panelName}</span>
      </label>
      <div className="simulation-history-identity">
        <time dateTime={simulation.created_at}>{dateTime.format(new Date(simulation.created_at))}</time>
        <span>{panelName}</span>
        <small>{latest && <strong>Latest · </strong>}{sourceLabel(simulation.source)}</small>
      </div>
      <dl className="simulation-history-values">
        <div><dt>Annual production</dt><dd>{wholeNumber.format(simulation.annual_kwh)} <small>kWh/year</small></dd></div>
        <div><dt>System size</dt><dd>{decimal.format(simulation.installed_kwp)} <small>kWp</small></dd></div>
        <div><dt>Panels</dt><dd>{simulation.panel_count}</dd></div>
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
  if (history.isError && !history.data) return <main className="workspace-page"><div className="query-error"><div><strong>Simulation history could not be loaded.</strong><p>Check the connection and try again.</p></div><button className="button button-secondary" onClick={() => history.refetch()}>Try again</button></div></main>;
  const simulations = [...(history.data ?? [])].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const activeIds = selectedIds.filter((id) => simulations.some((simulation) => simulation.id === id));

  function toggleSelection(simulationId: string) {
    setSelectedIds((previous) => {
      const current = previous.filter(id => simulations.some(simulation => simulation.id === id));
      return current.includes(simulationId) ? current.filter(id => id !== simulationId) : current.length < 2 ? [...current, simulationId] : current;
    });
  }

  function openComparison() {
    const selected = simulations
      .filter((simulation) => activeIds.includes(simulation.id))
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
    if (selected.length !== 2) return;
    const query = new URLSearchParams({ baseline: selected[0].id, comparison: selected[1].id });
    navigate(`/projects/${projectId}/simulations/compare?${query}`);
  }

  return <main className="workspace-page simulation-history-page history-redesign">
    <Link className="back-link" to={`/projects/${projectId}`}>← Project overview</Link>
    <header className="simulation-history-heading">
      <div><h1>Simulation history</h1><p>Review your saved solar production estimates and compare different configurations.</p></div>
      <Link className="button button-secondary" to={`/projects/${projectId}/analysis`}>Open current analysis</Link>
    </header>

    {simulations.length === 0 ? <section className="content-panel simulation-history-empty">
      <RoofIcon /><h2>No simulations yet</h2>
      <p>Run your first production analysis to see saved results here.</p>
      <Link className="button button-primary" to={`/projects/${projectId}/analysis`}>Open Production Analysis</Link>
    </section> : <>
      <section className="history-saved" aria-labelledby="saved-simulations-title">
      <header><h2 id="saved-simulations-title">Saved simulations <small>{simulations.length} saved {simulations.length === 1 ? "simulation" : "simulations"}</small></h2><p id="history-selection-hint">Select two simulations to compare. Deselect one to change your selection.</p></header>
      {history.isError && <div role="alert">History could not be refreshed. Saved results are still shown. <button onClick={() => history.refetch()}>Retry</button></div>}
      <ol className="simulation-history-list">
        {simulations.map((simulation, index) => <SimulationHistoryRow
          key={simulation.id}
          simulation={simulation}
          latest={index === 0}
          selected={activeIds.includes(simulation.id)}
          selectionDisabled={activeIds.length === 2 && !activeIds.includes(simulation.id)}
          onSelect={() => toggleSelection(simulation.id)}
        />)}
      </ol>
      </section>
      {activeIds.length > 0 && <section className="history-selection-bar" aria-label="Simulation comparison selection">
        <p role="status">{activeIds.length === 1 ? "1 of 2 simulations selected." : "2 simulations selected."}</p>
        <div><button className="button button-secondary" onClick={() => setSelectedIds([])}>Clear selection</button><button className="button button-primary" disabled={activeIds.length !== 2} onClick={openComparison}>Compare Simulations</button></div>
      </section>}
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
  if (simulation.isError && !simulation.data) return <main className="workspace-page"><div className="query-error"><div><strong>Saved simulation could not be loaded.</strong><p>It may no longer exist or belong to this project.</p></div><button className="button button-secondary" onClick={() => simulation.refetch()}>Retry</button><Link className="button button-secondary" to={`/projects/${projectId}/simulations`}>Back to history</Link></div></main>;

  const source = simulation.data!.input_snapshot.source === "configuration_optimizer" ? "Optimizer configuration" : "Manual analysis";
  return <main className="workspace-page simulation-detail-page saved-detail-redesign">
    <Link className="back-link" to={`/projects/${projectId}/simulations`}>← Simulation history</Link>
    <header className="simulation-detail-heading">
      <div><h1>Simulation details</h1><p>Saved on {dateTime.format(new Date(simulation.data!.created_at))} from {source.toLowerCase()}.</p></div>
      <Link className="button button-secondary" to={`/projects/${projectId}/analysis`}>Open current analysis</Link>
    </header>
    <section className="simulation-snapshot-note" aria-label="Saved snapshot information">
      <div><strong>Read-only calculation snapshot</strong><span>This view uses the inputs and PVGIS result saved at calculation time. It does not recalculate or restore the roof plan.</span></div>
      <dl><div><dt>Source</dt><dd>{source}</dd></div><div><dt>Provider</dt><dd>PVGIS {simulation.data!.provider_version}</dd></div><div><dt>Method</dt><dd>{simulation.data!.method_version}</dd></div></dl>
    </section>
    <SavedSimulationDetails simulation={simulation.data!} />
  </main>;
}
