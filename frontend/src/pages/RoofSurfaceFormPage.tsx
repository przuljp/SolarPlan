import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ArrowIcon } from "../components/Icons";
import { RoofPositionFields } from "../components/RoofPositionFields";
import { RoofShapeChoices } from "../components/RoofShapeChoices";
import { api } from "../lib/api";
import { ROOF_LAYOUT_DEFAULTS } from "../lib/roof-defaults";
import type { RoofSurface, RoofSurfaceInput, RoofSurfaceShape } from "../types/api";

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
  edge_margin_m: String(ROOF_LAYOUT_DEFAULTS.edge_margin_m),
  panel_gap_m: String(ROOF_LAYOUT_DEFAULTS.panel_gap_m),
};

export function RoofSurfaceFormPage() {
  const { projectId, surfaceId } = useParams();
  const existing = useQuery({
    queryKey: ["projects", projectId, "roof-surfaces", surfaceId],
    queryFn: () => api.roofSurface(projectId!, surfaceId!),
    enabled: Boolean(surfaceId),
  });

  if (surfaceId && existing.isPending) return <main className="workspace-page"><p role="status">Loading roof surface…</p></main>;
  if (surfaceId && existing.isError) return <main className="workspace-page"><div className="query-error" role="alert"><strong>The roof surface could not be loaded.</strong><button className="button button-secondary" onClick={() => existing.refetch()}>Try again</button><Link to={`/projects/${projectId}/roof-surfaces`}>Return to roof surfaces</Link></div></main>;
  return <RoofSurfaceEditor key={`${projectId}/${surfaceId ?? "new"}`} existing={surfaceId ? existing.data : undefined} />;
}

