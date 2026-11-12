import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { DEFAULT_SYSTEM_LOSS_PERCENT, isValidSystemLoss, SystemLossControl } from "../components/SystemLossControl";
import { api, ApiError } from "../lib/api";
import type { ConfigurationOptimization, OptimizationCandidate, OptimizationCriterion } from "../types/api";

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

const modes: Array<{ value: OptimizationCriterion; title: string; description: string }> = [
  { value: "maximum_production", title: "Maximum production", description: "Find the roof configuration with the highest annual energy output." },
  { value: "consumption_match", title: "Match consumption", description: "Bring annual production closest to your annual consumption." },
  { value: "manual", title: "Current manual plan", description: "Evaluate the panel model and layouts already saved on your roof." },
];

type Production = number | null | undefined;
const available = (value: Production): value is number => typeof value === "number" && Number.isFinite(value);
const display = (value: Production, digits?: number) => available(value) ? digits === undefined ? number.format(value) : value.toFixed(digits) : "—";
const highestProduction = (result: ConfigurationOptimization) => {
  const values = result.candidates.map((candidate) => candidate.annual_kwh).filter(available);
  return values.length ? Math.max(...values) : null;
};

export function productionDifference(production: Production, reference: Production): string {
  if (!available(production) || !available(reference)) return "Production comparison unavailable";
  if (reference <= 0) return production === reference ? "Same annual production" : "Comparison unavailable: reference production is zero";
  const difference = (production - reference) / reference * 100;
  if (difference === 0) return "Highest annual production";
  return `${Math.abs(difference).toFixed(1)}% ${difference < 0 ? "less" : "more"} annual production`;
}

function SurfaceDetails({ candidate }: { candidate: OptimizationCandidate }) {
  return <details className="optimizer-surface-details">
    <summary>Roof-surface breakdown</summary>
    <div className="optimizer-surface-list">{candidate.surfaces.map((surface) => <section key={surface.roof_surface_id}>
      <h4>{surface.name}</h4>
      <p><strong>{display(surface.panel_count)} panels</strong> · {surface.orientation} · {display(surface.installed_kwp, 2)} kWp</p>
      <dl>
        <div><dt>Annual production</dt><dd>{display(surface.annual_kwh)} kWh/year</dd></div>
        <div><dt>Slope / direction</dt><dd>{display(surface.tilt_deg)}° / {display(surface.azimuth_deg)}°</dd></div>
        <div><dt>Module area</dt><dd>{display(surface.occupied_area_m2, 1)} m²</dd></div>
        <div><dt>Roof utilization</dt><dd>{display(surface.utilization_percent, 1)}%</dd></div>
        <div><dt>Maximum panels</dt><dd>{display(surface.maximum_panel_count)}</dd></div>
      </dl>
    </section>)}</div>
  </details>;
}

function GoalSelector({ value, disabled, onChange }: { value: OptimizationCriterion; disabled: boolean; onChange: (value: OptimizationCriterion) => void }) {
  return <fieldset className="optimizer-goals"><legend>Optimization goal</legend>
    <div>{modes.map((mode) => <label className={value === mode.value ? "is-selected" : ""} key={mode.value}>
      <input type="radio" name="optimization-mode" value={mode.value} checked={value === mode.value} disabled={disabled} onChange={() => onChange(mode.value)} />
      <span><strong>{mode.title}</strong><small>{mode.description}</small></span>
    </label>)}</div>
  </fieldset>;
}

