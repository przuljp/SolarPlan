import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { api, ApiError } from "../lib/api";
import type { EnergyComparison, EnergySimulation } from "../types/api";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function EnergyComparisonPanel({ comparison, projectId }: { comparison: EnergyComparison; projectId: string }) {
  const maximumMonth = Math.max(...comparison.monthly_comparison.flatMap((item) => [item.production_kwh, item.consumption_kwh ?? 0]), 1);
  const hasMonthlyConsumption = comparison.known_months > 0;

  return <section className="content-panel energy-comparison-panel">
    <div className="analysis-panel-heading"><div><h2>Production and consumption</h2><p>Compare the latest PVGIS estimate with the household energy profile.</p></div><Link to={`/projects/${projectId}/consumption`}>Edit consumption</Link></div>

    <div className="comparison-register" aria-label="Annual energy comparison">
      <div><span>Annual production</span><strong>{number.format(comparison.annual_production_kwh)} <small>kWh</small></strong></div>
      <div><span>Annual consumption</span><strong>{comparison.annual_consumption_kwh === null ? "Not known" : <>{number.format(comparison.annual_consumption_kwh)} <small>kWh</small></>}</strong></div>
      <div><span>Production / consumption</span><strong>{comparison.annual_coverage_ratio_percent === null ? "N/A" : `${decimal.format(comparison.annual_coverage_ratio_percent)}%`}</strong></div>
      <div><span>Annual balance</span><strong>{comparison.annual_balance_kwh === null ? "N/A" : `${comparison.annual_balance_kwh > 0 ? "+" : ""}${number.format(comparison.annual_balance_kwh)} kWh`}</strong></div>
    </div>

    {hasMonthlyConsumption ? <>
      <figure className="comparison-chart">
        <div className="comparison-legend"><span><i className="production-key" />Production</span><span><i className="consumption-key" />Consumption</span></div>
        <div className="comparison-months" aria-hidden="true">
          {comparison.monthly_comparison.map((item) => <div className="comparison-month" key={item.month}>
            <div className="comparison-bar-pair">
              <i className="production-bar" style={{ height: `${Math.max(item.production_kwh / maximumMonth * 100, 1.5)}%` }} />
              {item.consumption_kwh === null ? <i className="consumption-missing" /> : <i className="consumption-bar" style={{ height: `${Math.max(item.consumption_kwh / maximumMonth * 100, 1.5)}%` }} />}
            </div>
            <span>{monthNames[item.month - 1]}</span>
          </div>)}
        </div>
        <figcaption>{comparison.known_months === 12 ? "All 12 months are available for direct comparison." : `${comparison.known_months} of 12 consumption months are known; missing months are left blank.`}</figcaption>
      </figure>
      <details className="monthly-table-disclosure"><summary>View comparison as a table</summary>
        <div className="table-scroll"><table className="energy-table comparison-table"><thead><tr><th>Month</th><th>Production</th><th>Consumption</th><th>Balance</th></tr></thead><tbody>{comparison.monthly_comparison.map((item) => <tr key={item.month}><td>{monthNames[item.month - 1]}</td><td>{number.format(item.production_kwh)} kWh</td><td>{item.consumption_kwh === null ? "Not available" : `${number.format(item.consumption_kwh)} kWh`}</td><td className={item.status === "surplus" ? "balance-surplus" : item.status === "deficit" ? "balance-deficit" : ""}>{item.balance_kwh === null ? "N/A" : `${item.balance_kwh > 0 ? "+" : ""}${number.format(item.balance_kwh)} kWh`}</td></tr>)}</tbody></table></div>
      </details>
    </> : <div className="comparison-monthly-unavailable"><strong>Monthly comparison needs monthly consumption.</strong><p>The annual total can be compared, but it cannot be distributed across months without inventing a seasonal pattern.</p><Link className="button button-secondary" to={`/projects/${projectId}/consumption`}>Add monthly values</Link></div>}

    <p className="comparison-disclaimer">Energy coverage compares totals. It does not measure direct self-consumption, grid independence or the treatment of exported energy.</p>
  </section>;
}

