import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ArrowIcon } from "../components/Icons";
import { api } from "../lib/api";
import type { RoofSurfaceInput } from "../types/api";

const empty = { name: "", width_m: "", length_m: "", tilt_deg: "", azimuth_deg: "", edge_margin_m: "0.3", panel_gap_m: "0.02" };
export function RoofSurfaceFormPage() {
  const { projectId, surfaceId } = useParams(); const navigate = useNavigate(); const qc = useQueryClient();
  const [form, setForm] = useState(empty); const existing = useQuery({ queryKey: ["projects", projectId, "roof-surfaces", surfaceId], queryFn: () => api.roofSurface(projectId!, surfaceId!), enabled: Boolean(surfaceId) });
  useEffect(() => { if (existing.data) setForm({ name: existing.data.name, width_m: String(existing.data.width_m), length_m: String(existing.data.length_m), tilt_deg: String(existing.data.tilt_deg), azimuth_deg: String(existing.data.azimuth_deg), edge_margin_m: String(existing.data.edge_margin_m), panel_gap_m: String(existing.data.panel_gap_m) }); }, [existing.data]);
  const save = useMutation({ mutationFn: (input: RoofSurfaceInput) => surfaceId ? api.updateRoofSurface(projectId!, surfaceId, input) : api.createRoofSurface(projectId!, input), onSuccess: async (surface) => { await qc.invalidateQueries({ queryKey: ["projects", projectId, "roof-surfaces"] }); navigate(`/projects/${projectId}/roof-surfaces/${surface.id}/panels`); } });
  function submit(e: FormEvent) { e.preventDefault(); const input: RoofSurfaceInput = { name: form.name, width_m: Number(form.width_m), length_m: Number(form.length_m), tilt_deg: Number(form.tilt_deg), azimuth_deg: Number(form.azimuth_deg), edge_margin_m: Number(form.edge_margin_m), panel_gap_m: Number(form.panel_gap_m) }; save.mutate(input); }
  return <main className="workspace-page narrow-page"><Link className="back-link" to={`/projects/${projectId}/roof-surfaces`}>← All roof surfaces</Link><header className="form-page-heading"><h1>{surfaceId ? "Edit roof surface" : "Add a roof surface"}</h1><p>Measure this usable plane along the slope. Its direction and clearances affect only this surface.</p></header>
    <form className="roof-form" onSubmit={submit}>{save.isError && <div className="form-error">{save.error instanceof Error ? save.error.message : "Surface could not be saved."}</div>}
      <fieldset className="form-section"><legend>Surface identity</legend><label>Surface name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. South roof" required /></label></fieldset>
      <fieldset className="form-section"><legend>Geometry</legend><div className="field-grid"><label>Usable width <span className="field-unit">m</span><input type="number" min="0.01" step="any" value={form.width_m} onChange={(e) => setForm({ ...form, width_m: e.target.value })} required /></label><label>Usable length <span className="field-unit">m</span><input type="number" min="0.01" step="any" value={form.length_m} onChange={(e) => setForm({ ...form, length_m: e.target.value })} required /></label></div><div className="field-grid"><label>Roof tilt <span className="field-unit">degrees</span><input type="number" min="0" max="90" step="any" value={form.tilt_deg} onChange={(e) => setForm({ ...form, tilt_deg: e.target.value })} required /></label><label>Compass azimuth <span className="field-unit">degrees</span><input type="number" min="0" max="359.999" step="any" value={form.azimuth_deg} onChange={(e) => setForm({ ...form, azimuth_deg: e.target.value })} required /></label></div></fieldset>
      <fieldset className="form-section"><legend>Layout clearances</legend><div className="field-grid"><label>Edge margin <span className="field-unit">m</span><input type="number" min="0" step="any" value={form.edge_margin_m} onChange={(e) => setForm({ ...form, edge_margin_m: e.target.value })} required /></label><label>Panel gap <span className="field-unit">m</span><input type="number" min="0" step="any" value={form.panel_gap_m} onChange={(e) => setForm({ ...form, panel_gap_m: e.target.value })} required /></label></div></fieldset>
      <div className="form-actions"><Link className="button button-secondary" to={`/projects/${projectId}/roof-surfaces`}>Cancel</Link><button className="button button-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : <>Save and choose panel <ArrowIcon /></>}</button></div>
    </form></main>;
}
