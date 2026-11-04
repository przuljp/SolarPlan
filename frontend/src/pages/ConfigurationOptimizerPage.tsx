import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, ApiError } from "../lib/api";
import type { ConfigurationOptimization, OptimizationCriterion } from "../types/api";

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

const modes: Array<{ value: OptimizationCriterion; title: string; description: string }> = [
  { value: "maximum_production", title: "Maximum production", description: "Fill each roof surface with the feasible configuration that produces the most annual energy." },
  { value: "consumption_match", title: "Match consumption", description: "Find configurations whose annual production is closest to a complete annual consumption total." },
  { value: "manual", title: "Current manual plan", description: "Evaluate the panel model, orientation and count already saved on every roof surface." },
];

function Results({ result, applyingId, onApply }: { result: ConfigurationOptimization; applyingId: string | null; onApply: (id: string) => void }) {
  const criterionLabel = modes.find((mode) => mode.value === result.criterion)?.title;
  return <section className="optimizer-results" aria-labelledby="optimizer-results-title">
    <div className="optimizer-results-heading">
      <div><h2 id="optimizer-results-title">Configuration comparison</h2><p>{criterionLabel} · {date.format(new Date(result.created_at))} · {result.system_loss_percent}% system loss</p></div>
      {result.target_consumption_kwh !== null && <div className="optimizer-target"><span>Annual target</span><strong>{number.format(result.target_consumption_kwh)} <small>kWh</small></strong></div>}
    </div>
    <div className="optimizer-candidates">
      {result.candidates.map((candidate) => <article className={`optimizer-candidate ${candidate.recommended ? "is-recommended" : ""}`} key={candidate.candidate_id}>
        <header>
          <div className="optimizer-rank"><span>Rank</span><strong>{candidate.rank}</strong></div>
          <div><span className="candidate-maker">{candidate.panel.manufacturer}</span><h3>{candidate.panel.model_sku}</h3></div>
          {candidate.recommended && <span className="status-badge">Recommended</span>}
        </header>
        <p className="candidate-explanation">{candidate.explanation}</p>
        <dl className="candidate-metrics">
          <div><dt>Annual production</dt><dd>{number.format(candidate.annual_kwh)} <small>kWh</small></dd></div>
          <div><dt>Installed system</dt><dd>{candidate.installed_kwp.toFixed(2)} <small>kWp</small></dd></div>
          <div><dt>Panels</dt><dd>{candidate.total_panel_count}</dd></div>
          <div><dt>Module area</dt><dd>{candidate.occupied_area_m2.toFixed(1)} <small>m²</small></dd></div>
          {candidate.target_coverage_percent !== null && <div><dt>Target coverage</dt><dd>{candidate.target_coverage_percent.toFixed(1)} <small>%</small></dd></div>}
        </dl>
        <details className="candidate-surfaces"><summary>Roof-surface breakdown</summary><div>
          {candidate.surfaces.map((surface) => <p key={surface.roof_surface_id}><strong>{surface.name}</strong><span>{surface.panel_count} panels · {surface.orientation} · {surface.installed_kwp.toFixed(2)} kWp · {number.format(surface.annual_kwh)} kWh/year</span></p>)}
        </div></details>
        <button className={candidate.recommended ? "button button-primary" : "button button-secondary"} type="button" disabled={applyingId !== null || result.selected_candidate_id === candidate.candidate_id} onClick={() => onApply(candidate.candidate_id)}>
          {applyingId === candidate.candidate_id ? "Applying configuration…" : result.selected_candidate_id === candidate.candidate_id ? "Applied to project" : "Use this configuration"}
        </button>
      </article>)}
    </div>
    <p className="optimizer-method-note">The ranking is deterministic. PVGIS estimates production for each roof direction; SolarPlan filters configurations that do not physically fit. Energy coverage does not equal direct self-consumption or grid independence.</p>
    {result.rejected_candidates.length > 0 && <details className="optimizer-rejections"><summary>{result.rejected_candidates.length} rejected panel model{result.rejected_candidates.length === 1 ? "" : "s"}</summary>{result.rejected_candidates.map((item) => <p key={item.panel_id}><strong>{item.panel_name}</strong> — {item.reason}</p>)}</details>}
  </section>;
}

