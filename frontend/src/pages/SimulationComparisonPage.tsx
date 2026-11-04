import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { api } from "../lib/api";
import type { SimulationComparisonItem } from "../types/api";

const wholeNumber = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const signedWhole = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0, signDisplay: "always" });
const signedDecimal = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 2, signDisplay: "always" });
const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function panelName(simulation: SimulationComparisonItem): string {
  return simulation.panel_manufacturer && simulation.panel_model_sku
    ? `${simulation.panel_manufacturer} ${simulation.panel_model_sku}`
    : "Saved panel configuration";
}

function Delta({ value, unit = "", decimals = false }: { value: number; unit?: string; decimals?: boolean }) {
  const tone = value > 0 ? "is-positive" : value < 0 ? "is-negative" : "is-neutral";
  return <span className={`simulation-delta ${tone}`}>{(decimals ? signedDecimal : signedWhole).format(value)}{unit}</span>;
}

export function SimulationComparisonPage() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const baselineId = searchParams.get("baseline");
  const comparisonId = searchParams.get("comparison");
  const comparison = useQuery({
    queryKey: ["projects", projectId, "simulations", "compare", baselineId, comparisonId],
    queryFn: () => api.compareEnergySimulations(projectId!, baselineId!, comparisonId!),
    enabled: Boolean(projectId && baselineId && comparisonId && baselineId !== comparisonId),
  });

  if (!baselineId || !comparisonId || baselineId === comparisonId) return <main className="workspace-page"><div className="query-error"><div><strong>Two different simulations are required.</strong><p>Return to the history and select exactly two saved results.</p></div><Link className="button button-secondary" to={`/projects/${projectId}/simulations`}>Choose simulations</Link></div></main>;
  if (comparison.isPending) return <main className="workspace-page"><div className="form-page-skeleton" role="status"><span className="sr-only">Loading simulation comparison…</span></div></main>;
  if (comparison.isError) return <main className="workspace-page"><div className="query-error"><div><strong>Simulation comparison could not be loaded.</strong><p>One of the saved results may no longer exist. Choose the simulations again.</p></div><Link className="button button-secondary" to={`/projects/${projectId}/simulations`}>Back to history</Link></div></main>;

  const result = comparison.data;
  const maxMonthly = Math.max(...result.monthly_comparison.flatMap((month) => [month.baseline_kwh, month.comparison_kwh]), 1);

  return <main className="workspace-page simulation-comparison-page">
    <Link className="back-link" to={`/projects/${projectId}/simulations`}>← Simulation history</Link>
    <header className="simulation-comparison-heading">
      <div><h1>Compare simulations</h1><p>See how the complete system changed between two saved PVGIS calculation snapshots.</p></div>
      <Link className="button button-secondary" to={`/projects/${projectId}/analysis`}>Open current analysis</Link>
    </header>

    <section className="simulation-comparison-snapshots" aria-label="Compared simulations">
      <article><span>Baseline · older</span><strong>{dateTime.format(new Date(result.baseline.created_at))}</strong><small>{panelName(result.baseline)}</small></article>
      <div aria-hidden="true">to</div>
      <article><span>Comparison · newer</span><strong>{dateTime.format(new Date(result.comparison.created_at))}</strong><small>{panelName(result.comparison)}</small></article>
    </section>

    <section className="content-panel simulation-metric-comparison">
      <header><h2>System-level differences</h2><p>Delta values show the newer result minus the baseline.</p></header>
      <div className="simulation-comparison-table" role="table" aria-label="System metric comparison">
        <div className="simulation-comparison-table-head" role="row"><span role="columnheader">Metric</span><span role="columnheader">Baseline</span><span role="columnheader">Newer</span><span role="columnheader">Difference</span></div>
        <div role="row"><strong role="rowheader">Panel model</strong><span>{panelName(result.baseline)}</span><span>{panelName(result.comparison)}</span><span>—</span></div>
        <div role="row"><strong role="rowheader">Panel count</strong><span>{result.baseline.panel_count}</span><span>{result.comparison.panel_count}</span><Delta value={result.deltas.panel_count} /></div>
        <div role="row"><strong role="rowheader">System size</strong><span>{decimal.format(result.baseline.installed_kwp)} kWp</span><span>{decimal.format(result.comparison.installed_kwp)} kWp</span><Delta value={result.deltas.installed_kwp} unit=" kWp" decimals /></div>
        <div role="row"><strong role="rowheader">Annual production</strong><span>{wholeNumber.format(result.baseline.annual_kwh)} kWh</span><span>{wholeNumber.format(result.comparison.annual_kwh)} kWh</span><Delta value={result.deltas.annual_kwh} unit=" kWh" /></div>
        <div role="row"><strong role="rowheader">Specific yield</strong><span>{wholeNumber.format(result.baseline.specific_yield_kwh_per_kwp)} kWh/kWp</span><span>{wholeNumber.format(result.comparison.specific_yield_kwh_per_kwp)} kWh/kWp</span><Delta value={result.deltas.specific_yield_kwh_per_kwp} unit=" kWh/kWp" /></div>
        <div role="row"><strong role="rowheader">System loss</strong><span>{decimal.format(result.baseline.system_loss_percent)}%</span><span>{decimal.format(result.comparison.system_loss_percent)}%</span><Delta value={result.deltas.system_loss_percent} unit=" pp" decimals /></div>
      </div>
    </section>

    <section className="content-panel simulation-monthly-comparison">
      <header><h2>Monthly production</h2><p>Aggregated production for the complete system, without roof-surface breakdowns.</p></header>
      <div className="simulation-comparison-legend" aria-hidden="true"><span><i />Baseline</span><span><i />Newer</span></div>
      <figure>
        <div className="simulation-comparison-bars">
          {result.monthly_comparison.map((month) => <div className="simulation-comparison-month" key={month.month}>
            <div className="simulation-comparison-bar-pair" aria-label={`${monthNames[month.month - 1]}: baseline ${wholeNumber.format(month.baseline_kwh)} kWh, newer ${wholeNumber.format(month.comparison_kwh)} kWh`}>
              <i style={{ height: `${(month.baseline_kwh / maxMonthly) * 100}%` }} />
              <i style={{ height: `${(month.comparison_kwh / maxMonthly) * 100}%` }} />
            </div>
            <strong>{monthNames[month.month - 1]}</strong>
            <Delta value={month.delta_kwh} />
          </div>)}
        </div>
        <figcaption>Monthly values are saved PVGIS outputs; opening this comparison does not start a new calculation.</figcaption>
      </figure>
    </section>

    <p className="simulation-comparison-note"><strong>Read-only comparison.</strong> It compares saved project totals and monthly production only. Roof-surface-level differences are intentionally excluded.</p>
  </main>;
}
