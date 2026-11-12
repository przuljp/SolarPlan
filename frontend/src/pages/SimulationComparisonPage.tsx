import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { AiExplanationPanel } from "../components/AiExplanationPanel";
import { SavedMonthlyChart, annualDifference, savedNumber } from "../components/SavedMonthlyChart";
import type { SimulationComparisonItem } from "../types/api";
const date = new Intl.DateTimeFormat("en-GB", { dateStyle:"medium", timeStyle:"short" });
function Identity({ item, label }: { item: SimulationComparisonItem; label: string }) {
  return <div><span>{label}</span><strong>{date.format(new Date(item.created_at))}</strong><p>{[item.panel_manufacturer, item.panel_model_sku].filter(Boolean).join(" ") || "Saved panel configuration"}</p></div>;
}
export function SimulationComparisonPage() {
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const baselineId = params.get("baseline"), comparisonId = params.get("comparison");
  const valid = !!baselineId && !!comparisonId && baselineId !== comparisonId;
  const query = useQuery({ queryKey:["projects",projectId,"simulations","compare",baselineId,comparisonId], queryFn:()=>api.compareEnergySimulations(projectId!,baselineId!,comparisonId!), enabled:valid });
  if (!valid) return <main className="workspace-page"><p>Two different simulations are required.</p><Link to={`/projects/${projectId}/simulations`}>Choose simulations</Link></main>;
  if (query.isPending) return <main className="workspace-page"><div className="form-page-skeleton" role="status">Loading simulation comparison…</div></main>;
  if (!query.data) return <main className="workspace-page"><div className="query-error" role="alert"><p>Simulation comparison could not be loaded. A saved simulation may no longer be available.</p><button className="button button-secondary" onClick={()=>query.refetch()}>Retry</button><Link to={`/projects/${projectId}/simulations`}>Choose simulations</Link></div></main>;
  const ordered = [query.data.baseline, query.data.comparison].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
  const [older,newer] = ordered;
  const difference = annualDifference(older.annual_kwh,newer.annual_kwh);
  const metrics: Array<[string,keyof SimulationComparisonItem,string,number]> = [["Annual production","annual_kwh","kWh/year",0],["Installed capacity","installed_kwp","kWp",2],["Number of panels","panel_count","",0],["System losses","system_loss_percent","%",1],["Specific yield","specific_yield_kwh_per_kwp","kWh/kWp",0]];
  return <main className="workspace-page saved-comparison-redesign">
    <Link className="back-link" to={`/projects/${projectId}/simulations`}>← Simulation history</Link>
    <header className="saved-comparison-heading"><h1>Simulation Comparison</h1><p>See how your solar configurations differ in estimated energy production.</p></header>
    {query.isError && <p role="alert">Comparison could not be refreshed. <button onClick={()=>query.refetch()}>Retry</button></p>}
    <section className="saved-comparison-identities" aria-label="Compared simulations"><Identity item={older} label="Older simulation" /><Identity item={newer} label="Newer simulation" /></section>
    <section className="saved-comparison-summary"><h2>Comparison summary</h2><table><thead><tr><th scope="col">Metric</th><th scope="col">Older simulation</th><th scope="col">Newer simulation</th></tr></thead><tbody>{metrics.map(([label,key,unit,digits])=><tr key={key}><th scope="row">{label}</th>{[older,newer].map(item=><td key={item.id}>{savedNumber(item[key],digits)} {typeof item[key]==="number" && Number.isFinite(item[key]) ? unit : ""}</td>)}</tr>)}</tbody></table></section>
    <section className="saved-production-difference"><h2>Annual production difference</h2>{difference ? <><strong>{difference.amount > 0 ? "+" : ""}{savedNumber(difference.amount)} kWh/year</strong><p>{difference.percent === null ? "Percentage unavailable: older production is zero." : `${difference.percent > 0 ? "+" : ""}${savedNumber(difference.percent,1)}% compared with older simulation.`} {difference.amount === 0 ? "Both simulations have the same annual production." : `The newer simulation produces ${difference.amount > 0 ? "more" : "less"} energy.`}</p></> : <p>Annual production comparison is unavailable in the saved data.</p>}<small>Higher production does not necessarily mean a better match for your energy goal.</small></section>
    <section className="saved-comparison-monthly"><h2>Monthly Production Comparison</h2><SavedMonthlyChart older={older.monthly_results ?? []} newer={newer.monthly_results ?? []} /></section>
    <details className="saved-comparison-ai"><summary>AI explanation</summary><AiExplanationPanel key={`${older.id}:${newer.id}`} projectId={projectId!} simulationId={older.id} comparisonSimulationId={newer.id} /></details>
    <p className="saved-history-assumptions">Read-only comparison of saved results. No new PVGIS calculation is requested; roof-surface-level differences are intentionally excluded.</p>
  </main>;
}
