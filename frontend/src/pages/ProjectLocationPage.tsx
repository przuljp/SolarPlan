import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { ArrowIcon } from "../components/Icons";
import { api, ApiError } from "../lib/api";
import type { RoofConfiguration, RoofConfigurationInput } from "../types/api";

type RoofFormState = Record<keyof RoofConfigurationInput, string>;

const emptyForm: RoofFormState = {
  width_m: "",
  length_m: "",
  tilt_deg: "",
  azimuth_deg: "",
  edge_margin_m: "",
  panel_gap_m: "",
  lat: "",
  lon: "",
  location_label: "",
};

function toFormState(configuration: RoofConfiguration): RoofFormState {
  return {
    width_m: String(configuration.width_m),
    length_m: String(configuration.length_m),
    tilt_deg: String(configuration.tilt_deg),
    azimuth_deg: String(configuration.azimuth_deg),
    edge_margin_m: String(configuration.edge_margin_m),
    panel_gap_m: String(configuration.panel_gap_m),
    lat: String(configuration.lat),
    lon: String(configuration.lon),
    location_label: configuration.location_label ?? "",
  };
}

export function ProjectLocationPage() {
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RoofFormState>(emptyForm);
  const [hasLoadedForm, setHasLoadedForm] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const roof = useQuery({
    queryKey: ["projects", projectId, "roof"],
    queryFn: async () => {
      try {
        return await api.roofConfiguration(projectId!);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 404) return null;
        throw caught;
      }
    },
    enabled: Boolean(projectId),
  });

  useEffect(() => {
    if (!roof.isSuccess || hasLoadedForm) return;
    setForm(roof.data ? toFormState(roof.data) : emptyForm);
    setHasLoadedForm(true);
  }, [hasLoadedForm, roof.data, roof.isSuccess]);

  const mutation = useMutation({
    mutationFn: (input: RoofConfigurationInput) =>
      api.saveRoofConfiguration(projectId!, input),
    onSuccess: (saved) => {
      queryClient.setQueryData(["projects", projectId, "roof"], saved);
      setForm(toFormState(saved));
      setError("");
      setSavedMessage("Location and roof measurements saved.");
    },
    onError: (caught) => {
      setSavedMessage("");
      setError(
        caught instanceof ApiError
          ? caught.message
          : "The roof setup could not be saved. Please try again.",
      );
    },
  });

  function updateField(field: keyof RoofFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setSavedMessage("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSavedMessage("");

    const input: RoofConfigurationInput = {
      width_m: Number(form.width_m),
      length_m: Number(form.length_m),
      tilt_deg: Number(form.tilt_deg),
      azimuth_deg: Number(form.azimuth_deg),
      edge_margin_m: Number(form.edge_margin_m),
      panel_gap_m: Number(form.panel_gap_m),
      lat: Number(form.lat),
      lon: Number(form.lon),
      location_label: form.location_label.trim() || null,
    };

    const numericValues = Object.entries(input)
      .filter(([field]) => field !== "location_label")
      .map(([, value]) => value as number);
    if (numericValues.some((value) => !Number.isFinite(value))) {
      setError("Enter a valid number in every measurement and coordinate field.");
      return;
    }
    if (input.edge_margin_m * 2 >= Math.min(input.width_m, input.length_m)) {
      setError("The edge margin must leave usable space inside both roof dimensions.");
      return;
    }

    mutation.mutate(input);
  }

  if (roof.isPending) {
    return (
      <main className="workspace-page narrow-page">
        <div className="form-page-skeleton" role="status" aria-live="polite">
          <span className="sr-only">Loading roof setup…</span>
        </div>
      </main>
    );
  }

  if (roof.isError) {
    return (
      <main className="workspace-page narrow-page">
        <div className="query-error" role="alert">
          <div>
            <strong>We could not load this roof setup.</strong>
            <p>Check that the SolarPlan API is running, then try again.</p>
          </div>
          <button className="button button-secondary button-small" type="button" onClick={() => roof.refetch()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="workspace-page narrow-page">
      <Link className="back-link" to={`/projects/${projectId}`}>← Project overview</Link>
      <header className="form-page-heading">
        <h1>Describe the roof you can actually use.</h1>
        <p>
          Enter the property coordinates and the usable rectangular roof plane. These
          measurements will later drive panel layout and energy estimates.
        </p>
      </header>

      <form className="roof-form" onSubmit={submit}>
        <div className="form-note">
          <strong>Manual coordinates for now</strong>
          <p>The map will be added next. Until then, enter latitude and longitude in decimal degrees.</p>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        {savedMessage && <div className="form-success" role="status">{savedMessage}</div>}

        <fieldset className="form-section">
          <legend>Property location</legend>
          <p className="section-copy">Coordinates identify the calculation point. The label is only a readable description.</p>
          <label>
            Location label <span className="optional">Optional</span>
            <input
              value={form.location_label}
              onChange={(event) => updateField("location_label", event.target.value)}
              maxLength={500}
              placeholder="e.g. Family house, Sarajevo"
              autoComplete="street-address"
            />
          </label>
          <div className="field-grid technical-fields">
            <label>
              Latitude <span className="field-unit">decimal degrees</span>
              <input
                type="number"
                inputMode="decimal"
                min="-90"
                max="90"
                step="any"
                value={form.lat}
                onChange={(event) => updateField("lat", event.target.value)}
                placeholder="43.8563"
                required
              />
              <small>Valid range: −90 to 90.</small>
            </label>
            <label>
              Longitude <span className="field-unit">decimal degrees</span>
              <input
                type="number"
                inputMode="decimal"
                min="-180"
                max="180"
                step="any"
                value={form.lon}
                onChange={(event) => updateField("lon", event.target.value)}
                placeholder="18.4131"
                required
              />
              <small>Valid range: −180 to 180.</small>
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Usable roof plane</legend>
          <p className="section-copy">Measure the usable surface along the roof plane, not the horizontal building footprint.</p>
          <div className="field-grid">
            <label>
              Usable roof width <span className="field-unit">m</span>
              <input type="number" inputMode="decimal" min="0.01" step="any" value={form.width_m} onChange={(event) => updateField("width_m", event.target.value)} placeholder="8.4" required />
            </label>
            <label>
              Usable roof length <span className="field-unit">m</span>
              <input type="number" inputMode="decimal" min="0.01" step="any" value={form.length_m} onChange={(event) => updateField("length_m", event.target.value)} placeholder="11.2" required />
            </label>
          </div>
          <div className="field-grid">
            <label>
              Roof tilt <span className="field-unit">degrees</span>
              <input type="number" inputMode="decimal" min="0" max="90" step="any" value={form.tilt_deg} onChange={(event) => updateField("tilt_deg", event.target.value)} placeholder="32" required />
              <small>0° is flat; 90° is vertical.</small>
            </label>
            <label>
              Compass azimuth <span className="field-unit">degrees</span>
              <input type="number" inputMode="decimal" min="0" max="359.999" step="any" value={form.azimuth_deg} onChange={(event) => updateField("azimuth_deg", event.target.value)} placeholder="180" required />
              <small>0° north · 90° east · 180° south · 270° west.</small>
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Layout clearances</legend>
          <p className="section-copy">These clearances reduce the area available to the future panel layout.</p>
          <div className="field-grid">
            <label>
              Edge margin <span className="field-unit">m</span>
              <input type="number" inputMode="decimal" min="0" step="any" value={form.edge_margin_m} onChange={(event) => updateField("edge_margin_m", event.target.value)} placeholder="0.3" required />
              <small>Reserved space along every roof edge.</small>
            </label>
            <label>
              Panel gap <span className="field-unit">m</span>
              <input type="number" inputMode="decimal" min="0" step="any" value={form.panel_gap_m} onChange={(event) => updateField("panel_gap_m", event.target.value)} placeholder="0.02" required />
              <small>Spacing between neighbouring panels.</small>
            </label>
          </div>
        </fieldset>

        <div className="form-actions">
          <Link className="button button-secondary" to={`/projects/${projectId}`}>Cancel</Link>
          <button className="button button-primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <><span className="button-spinner" />Saving…</> : <>Save roof setup<ArrowIcon /></>}
          </button>
        </div>
      </form>
    </main>
  );
}