export function AnalysisResult({ simulation, comparisonContent }: { simulation: EnergySimulation; comparisonContent?: ReactNode }) {
  const maximumMonth = Math.max(...simulation.monthly_results.map((item) => item.energy_kwh), 1);
  const maximumSurface = Math.max(...simulation.surface_results.map((item) => item.annual_kwh), 1);

  return <>
    <section className="analysis-metrics" aria-label="Production summary">
      <div><span>Estimated annual production</span><strong>{number.format(simulation.annual_kwh)} <small>kWh/year</small></strong></div>
      <div><span>Installed system size</span><strong>{decimal.format(simulation.installed_kwp)} <small>kWp</small></strong></div>
      <div><span>Specific yield</span><strong>{number.format(simulation.specific_yield_kwh_per_kwp)} <small>kWh/kWp</small></strong></div>
    </section>

    {comparisonContent}

    <div className="analysis-grid">
      <section className="content-panel production-chart-panel">
        <div className="analysis-panel-heading"><div><h2>Production through the year</h2><p>Combined estimate for every saved roof surface.</p></div><span>PVGIS {simulation.provider_version}</span></div>
        <figure className="production-chart">
          <div className="production-bars" aria-hidden="true">
            {simulation.monthly_results.map((item) => <div className="production-bar-column" key={item.month}>
              <span className="production-value">{number.format(item.energy_kwh)}</span>
              <div className="production-bar-track"><i style={{ height: `${Math.max(item.energy_kwh / maximumMonth * 100, 2)}%` }} /></div>
              <span className="production-month">{monthNames[item.month - 1]}</span>
            </div>)}
          </div>
          <figcaption>Estimated monthly energy production in kilowatt-hours (kWh).</figcaption>
        </figure>
        <details className="monthly-table-disclosure"><summary>View monthly values as a table</summary>
          <div className="table-scroll"><table className="energy-table"><thead><tr><th>Month</th><th>Estimated production</th></tr></thead><tbody>{simulation.monthly_results.map((item) => <tr key={item.month}><td>{monthNames[item.month - 1]}</td><td>{number.format(item.energy_kwh)} kWh</td></tr>)}</tbody></table></div>
        </details>
      </section>

      <aside className="content-panel analysis-assumptions">
        <h2>Analysis assumptions</h2>
        <dl><div><dt>System loss</dt><dd>{simulation.system_loss_percent}%</dd></div><div><dt>Roof surfaces</dt><dd>{simulation.surface_results.length}</dd></div><div><dt>Calculated</dt><dd>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(simulation.created_at))}</dd></div></dl>
        <p>This is a preliminary PVGIS estimate based on location, roof direction, tilt and installed power. It does not model nearby shading, structural limits or inverter selection.</p>
      </aside>
    </div>

    <section className="content-panel surface-production-panel">
      <div className="analysis-panel-heading"><div><h2>Contribution by roof surface</h2><p>Different directions and tilts produce different amounts from the same installed power.</p></div></div>
      <div className="surface-production-list">
        {simulation.surface_results.map((surface) => <article key={surface.roof_surface_id}>
          <div className="surface-production-heading"><div><h3>{surface.name}</h3><span>{surface.installed_kwp.toFixed(2)} kWp · {surface.tilt_deg}° tilt · {surface.azimuth_deg}° azimuth</span></div><strong>{number.format(surface.annual_kwh)} <small>kWh/year</small></strong></div>
          <div className="surface-production-track" aria-hidden="true"><i style={{ width: `${surface.annual_kwh / maximumSurface * 100}%` }} /></div>
          <span className="surface-yield">Specific yield: {number.format(surface.specific_yield_kwh_per_kwp)} kWh/kWp</span>
        </article>)}
      </div>
    </section>
  </>;
}

