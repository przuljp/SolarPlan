import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ArrowIcon } from "../components/Icons";
import { LocationPicker } from "../components/LocationPicker";
import { api, ApiError } from "../lib/api";
import type { ProjectLocationInput } from "../types/api";

export function ProjectLocationPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ lat: "", lon: "", location_label: "" });
  const location = useQuery({
    queryKey: ["projects", projectId, "location"],
    queryFn: async () => {
      try { return await api.projectLocation(projectId!); }
      catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
    },
  });
  useEffect(() => {
    if (location.data) setForm({ lat: String(location.data.lat), lon: String(location.data.lon), location_label: location.data.location_label ?? "" });
  }, [location.data]);
  const save = useMutation({
    mutationFn: (input: ProjectLocationInput) => api.saveProjectLocation(projectId!, input),
    onSuccess: async (saved) => {
      queryClient.setQueryData(["projects", projectId, "location"], saved);
      navigate(`/projects/${projectId}/roof-surfaces`);
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    const lat = Number(form.lat); const lon = Number(form.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    save.mutate({ lat, lon, location_label: form.location_label.trim() || null });
  }
  if (location.isPending) return <main className="workspace-page narrow-page"><div className="form-page-skeleton" /></main>;
  return <main className="workspace-page narrow-page">
    <Link className="back-link" to={`/projects/${projectId}`}>← Project overview</Link>
    <header className="form-page-heading"><h1>Set the project location</h1><p>Every roof surface shares this geographic point. Roof measurements are added separately in the next step.</p></header>
    <form className="roof-form" onSubmit={submit}>
      {save.isError && <div className="form-error" role="alert">{save.error instanceof Error ? save.error.message : "Location could not be saved."}</div>}
      <fieldset className="form-section"><legend>Property location</legend>
        <LocationPicker latitude={form.lat} longitude={form.lon} onLocationChange={(lat, lon, label) => setForm({ lat: String(lat), lon: String(lon), location_label: label ?? form.location_label })} />
        <label>Location label <span className="optional">Optional</span><input value={form.location_label} onChange={(e) => setForm({ ...form, location_label: e.target.value })} placeholder="e.g. Family house, Sarajevo" /></label>
        <div className="field-grid technical-fields">
          <label>Latitude <span className="field-unit">decimal degrees</span><input type="number" min="-90" max="90" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} required /></label>
          <label>Longitude <span className="field-unit">decimal degrees</span><input type="number" min="-180" max="180" step="any" value={form.lon} onChange={(e) => setForm({ ...form, lon: e.target.value })} required /></label>
        </div>
      </fieldset>
      <div className="form-actions"><Link className="button button-secondary" to={`/projects/${projectId}`}>Cancel</Link><button className="button button-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : <>Continue to roof surfaces <ArrowIcon /></>}</button></div>
    </form>
  </main>;
}
