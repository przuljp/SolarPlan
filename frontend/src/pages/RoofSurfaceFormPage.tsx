import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ArrowIcon } from "../components/Icons";
import { api } from "../lib/api";
import type { RoofSurfaceInput, RoofSurfaceShape } from "../types/api";

type SurfaceForm = {
  name: string;
  shape_type: RoofSurfaceShape;
  bottom_width_m: string;
  top_width_m: string;
  top_offset_m: string;
  length_m: string;
  tilt_deg: string;
  azimuth_deg: string;
  edge_margin_m: string;
  panel_gap_m: string;
};

const empty: SurfaceForm = {
  name: "",
  shape_type: "rectangle",
  bottom_width_m: "",
  top_width_m: "",
  top_offset_m: "0",
  length_m: "",
  tilt_deg: "",
  azimuth_deg: "",
  edge_margin_m: "0.3",
  panel_gap_m: "0.02",
};

export function RoofSurfaceFormPage() {
  const { projectId, surfaceId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SurfaceForm>(empty);
  const existing = useQuery({
    queryKey: ["projects", projectId, "roof-surfaces", surfaceId],
    queryFn: () => api.roofSurface(projectId!, surfaceId!),
    enabled: Boolean(surfaceId),
  });

  useEffect(() => {
    if (!existing.data) return;
    setForm({
      name: existing.data.name,
      shape_type: existing.data.shape_type,
      bottom_width_m: String(existing.data.bottom_width_m),
      top_width_m: String(existing.data.top_width_m),
      top_offset_m: String(existing.data.top_offset_m),
      length_m: String(existing.data.length_m),
      tilt_deg: String(existing.data.tilt_deg),
      azimuth_deg: String(existing.data.azimuth_deg),
      edge_margin_m: String(existing.data.edge_margin_m),
      panel_gap_m: String(existing.data.panel_gap_m),
    });
  }, [existing.data]);

  const save = useMutation({
    mutationFn: (input: RoofSurfaceInput) => surfaceId
      ? api.updateRoofSurface(projectId!, surfaceId, input)
      : api.createRoofSurface(projectId!, input),
    onSuccess: async (surface) => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "roof-surfaces"] });
      navigate(`/projects/${projectId}/roof-surfaces/${surface.id}/panels`);
    },
  });

  function setShape(shape_type: RoofSurfaceShape) {
    setForm((current) => ({
      ...current,
      shape_type,
      top_width_m: shape_type === "rectangle" ? current.bottom_width_m : current.top_width_m,
      top_offset_m: shape_type === "rectangle" ? "0" : current.top_offset_m,
    }));
  }

  function centerTopEdge() {
    const bottom = Number(form.bottom_width_m);
    const top = Number(form.top_width_m);
    if (Number.isFinite(bottom) && Number.isFinite(top) && bottom >= top) {
      setForm((current) => ({ ...current, top_offset_m: String((bottom - top) / 2) }));
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const input: RoofSurfaceInput = {
      name: form.name,
      shape_type: form.shape_type,
      bottom_width_m: Number(form.bottom_width_m),
      top_width_m: form.shape_type === "trapezoid"
        ? Number(form.top_width_m)
        : Number(form.bottom_width_m),
      top_offset_m: form.shape_type === "trapezoid" ? Number(form.top_offset_m) : 0,
      length_m: Number(form.length_m),
      tilt_deg: Number(form.tilt_deg),
      azimuth_deg: Number(form.azimuth_deg),
      edge_margin_m: Number(form.edge_margin_m),
      panel_gap_m: Number(form.panel_gap_m),
    };
    save.mutate(input);
  }

  const isTrapezoid = form.shape_type === "trapezoid";
  return (
    <main className="workspace-page narrow-page">
      <Link className="back-link" to={`/projects/${projectId}/roof-surfaces`}>← All roof surfaces</Link>
      <header className="form-page-heading">
        <h1>{surfaceId ? "Edit roof surface" : "Add a roof surface"}</h1>
        <p>Describe one roof plane along its slope. The selected shape controls which panel positions can physically fit.</p>
      </header>

      <form className="roof-form" onSubmit={submit}>
        {save.isError && <div className="form-error">{save.error instanceof Error ? save.error.message : "Surface could not be saved."}</div>}

        <fieldset className="form-section">
          <legend>Surface identity</legend>
          <label>Surface name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. South roof" required />
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend>Surface geometry</legend>
          <div className="shape-options" aria-label="Surface shape">
            <label className={form.shape_type === "rectangle" ? "is-selected" : ""}>
              <input type="radio" name="shape" checked={form.shape_type === "rectangle"} onChange={() => setShape("rectangle")} />
              <span><strong>Rectangle</strong><small>Equal width at the ridge and eave</small></span>
            </label>
            <label className={form.shape_type === "trapezoid" ? "is-selected" : ""}>
              <input type="radio" name="shape" checked={form.shape_type === "trapezoid"} onChange={() => setShape("trapezoid")} />
              <span><strong>Trapezoid</strong><small>Narrower edge near the ridge</small></span>
            </label>
          </div>

          {isTrapezoid ? (
            <>
              <div className="field-grid">
                <label>Bottom width <span className="field-unit">m</span>
                  <input type="number" min="0.01" step="any" value={form.bottom_width_m} onChange={(event) => setForm({ ...form, bottom_width_m: event.target.value })} required />
                </label>
                <label>Top width <span className="field-unit">m</span>
                  <input type="number" min="0.01" step="any" value={form.top_width_m} onChange={(event) => setForm({ ...form, top_width_m: event.target.value })} required />
                </label>
              </div>
              <div className="field-grid">
                <label>Top edge offset <span className="field-unit">m</span>
                  <input type="number" min="0" step="any" value={form.top_offset_m} onChange={(event) => setForm({ ...form, top_offset_m: event.target.value })} required />
                  <small>Horizontal distance from the bottom-left corner to the top-left corner.</small>
                </label>
                <div className="geometry-assist">
                  <strong>Symmetric roof plane?</strong>
                  <p>Center the shorter top edge automatically.</p>
                  <button className="text-link" type="button" onClick={centerTopEdge}>Center top edge</button>
                </div>
              </div>
            </>
          ) : (
            <div className="field-grid">
              <label>Surface width <span className="field-unit">m</span>
                <input type="number" min="0.01" step="any" value={form.bottom_width_m} onChange={(event) => setForm({ ...form, bottom_width_m: event.target.value, top_width_m: event.target.value })} required />
              </label>
              <label>Surface length <span className="field-unit">m</span>
                <input type="number" min="0.01" step="any" value={form.length_m} onChange={(event) => setForm({ ...form, length_m: event.target.value })} required />
              </label>
            </div>
          )}

          {isTrapezoid && (
            <label>Surface length <span className="field-unit">m</span>
              <input type="number" min="0.01" step="any" value={form.length_m} onChange={(event) => setForm({ ...form, length_m: event.target.value })} required />
            </label>
          )}

          <div className="field-grid">
            <label>Roof tilt <span className="field-unit">degrees</span>
              <input type="number" min="0" max="90" step="any" value={form.tilt_deg} onChange={(event) => setForm({ ...form, tilt_deg: event.target.value })} required />
            </label>
            <label>Compass azimuth <span className="field-unit">degrees</span>
              <input type="number" min="0" max="359.999" step="any" value={form.azimuth_deg} onChange={(event) => setForm({ ...form, azimuth_deg: event.target.value })} required />
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Layout clearances</legend>
          <div className="field-grid">
            <label>Edge margin <span className="field-unit">m</span>
              <input type="number" min="0" step="any" value={form.edge_margin_m} onChange={(event) => setForm({ ...form, edge_margin_m: event.target.value })} required />
            </label>
            <label>Panel gap <span className="field-unit">m</span>
              <input type="number" min="0" step="any" value={form.panel_gap_m} onChange={(event) => setForm({ ...form, panel_gap_m: event.target.value })} required />
            </label>
          </div>
        </fieldset>

        <div className="form-actions">
          <Link className="button button-secondary" to={`/projects/${projectId}/roof-surfaces`}>Cancel</Link>
          <button className="button button-primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : <>Save and choose panel <ArrowIcon /></>}
          </button>
        </div>
      </form>
    </main>
  );
}