export function ProductionAnalysisPage() {
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  const [systemLoss, setSystemLoss] = useState(14);
  const [hasEditedSystemLoss, setHasEditedSystemLoss] = useState(false);
  const latest = useQuery({
    queryKey: ["projects", projectId, "simulations", "latest"],
    queryFn: async () => {
      try { return await api.latestEnergySimulation(projectId!); }
      catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
    },
  });
  useEffect(() => {
    if (latest.data && !hasEditedSystemLoss) setSystemLoss(latest.data.system_loss_percent);
  }, [hasEditedSystemLoss, latest.data]);
  const run = useMutation({
    mutationFn: () => api.runEnergySimulation(projectId!, { system_loss_percent: systemLoss }),
    onSuccess: async (simulation) => {
      queryClient.setQueryData(["projects", projectId, "simulations", "latest"], simulation);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects", projectId], exact: true }),
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "energy-comparison"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "simulations", "history"] }),
      ]);
    },
  });
  const simulation = run.data ?? latest.data;
  const comparison = useQuery({
    queryKey: ["projects", projectId, "energy-comparison"],
    queryFn: async () => {
      try { return await api.energyComparison(projectId!); }
      catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
    },
    enabled: Boolean(simulation),
  });

  if (latest.isPending) return <main className="workspace-page"><div className="form-page-skeleton" role="status"><span className="sr-only">Loading production analysis…</span></div></main>;
  if (latest.isError) return <main className="workspace-page"><div className="query-error"><div><strong>Production analysis could not be loaded.</strong><p>Check the connection and try again.</p></div><button className="button button-secondary" onClick={() => latest.refetch()}>Try again</button></div></main>;

  return <main className="workspace-page production-analysis-page">
    <Link className="back-link" to={`/projects/${projectId}`}>← Project overview</Link>
    <header className="analysis-heading"><div><h1>Production analysis</h1><p>Estimate how much electricity the complete roof model could produce during a typical year.</p><Link className="analysis-history-link" to={`/projects/${projectId}/simulations`}>View simulation history</Link></div>
      <form id="analysis-run-form" className="analysis-run-form" onSubmit={(event) => { event.preventDefault(); run.mutate(); }}>
        <label htmlFor="system-loss">System loss <span>%</span></label>
        <small id="system-loss-help" className="analysis-run-help">Includes estimated losses from temperature, wiring and inverter conversion. The default is 14%.</small>
        <input id="system-loss" type="number" min="0" max="100" step="0.1" value={systemLoss} aria-describedby="system-loss-help" onChange={(event) => { setHasEditedSystemLoss(true); setSystemLoss(Number(event.target.value)); }} />
        <button className="button button-primary" type="submit" disabled={run.isPending}>{run.isPending ? "Calculating…" : simulation ? "Recalculate" : "Run analysis"}</button>
      </form>
    </header>

    {run.isError && <div className="form-error analysis-error" role="alert"><strong>Analysis could not be completed.</strong><span>{run.error instanceof ApiError ? run.error.message : "Please try again shortly."}</span></div>}
    {run.isPending && <section className="analysis-loading" role="status"><span className="spinner" aria-hidden="true" /><div><strong>Calculating every roof surface…</strong><p>SolarPlan is requesting PVGIS estimates and combining them into one project result.</p></div></section>}
    {!run.isPending && simulation && <AnalysisResult simulation={simulation} comparisonContent={<>
      {comparison.isPending && <section className="comparison-loading" role="status"><span className="spinner" aria-hidden="true" /><span>Loading the production and consumption comparison…</span></section>}
      {comparison.isError && <div className="query-error comparison-query-error"><div><strong>Energy comparison could not be loaded.</strong><p>The production result is still available. Try loading the comparison again.</p></div><button className="button button-secondary" onClick={() => comparison.refetch()}>Try again</button></div>}
      {!comparison.isPending && !comparison.isError && comparison.data && comparison.data.simulation_id === simulation.id && <EnergyComparisonPanel comparison={comparison.data} projectId={projectId!} />}
      {!comparison.isPending && !comparison.isError && !comparison.data && <section className="analysis-next-step comparison-empty"><div><strong>Add household consumption to complete the energy picture.</strong><span>Production is ready. Monthly or annual consumption enables a transparent comparison without changing the PVGIS result.</span></div><Link className="button button-primary" to={`/projects/${projectId}/consumption`}>Add consumption</Link></section>}
    </>} />}
    {!run.isPending && !simulation && <section className="content-panel analysis-empty"><div className="analysis-empty-graphic" aria-hidden="true"><span /><span /><span /><span /><span /></div><h2>No production analysis yet</h2><p>Your roof geometry and panel layouts are ready. Run the first analysis to calculate monthly and annual production for the entire project.</p><button className="button button-primary" type="submit" form="analysis-run-form">Run first analysis</button></section>}
  </main>;
}
