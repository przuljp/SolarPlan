import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
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
  useEffect(() => {
    if (!consumption.data) return;
    if (consumption.data.profile_kind === "annual_only") {
      setMode("annual");
      setAnnualValue(String(consumption.data.annual_consumption_kwh ?? ""));
      return;
    }
    setMode("monthly");
    const values = Array(12).fill("") as string[];
    consumption.data.monthly_values.forEach((item) => { values[item.month - 1] = String(item.consumption_kwh); });
    setMonthlyValues(values);
  }, [consumption.data]);
  const save = useMutation({
    mutationFn: (input: ConsumptionProfileInput) => api.saveConsumptionProfile(projectId!, input),
    onSuccess: (saved) => {
      queryClient.setQueryData(["projects", projectId, "consumption"], saved);
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
  const profile = save.data ?? consumption.data;

  if (consumption.isPending) return <main className="workspace-page narrow-page"><div className="form-page-skeleton" role="status"><span className="sr-only">Loading consumption profile…</span></div></main>;
  if (consumption.isError) return <main className="workspace-page narrow-page"><div className="query-error"><div><strong>Consumption profile could not be loaded.</strong><p>Check the connection and try again.</p></div><button className="button button-secondary" onClick={() => consumption.refetch()}>Try again</button></div></main>;

  return <main className="workspace-page consumption-page">
    <Link className="back-link" to={`/projects/${projectId}`}>← Project overview</Link>
    <header className="form-page-heading"><h1>Household energy consumption</h1><p>Add the values you know. Partial monthly data remains clearly marked and is never multiplied into an invented annual estimate.</p></header>
    <div className="consumption-layout">
      <form className="consumption-form" onSubmit={submit}>
        {(formError || save.isError) && <div className="form-error" role="alert">{formError ?? (save.error instanceof Error ? save.error.message : "Consumption could not be saved.")}</div>}
        {save.isSuccess && <div className="form-success" role="status">Consumption profile saved.</div>}
        <fieldset className="form-section consumption-mode"><legend>How do you want to enter consumption?</legend>
          <label><input type="radio" name="consumption-mode" checked={mode === "monthly"} onChange={() => setMode("monthly")} /><span><strong>Monthly values</strong><small>Enter any known calendar months.</small></span></label>
          <label><input type="radio" name="consumption-mode" checked={mode === "annual"} onChange={() => setMode("annual")} /><span><strong>Annual total</strong><small>Use this only when the monthly distribution is unknown.</small></span></label>
        </fieldset>
        {mode === "monthly" ? <fieldset className="form-section"><legend>Monthly consumption</legend><p className="section-copy">Values are in kWh. Leave unknown months empty; clear a saved value to remove that month.</p>
          <div className="consumption-month-grid">{months.map((month, index) => <label key={month}>{month}<span className="field-unit">kWh</span><input aria-label={`${month} consumption`} type="number" min="0" step="0.1" value={monthlyValues[index]} onChange={(event) => setMonthlyValues(monthlyValues.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} /></label>)}</div>
        </fieldset> : <fieldset className="form-section"><legend>Annual consumption</legend><p className="section-copy">This records the known annual total without inventing monthly values.</p><label>Annual consumption <span className="field-unit">kWh/year</span><input type="number" min="0" step="0.1" value={annualValue} onChange={(event) => setAnnualValue(event.target.value)} required /></label></fieldset>}
        <div className="form-actions"><Link className="button button-secondary" to={`/projects/${projectId}`}>Cancel</Link><button className="button button-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save consumption"}</button></div>
      </form>
      <aside className="content-panel consumption-summary">
        <h2>{profile ? "Saved profile" : "Data quality"}</h2>
        {profile ? <><dl><div><dt>Known consumption</dt><dd>{number.format(profile.total_known_consumption_kwh)} kWh</dd></div><div><dt>Known months</dt><dd>{profile.known_months} of 12</dd></div><div><dt>Monthly coverage</dt><dd>{profile.coverage_percent}%</dd></div><div><dt>Average known month</dt><dd>{profile.average_known_monthly_kwh === null ? "N/A" : `${number.format(profile.average_known_monthly_kwh)} kWh`}</dd></div></dl><p>{profile.profile_kind === "complete_monthly" ? "Complete monthly profile. Annual consumption is the sum of all 12 months." : profile.profile_kind === "annual_only" ? "Annual total is known, but monthly seasonality is not available." : "Partial monthly profile. No annual total is inferred from missing months."}</p></> : <p>Save one or more months for a partial profile, all 12 months for a complete profile, or a known annual total.</p>}
        <Link className="button button-secondary button-full" to={`/projects/${projectId}/analysis`}>Continue to production analysis <ArrowIcon /></Link>
      </aside>
    </div>
  </main>;
}
