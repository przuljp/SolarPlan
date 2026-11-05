import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";

import { api } from "../lib/api";

export function AiExplanationPanel({ projectId, simulationId, comparisonSimulationId }: {
  projectId: string;
  simulationId: string;
  comparisonSimulationId?: string;
}) {
  const titleId = useId();
  const contentId = useId();
  const [collapsed, setCollapsed] = useState(false);
  const [includeConsumption, setIncludeConsumption] = useState(false);
  const status = useQuery({
    queryKey: ["ai", "status"], queryFn: api.aiStatus, staleTime: 30_000, retry: false,
  });
  const explanation = useMutation({
    mutationFn: () => api.explainSimulation(projectId, simulationId, {
      comparison_simulation_id: comparisonSimulationId ?? null,
      include_current_consumption: includeConsumption,
    }),
    retry: false,
  });
  const result = explanation.data;

  return <section className="content-panel ai-explanation-panel" aria-labelledby={titleId}>
    <div className="ai-explanation-heading">
      <div><h2 id={titleId}>Understand these results</h2><p>Get a plain-language explanation of {comparisonSimulationId ? "the differences between these saved simulations" : "this saved simulation"}.</p></div>
      <button className="button button-secondary" type="button"
        disabled={explanation.isPending || (!result && !status.data?.available)}
        aria-expanded={result ? !collapsed : undefined} aria-controls={result ? contentId : undefined}
        onClick={() => result ? setCollapsed((hidden) => !hidden) : explanation.mutate()}>
        {explanation.isPending ? "Explaining…" : result ? collapsed ? "Show explanation" : "Hide explanation" : "Explain results"}
      </button>
    </div>

    {!result && <>
      <p className="ai-explanation-scope">Choosing “Explain results” sends saved production and system parameters to OpenAI. Your name, address and coordinates are not sent.</p>
      <label className="ai-consumption-option">
        <input type="checkbox" checked={includeConsumption} disabled={explanation.isPending}
          onChange={(event) => { setIncludeConsumption(event.target.checked); explanation.reset(); }} />
        <span>Include my current household consumption, if available<small>This compares {comparisonSimulationId ? "the baseline production" : "the saved production"} with the household profile available now.</small></span>
      </label>
    </>}
    {status.isPending && <p className="ai-explanation-notice" role="status">Checking AI availability…</p>}
    {(status.isError || status.data?.available === false) && <div className="ai-explanation-availability">
      <p>{status.isError ? "AI availability could not be checked. Please try again." : "AI explanations are not available yet. Your analysis and reports are ready to use."}</p>
      <button className="button button-secondary" type="button" disabled={status.isFetching} onClick={() => status.refetch()}>Check availability</button>
    </div>}
    {explanation.isPending && <p className="ai-explanation-notice" role="status">Preparing your explanation. The saved calculation stays available below.</p>}
    {explanation.isError && <p className="form-error" role="alert">{explanation.error instanceof Error ? explanation.error.message : "The explanation could not be generated. Please try again."}</p>}
    {result && <div id={contentId} className="ai-explanation-content" hidden={collapsed} aria-live="polite">
      <p className="ai-explanation-summary">{result.content.summary}</p>
      <h3>Production</h3>
      <ul>{result.content.production_insights.map((text, index) => <li key={index}>{text}</li>)}</ul>
      <h3>Seasonal pattern</h3><p>{result.content.seasonal_insights}</p>
      {result.content.consumption_insights && <><h3>Current household consumption{comparisonSimulationId ? " (baseline)" : ""}</h3><p>{result.content.consumption_insights}</p></>}
      {includeConsumption && !result.consumption_included && <p>No household consumption profile was available for this explanation.</p>}
      {result.content.comparison_insights && <><h3>Simulation comparison</h3><p>{result.content.comparison_insights}</p></>}
      <h3>What to keep in mind</h3>
      <ul>{result.content.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul>
      <p className="ai-explanation-attribution">AI-generated explanation · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.generated_at))}. Refer to the saved results for exact values. Production remains a preliminary PVGIS estimate.</p>
    </div>}
  </section>;
}