function LossSettings({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (value: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const valid = isValidSystemLoss(value);
  return <div className="optimizer-loss-settings">
    <div><span>System losses: <strong>{Number.isFinite(value) ? value : "—"}%</strong></span>
      <button type="button" className="optimizer-text-button" aria-expanded={expanded} aria-controls="optimizer-loss-adjustment" onClick={() => setExpanded(!expanded)} disabled={disabled}>Adjust</button>
    </div>
    {expanded && <div id="optimizer-loss-adjustment"><SystemLossControl id="optimizer-system-loss" value={value} disabled={disabled} onChange={onChange} /></div>}
    {!expanded && !valid && <p className="form-error" role="alert">Enter a value from 0% to 30%. Open Adjust to correct system losses.</p>}
  </div>;
}

function ApplyDialog({ candidate, result, busy, error, returnFocus, onCancel, onConfirm }: {
  candidate: OptimizationCandidate; result: ConfigurationOptimization; busy: boolean; error: string | null;
  returnFocus: HTMLButtonElement; onCancel: () => void; onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { dialog.close(); if (returnFocus.isConnected && !returnFocus.disabled) returnFocus.focus(); };
  }, [returnFocus]);
  const best = highestProduction(result);
  return <dialog ref={ref} className="optimizer-apply-dialog" aria-labelledby="apply-title" aria-describedby="apply-model apply-impact" aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <header><h2 id="apply-title">Apply Configuration #{candidate.rank}</h2><p id="apply-model">{candidate.panel.manufacturer} {candidate.panel.model_sku}</p></header>
    <dl className="optimizer-apply-summary">
      <div><dt>Annual production</dt><dd>{display(candidate.annual_kwh)} <small>kWh/year</small></dd></div>
      <div><dt>Installed capacity</dt><dd>{display(candidate.installed_kwp, 2)} <small>kWp</small></dd></div>
      <div><dt>Solar panels</dt><dd>{display(candidate.total_panel_count)}</dd></div>
      <div><dt>Module area</dt><dd>{display(candidate.occupied_area_m2, 1)} <small>m²</small></dd></div>
    </dl>
    <div className="optimizer-apply-comparison"><strong>{productionDifference(candidate.annual_kwh, best)}</strong>
      {available(best) && available(candidate.annual_kwh) && <span>{display(Math.abs(candidate.annual_kwh - best))} kWh/year difference from the highest-production candidate.</span>}
    </div>
    <SurfaceDetails candidate={candidate} />
    <div className="optimizer-apply-impact" id="apply-impact"><strong>Your panel configuration will be replaced.</strong><p>The selected panel model and proposed layouts replace your current panel configuration. Project location, roof dimensions, direction and slope stay unchanged.</p><p>Existing analyses are retained and may need recalculation after configuration changes. Applying saves a simulation from these optimizer results without a new PVGIS calculation.</p></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {busy && <p role="status">Applying configuration…</p>}
    <footer className="form-actions"><button autoFocus className="button button-secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={busy} onClick={onConfirm}>{busy ? "Applying…" : "Apply configuration"}</button></footer>
  </dialog>;
}

function CandidateCard({ candidate, best, selected, applyingId, onApply }: {
  candidate: OptimizationCandidate; best: Production; selected: boolean; applyingId: string | null;
  onApply: (id: string, trigger: HTMLButtonElement) => void;
}) {
  const recommended = candidate.rank === 1;
  return <article className={`optimizer-option ${recommended ? "is-recommended" : ""}`} aria-labelledby={`candidate-${candidate.candidate_id}`}>
    <header><div className="optimizer-option-rank"><span>Rank {candidate.rank}</span>{recommended && <span className="status-badge">Recommended</span>}</div>
      <span className="optimizer-option-maker">{candidate.panel.manufacturer}</span><h3 id={`candidate-${candidate.candidate_id}`}>{candidate.panel.model_sku}</h3>
    </header>
    <dl className="optimizer-production"><dt>Estimated annual production</dt><dd>{display(candidate.annual_kwh)} <small>kWh/year</small></dd></dl>
    <dl className="optimizer-option-metrics">
      <div><dt>Installed capacity</dt><dd>{display(candidate.installed_kwp, 2)} <small>kWp</small></dd></div>
      <div><dt>Solar panels</dt><dd>{display(candidate.total_panel_count)}</dd></div>
      <div><dt>Module area</dt><dd>{display(candidate.occupied_area_m2, 1)} <small>m²</small></dd></div>
    </dl>
    <p className="optimizer-option-comparison">{productionDifference(candidate.annual_kwh, best)}</p>
    <details className="optimizer-option-details"><summary>View configuration details</summary>
      <div><p>{candidate.explanation}</p><dl><div><dt>Module area</dt><dd>{display(candidate.occupied_area_m2, 1)} m²</dd></div><div><dt>Specific yield</dt><dd>{display(candidate.specific_yield_kwh_per_kwp)} kWh/kWp</dd></div>
        {available(candidate.target_coverage_percent) && <div><dt>Target coverage</dt><dd>{display(candidate.target_coverage_percent, 1)}%</dd></div>}
      </dl><SurfaceDetails candidate={candidate} /></div>
    </details>
    <button className={recommended ? "button button-primary" : "button button-secondary"} type="button" disabled={applyingId !== null || selected} onClick={(event) => onApply(candidate.candidate_id, event.currentTarget)}>
      {applyingId === candidate.candidate_id ? "Applying configuration…" : selected ? "Applied to project" : "Use this configuration"}
    </button>
  </article>;
}

function Results({ result, applyingId, onApply }: { result: ConfigurationOptimization; applyingId: string | null; onApply: (id: string, trigger: HTMLButtonElement) => void }) {
  const best = highestProduction(result);
  const criterionLabel = modes.find((mode) => mode.value === result.criterion)?.title;
  return <section className="optimizer-comparison" aria-labelledby="optimizer-results-title">
    <header className="optimizer-comparison-heading"><div><h2 id="optimizer-results-title">Configuration comparison</h2><p>{criterionLabel} · {date.format(new Date(result.created_at))} · {result.system_loss_percent}% system loss</p></div>
      {available(result.target_consumption_kwh) && <p className="optimizer-annual-target">Annual target <strong>{display(result.target_consumption_kwh)} kWh</strong></p>}
    </header>
    <p className="optimizer-comparison-context">Ranked for {criterionLabel}. Production differences compare with the highest annual production shown{result.criterion === "consumption_match" ? ", which may differ from the best consumption match" : ""}.</p>
    {result.candidates.length ? <div className="optimizer-options">{result.candidates.map((candidate) => <CandidateCard key={candidate.candidate_id} candidate={candidate} best={best} selected={result.selected_candidate_id === candidate.candidate_id} applyingId={applyingId} onApply={onApply} />)}</div>
      : <div className="optimizer-empty"><h3>No feasible configurations found</h3><p>Review the roof dimensions and saved panel layouts, then run the optimizer again.</p></div>}
    <details className="optimizer-ranking"><summary>How configurations are ranked</summary><p>Recommended is the best-ranked candidate for {criterionLabel}. For Match consumption, this may differ from the highest-production candidate. Production differences use the highest annual production among the displayed candidates.</p><p>The ranking is deterministic. PVGIS estimates production for each roof direction; SolarPlan filters configurations that do not physically fit. Energy coverage does not equal direct self-consumption or grid independence.</p></details>
    {result.rejected_candidates.length > 0 && <details className="optimizer-rejections"><summary>{result.rejected_candidates.length} rejected panel model{result.rejected_candidates.length === 1 ? "" : "s"}</summary>{result.rejected_candidates.map((item) => <p key={item.panel_id}><strong>{item.panel_name}</strong> — {item.reason}</p>)}</details>}
  </section>;
}

export function ConfigurationOptimizerPage() {
  const { projectId } = useParams();
  const [selection, setSelection] = useState<{ candidate: OptimizationCandidate; result: ConfigurationOptimization; trigger: HTMLButtonElement } | null>(null);
  const [applied, setApplied] = useState(false);
  const successRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (applied) successRef.current?.focus(); }, [applied]);
  const submitting = useRef(false);
  const queryClient = useQueryClient();
  const [criterion, setCriterion] = useState<OptimizationCriterion>("maximum_production");
  const [systemLoss, setSystemLoss] = useState(DEFAULT_SYSTEM_LOSS_PERCENT);
  const [candidateLimit, setCandidateLimit] = useState(3);
  const [result, setResult] = useState<ConfigurationOptimization | null>(null);
  const systemLossValid = isValidSystemLoss(systemLoss);
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
    mutationFn: ({ optimizationId, candidateId }: { optimizationId: string; candidateId: string }) => api.selectOptimizationCandidate(projectId!, optimizationId, candidateId),
    onSuccess: async (selection) => {
      setResult(selection.optimization);
      queryClient.setQueryData(["projects", projectId, "optimizations", "latest"], selection.optimization);
      setSelection(null); setApplied(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "roof-surfaces"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "simulations"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "energy-comparison"] }),
      ]);

    },
    onSettled: () => { submitting.current = false; },
  });

  return <main className="workspace-page optimizer-workbench">
    <Link className="back-link" to={`/projects/${projectId}`}>← Project overview</Link>
    <header className="optimizer-page-heading"><h1>Configuration optimizer</h1><p>Compare solar configurations for your roof and choose the plan that fits your energy goal.</p></header>

    <form className="optimizer-controls" aria-labelledby="optimizer-settings-title" onSubmit={(event) => { event.preventDefault(); if (systemLossValid && !selection && !run.isPending && !apply.isPending) { setApplied(false); run.mutate(); } }}>
      <header><h2 id="optimizer-settings-title">Optimization settings</h2><p>Choose a goal, then compare the feasible configurations.</p></header>
      <GoalSelector value={criterion} disabled={run.isPending || apply.isPending} onChange={setCriterion} />
      <div className="optimizer-settings-row">
        <LossSettings value={systemLoss} disabled={run.isPending || apply.isPending} onChange={setSystemLoss} />
        <label className="optimizer-limit">Configurations shown<select value={candidateLimit} disabled={criterion === "manual" || run.isPending || apply.isPending} onChange={(event) => setCandidateLimit(Number(event.target.value))}><option value={2}>2 candidates</option><option value={3}>3 candidates</option><option value={4}>4 candidates</option><option value={5}>5 candidates</option></select></label>
      </div>
      {criterion === "manual" && <div className="optimizer-manual-note"><p><strong>The current roof plan will be evaluated.</strong><span>Change the shared panel model, orientation or count on the roof surfaces before running this mode.</span></p><Link className="button button-secondary" to={`/projects/${projectId}/roof-surfaces`}>Review roof layouts</Link></div>}
      <footer className="optimizer-run-row"><p>PVGIS estimates may take a moment for roof directions that are not cached.</p><button className="button button-primary" type="submit" disabled={run.isPending || apply.isPending || !systemLossValid || selection !== null}>{run.isPending ? "Comparing configurations…" : "Run optimizer"}</button></footer>
    </form>

    {run.isError && <div className="form-error optimizer-error" role="alert"><strong>Optimizer could not complete the comparison.</strong><span>{run.error instanceof ApiError ? run.error.message : "Please try again shortly."}</span></div>}
    {latest.isError && !result && <div className="query-error"><div><strong>Saved optimization could not be loaded.</strong><p>You can still run a new comparison.</p></div></div>}
    {run.isPending && <section className="analysis-loading" role="status"><span className="spinner" aria-hidden="true" /><div><strong>Testing verified panel configurations…</strong><p>SolarPlan is checking roof fit and ranking PVGIS energy estimates.</p></div></section>}
    {!run.isPending && result && <Results result={result} applyingId={apply.isPending ? apply.variables?.candidateId ?? null : null} onApply={(id, trigger) => { const candidate = result.candidates.find((item) => item.candidate_id === id); if (candidate) { apply.reset(); setSelection({ candidate, result, trigger }); } }} />}
    {selection && <ApplyDialog candidate={selection.candidate} result={selection.result} returnFocus={selection.trigger} busy={apply.isPending} error={apply.isError ? apply.error instanceof Error ? apply.error.message : "The configuration was not applied. Please try again." : null} onCancel={() => { if (!submitting.current) setSelection(null); }} onConfirm={() => { if (submitting.current) return; submitting.current = true; apply.mutate({ optimizationId: selection.result.id, candidateId: selection.candidate.candidate_id }); }} />}
    {applied && <section className="optimizer-applied" aria-label="Configuration application"><div><p ref={successRef} tabIndex={-1} role="status">Configuration applied successfully.</p><p>A simulation was saved from these optimizer results. Earlier analyses remain historical snapshots.</p></div><div><Link className="button button-secondary" to={`/projects/${projectId}/roof-surfaces`}>View Roof Surfaces</Link><Link className="button button-primary" to={`/projects/${projectId}/analysis`}>Open Production Analysis</Link></div></section>}
    {!latest.isPending && !run.isPending && !result && <section className="optimizer-empty"><h2>No comparison yet</h2><p>Select an energy goal and run the optimizer. SolarPlan will show at least two feasible alternatives when the roof supports them.</p></section>}
  </main>;
}
