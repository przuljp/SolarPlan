import { useState } from "react";

import { api } from "../lib/api";

export function SimulationReportActions({ projectId, simulationId }: { projectId: string; simulationId: string }) {
  const [pending, setPending] = useState<"pdf" | "csv" | null>(null);
  const [error, setError] = useState("");

  async function download(format: "pdf" | "csv") {
    setPending(format);
    setError("");
    try {
      await api.downloadSimulationReport(projectId, simulationId, format);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The report could not be downloaded. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return <section className="simulation-report" aria-label="Download simulation report">
    <div className="simulation-report-row">
      <div><h2>Export this simulation</h2><p>Saved production, system inputs and assumptions. PDF for sharing, CSV for spreadsheets.</p></div>
      <div className="simulation-report-buttons">
        <button className="button button-secondary" type="button" disabled={pending !== null} onClick={() => download("pdf")}>{pending === "pdf" ? "Preparing PDF…" : "Download PDF"}</button>
        <button className="button button-secondary" type="button" disabled={pending !== null} onClick={() => download("csv")}>{pending === "csv" ? "Preparing CSV…" : "Download CSV"}</button>
      </div>
    </div>
    {pending && <p className="sr-only" role="status">Preparing your {pending.toUpperCase()} report…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
