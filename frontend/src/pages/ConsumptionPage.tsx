import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { ArrowIcon } from "../components/Icons";
import { api, ApiError } from "../lib/api";
import type { ConsumptionProfileInput } from "../types/api";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function ConsumptionPage() {
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"monthly" | "annual">("monthly");
  const [monthlyValues, setMonthlyValues] = useState(() => Array(12).fill("") as string[]);
  const [annualValue, setAnnualValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const consumption = useQuery({
    queryKey: ["projects", projectId, "consumption"],
    queryFn: async () => {
      try { return await api.consumptionProfile(projectId!); }
      catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
    },
  });
  const initialized = useRef<string | undefined>(undefined);
  const baseline = useRef("");
  const snapshot = JSON.stringify({ mode, monthlyValues, annualValue });
  const dirty = baseline.current !== "" && baseline.current !== snapshot;
  useEffect(() => {
    if (consumption.isPending || consumption.isError || initialized.current === projectId) return;
    initialized.current = projectId;
    const profile = consumption.data;
    const nextMode = profile?.profile_kind === "annual_only" ? "annual" : "monthly";
    const nextMonthly = Array(12).fill("") as string[];
    profile?.monthly_values.forEach((item) => { nextMonthly[item.month - 1] = String(item.consumption_kwh); });
    const nextAnnual = nextMode === "annual" ? String(profile?.annual_consumption_kwh ?? "") : "";
    setMode(nextMode); setMonthlyValues(nextMonthly); setAnnualValue(nextAnnual);
    baseline.current = JSON.stringify({ mode: nextMode, monthlyValues: nextMonthly, annualValue: nextAnnual });
  }, [consumption.data, consumption.isPending, consumption.isError, projectId]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const leave = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest?.("a[href]");
      if (!link || link.getAttribute("href") === location.pathname + location.search) return;
      if (!window.confirm("Leave without saving your consumption changes?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", leave, true); };
  }, [dirty]);
  const save = useMutation({
    mutationFn: (input: ConsumptionProfileInput) => api.saveConsumptionProfile(projectId!, input),
    onSuccess: (saved) => {
      queryClient.setQueryData(["projects", projectId, "consumption"], saved);
      baseline.current = snapshot;
      setFormError(null);
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (mode === "annual") {
      const annual = Number(annualValue);
      if (annualValue === "" || !Number.isFinite(annual) || annual < 0) {
        setFormError("Enter a valid annual consumption value.");
        return;
      }
      save.mutate({ annual_consumption_kwh: annual, monthly_values: [] });
      return;
    }
    const monthly = monthlyValues.flatMap((value, index) => {
      if (value === "") return [];
      const consumptionKwh = Number(value);
      return Number.isFinite(consumptionKwh) && consumptionKwh >= 0
        ? [{ month: index + 1, consumption_kwh: consumptionKwh }]
        : [];
    });
    if (!monthly.length) {
      setFormError("Enter consumption for at least one month.");
      return;
    }
    save.mutate({ annual_consumption_kwh: null, monthly_values: monthly });
  }
  const knownValues = monthlyValues.filter((value) => value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0).map(Number);
  const knownMonths = knownValues.length;
  const knownTotal = knownValues.reduce((total, value) => total + value, 0);
  const annualKnown = annualValue !== "" && Number.isFinite(Number(annualValue)) && Number(annualValue) >= 0;
  const quality = mode === "annual" ? annualKnown ? "Annual total known" : "No data" : knownMonths === 12 ? "Complete profile" : knownMonths ? "Partial profile" : "No data";

  if (consumption.isPending) return <main className="workspace-page narrow-page"><div className="form-page-skeleton" role="status"><span className="sr-only">Loading consumption profile…</span></div></main>;
  if (consumption.isError) return <main className="workspace-page narrow-page"><div className="query-error"><div><strong>Consumption profile could not be loaded.</strong><p>Check the connection and try again.</p></div><button className="button button-secondary" onClick={() => consumption.refetch()}>Try again</button></div></main>;

  return <main className="workspace-page consumption-page consumption-redesign">
    <Link className="back-link" to={`/projects/${projectId}`}>← Project overview</Link>
    <header className="form-page-heading"><h1>Household consumption</h1><p>Enter your electricity usage to compare it with estimated solar production.</p><Link className="consumption-analysis-link" to={`/projects/${projectId}/analysis`}>Continue to production analysis <ArrowIcon /></Link></header>
    <div className="consumption-layout">
      <form className="consumption-form" onSubmit={submit}>
        {(formError || save.isError) && <div className="form-error" role="alert">{formError ?? (save.error instanceof Error ? save.error.message : "Consumption could not be saved.")}</div>}
        {save.isSuccess && !dirty && <div className="form-success" role="status">Consumption profile saved.</div>}
        <fieldset className="consumption-segmented"><legend className="sr-only">Consumption input method</legend>
          <label className={mode === "monthly" ? "is-selected" : ""}><input type="radio" name="consumption-mode" aria-label="Monthly values" disabled={save.isPending} checked={mode === "monthly"} onChange={() => setMode("monthly")} /><span>Monthly values</span></label>
          <label className={mode === "annual" ? "is-selected" : ""}><input type="radio" name="consumption-mode" aria-label="Annual total" disabled={save.isPending} checked={mode === "annual"} onChange={() => setMode("annual")} /><span>Annual total</span></label>
        </fieldset>
        {mode === "monthly" ? <fieldset className="form-section"><legend>Monthly consumption</legend><p className="section-copy">Values are in kWh. Leave unknown months empty; clear a saved value to remove that month.</p>
          <div className="consumption-month-grid">{months.map((month, index) => <label key={month}>{month}<span className="field-unit">kWh</span><input aria-label={`${month} consumption`} type="number" disabled={save.isPending} min="0" step="0.1" value={monthlyValues[index]} onChange={(event) => setMonthlyValues(monthlyValues.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} /></label>)}</div>
        </fieldset> : <fieldset className="form-section"><legend>Annual consumption</legend><p className="section-copy">Enter your known annual electricity consumption if monthly data is unavailable. No monthly values will be estimated.</p><label>Annual electricity consumption (kWh)<input type="number" disabled={save.isPending} min="0" step="0.1" value={annualValue} onChange={(event) => setAnnualValue(event.target.value)} required /></label></fieldset>}
        <section className="consumption-input-summary" aria-label="Input summary"><div className="consumption-summary-heading"><h2>Input summary</h2><span>{dirty ? "Unsaved changes" : ""}</span></div>
          <dl><div><dt>Status</dt><dd>{quality}</dd></div><div><dt>Months entered</dt><dd>{mode === "monthly" ? `${knownMonths}/12` : "Not provided"}</dd></div><div><dt>{mode === "annual" || knownMonths === 12 ? "Annual consumption" : "Sum of known months"}</dt><dd>{mode === "annual" ? annualKnown ? `${number.format(Number(annualValue))} kWh` : "Not known" : `${number.format(knownTotal)} kWh`}</dd></div>
          {mode === "monthly" && <div><dt>Monthly coverage</dt><dd>{number.format(knownMonths / 12 * 100)}%</dd></div>}
          {mode === "monthly" && knownMonths > 0 && <div><dt>Average known month</dt><dd>{number.format(knownTotal / knownMonths)} kWh</dd></div>}</dl>
          <p>{mode === "annual" ? "Annual total only. Monthly seasonality is not available." : knownMonths === 12 ? "Complete monthly profile. Annual consumption is the sum of all 12 months." : "Unknown months remain blank. This is the sum of known months, not an annual estimate."}</p>
        </section>
        <div className="form-actions"><Link className="button button-secondary" to={`/projects/${projectId}`}>Cancel</Link><button className="button button-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save consumption"}</button></div>
      </form>

    </div>
  </main>;
}