function RoofSurfaceEditor({ existing }: { existing?: RoofSurface }) {
  const { projectId, surfaceId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Initialize once per surface; background refetches must not overwrite an explicit choice.
  const [form, setForm] = useState<SurfaceForm>(() => existing ? {
    name: existing.name,
    shape_type: existing.shape_type,
    bottom_width_m: String(existing.bottom_width_m),
    top_width_m: String(existing.top_width_m),
    top_offset_m: String(existing.top_offset_m),
    length_m: String(existing.length_m),
    tilt_deg: String(existing.tilt_deg),
    azimuth_deg: String(existing.azimuth_deg),
    edge_margin_m: String(existing.edge_margin_m),
    panel_gap_m: String(existing.panel_gap_m),
  } : empty);
  const [savedPosition] = useState(() => existing ? { azimuth: existing.azimuth_deg, tilt: existing.tilt_deg } : undefined);
  const [savedGeometry] = useState(() => existing?.shape_type === "trapezoid" ? {
    bottom: existing.bottom_width_m,
    top: existing.top_width_m,
    offset: existing.top_offset_m,
    asymmetric: Math.abs(existing.top_offset_m - (existing.bottom_width_m - existing.top_width_m) / 2) > 1e-9,
  } : undefined);
  const isTrapezoid = form.shape_type === "trapezoid";
  const showSavedOffset = isTrapezoid && savedGeometry?.asymmetric === true;
  const sameSavedWidths = savedGeometry && Number(form.bottom_width_m) === savedGeometry.bottom && Number(form.top_width_m) === savedGeometry.top;
  const topOffset = showSavedOffset ? Number(form.top_offset_m)
    : sameSavedWidths ? savedGeometry.offset
    : (Number(form.bottom_width_m) - Number(form.top_width_m)) / 2;

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
    setForm((current) => ({ ...current, shape_type }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) return;
    const input: RoofSurfaceInput = {
      name: form.name,
      shape_type: form.shape_type,
      bottom_width_m: Number(form.bottom_width_m),
      top_width_m: form.shape_type === "trapezoid"
        ? Number(form.top_width_m)
        : Number(form.bottom_width_m),
      top_offset_m: isTrapezoid ? topOffset : 0,
      length_m: Number(form.length_m),
      tilt_deg: Number(form.tilt_deg),
      azimuth_deg: Number(form.azimuth_deg),
      edge_margin_m: Number(form.edge_margin_m),
      panel_gap_m: Number(form.panel_gap_m),
    };
    save.mutate(input);
  }

  return (
    <main className="workspace-page narrow-page">
      <Link className="back-link" to={`/projects/${projectId}/roof-surfaces`}>← All roof surfaces</Link>
      <header className="form-page-heading">
        <h1>{surfaceId ? "Edit roof surface" : "Add a roof surface"}</h1>
        <p>Describe one roof plane along its slope. The selected shape controls which panel positions can physically fit.</p>
      </header>

      <form className="roof-form" onSubmit={submit}>
        {save.isError && <div className="form-error" role="alert">{save.error instanceof Error ? save.error.message : "Surface could not be saved."}</div>}

        <fieldset className="form-section">
          <legend>Surface identity</legend>
          <label>Surface name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. South roof" required />
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend>Roof Surface Dimensions</legend>
          <RoofShapeChoices shape={form.shape_type} onChange={setShape} />

          {isTrapezoid ? (
            <>
              <div className="field-grid">
                <label>Bottom width <span className="field-unit">m</span>
                  <input type="number" min="0.01" step="any" placeholder="e.g. 10" value={form.bottom_width_m} onChange={(event) => setForm({ ...form, bottom_width_m: event.target.value })} required />
                </label>
                <label>Top width <span className="field-unit">m</span>
                  <input type="number" min="0.01" step="any" max={form.bottom_width_m || undefined} placeholder="e.g. 6" value={form.top_width_m} onChange={(event) => setForm({ ...form, top_width_m: event.target.value })} required />
                </label>
              </div>
            </>
          ) : (
            <div className="field-grid">
              <label>Surface width <span className="field-unit">m</span>
                <input type="number" min="0.01" step="any" placeholder="e.g. 8" value={form.bottom_width_m} onChange={(event) => setForm({ ...form, bottom_width_m: event.target.value, top_width_m: event.target.value })} required />
              </label>
              <label>Surface length <span className="field-unit">m</span>
                <input type="number" min="0.01" step="any" placeholder="e.g. 6" value={form.length_m} onChange={(event) => setForm({ ...form, length_m: event.target.value })} required />
              </label>
            </div>
          )}

          {isTrapezoid && (
            <label>Surface length <span className="field-unit">m</span>
              <input type="number" min="0.01" step="any" placeholder="e.g. 6" value={form.length_m} onChange={(event) => setForm({ ...form, length_m: event.target.value })} required />
            </label>
          )}
          <p className="section-copy geometry-measure-note">Measure the actual roof surface along its slope, not the dimensions of the entire house.</p>
          {showSavedOffset && <label className="saved-geometry-offset">Saved top edge offset <span className="field-unit">m</span>
            <input type="number" min="0" max={Number(form.bottom_width_m) - Number(form.top_width_m)} step="any" value={form.top_offset_m} onChange={(event) => setForm({ ...form, top_offset_m: event.target.value })} required />
            <small>This saved surface is asymmetric. Its offset is kept unless you edit it; changing other fields will not center it.</small>
          </label>}
          <p className="geometry-layout-note">{surfaceId ? "Saved layout spacing is preserved." : "Layout spacing is set automatically."} Edge margin: {form.edge_margin_m} m; panel gap: {form.panel_gap_m} m. These are preliminary planning assumptions, not universal safety standards.</p>
        </fieldset>

        <RoofPositionFields azimuth={form.azimuth_deg} tilt={form.tilt_deg}
          savedAzimuth={savedPosition?.azimuth} savedTilt={savedPosition?.tilt}
          onAzimuthChange={(azimuth_deg) => setForm((current) => ({ ...current, azimuth_deg }))}
          onTiltChange={(tilt_deg) => setForm((current) => ({ ...current, tilt_deg }))} />

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