export function ConfigurationOptimizerPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [criterion, setCriterion] = useState<OptimizationCriterion>("maximum_production");
  const [systemLoss, setSystemLoss] = useState(14);
  const [candidateLimit, setCandidateLimit] = useState(3);
  const [result, setResult] = useState<ConfigurationOptimization | null>(null);
  const latest = useQuery({
    queryKey: ["projects", projectId, "optimizations", "latest"],
    queryFn: async () => { try { return await api.latestOptimization(projectId!); } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; } },
  });
  useEffect(() => { if (latest.data) setResult(latest.data); }, [latest.data]);
  const run = useMutation({
    mutationFn: () => api.runOptimization(projectId!, { criterion, system_loss_percent: systemLoss, candidate_limit: candidateLimit }),
    onSuccess: (optimization) => { setResult(optimization); queryClient.setQueryData(["projects", projectId, "optimizations", "latest"], optimization); },
  });
  const apply = useMutation({
    mutationFn: (candidateId: string) => api.selectOptimizationCandidate(projectId!, result!.id, candidateId),
    onSuccess: async (selection) => {
      setResult(selection.optimization);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "roof-surfaces"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "simulations"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "energy-comparison"] }),
      ]);
      navigate(`/projects/${projectId}/analysis`);
    },
  });

  return <main className="workspace-page optimizer-page">
    <Link className="back-link" to={`/projects/${projectId}`}>← Project overview</Link>
    <header className="optimizer-heading"><div><h1>Configuration optimizer</h1><p>Compare feasible panel configurations across the complete roof model, then apply the plan that best fits your energy goal.</p></div></header>

    <form className="content-panel optimizer-controls" onSubmit={(event) => { event.preventDefault(); run.mutate(); }}>
      <fieldset className="optimizer-mode-control"><legend>Optimization goal</legend>{modes.map((mode) => <label className={criterion === mode.value ? "is-selected" : ""} key={mode.value}><input type="radio" name="optimization-mode" value={mode.value} checked={criterion === mode.value} onChange={() => setCriterion(mode.value)} /><span><strong>{mode.title}</strong><small>{mode.description}</small></span></label>)}</fieldset>
      <div className="optimizer-settings"><label>System loss <span>%</span><input type="number" min="0" max="100" step="0.1" value={systemLoss} onChange={(event) => setSystemLoss(Number(event.target.value))} /></label><label>Configurations shown<select value={candidateLimit} disabled={criterion === "manual"} onChange={(event) => setCandidateLimit(Number(event.target.value))}><option value={2}>2 candidates</option><option value={3}>3 candidates</option><option value={4}>4 candidates</option><option value={5}>5 candidates</option></select></label></div>
      {criterion === "manual" && <div className="optimizer-manual-note"><div><strong>The current roof plan will be evaluated.</strong><span>Change the shared panel model, orientation or count on the roof surfaces before running this mode.</span></div><Link className="button button-secondary" to={`/projects/${projectId}/roof-surfaces`}>Review roof layouts</Link></div>}
      <div className="optimizer-run-row"><p>PVGIS may need a short moment for roof directions that are not already cached.</p><button className="button button-primary" type="submit" disabled={run.isPending}>{run.isPending ? "Comparing configurations…" : "Run optimizer"}</button></div>
    </form>

    {run.isError && <div className="form-error optimizer-error" role="alert"><strong>Optimizer could not complete the comparison.</strong><span>{run.error instanceof ApiError ? run.error.message : "Please try again shortly."}</span></div>}
    {latest.isError && !result && <div className="query-error"><div><strong>Saved optimization could not be loaded.</strong><p>You can still run a new comparison.</p></div></div>}
    {run.isPending && <section className="analysis-loading" role="status"><span className="spinner" aria-hidden="true" /><div><strong>Testing verified panel configurations…</strong><p>SolarPlan is checking roof fit and ranking PVGIS energy estimates.</p></div></section>}
    {!run.isPending && result && <Results result={result} applyingId={apply.isPending ? apply.variables ?? null : null} onApply={(id) => apply.mutate(id)} />}
    {apply.isError && <div className="form-error optimizer-error" role="alert"><strong>The configuration was not applied.</strong><span>{apply.error instanceof ApiError ? apply.error.message : "Your existing roof layouts are unchanged."}</span></div>}
    {!latest.isPending && !run.isPending && !result && <section className="content-panel optimizer-empty"><h2>No comparison yet</h2><p>Select an energy goal and run the optimizer. SolarPlan will show at least two feasible alternatives when the roof supports them.</p></section>}
  </main>;
}
