import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";

function renderApp(route = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[route]}><AuthProvider><App /></AuthProvider></MemoryRouter></QueryClientProvider>);
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const user = { id: "u1", full_name: "Milan Petrovic", email: "milan@example.com", created_at: "2026-10-26T10:00:00Z", updated_at: "2026-10-26T10:00:00Z" };

describe("SolarPlan application routes", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  test("renders the public introduction", () => {
    renderApp();
    expect(screen.getByRole("heading", { name: /understand what solar could mean for your roof/i })).toBeInTheDocument();
  });

  test("redirects signed-out visitors", async () => {
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: /open your workspace/i })).toBeInTheDocument();
  });

  test("shows the real project status on the overview", async () => {
    const projects = [{ id: "p1", name: "Family house", description: null, status: "analyzed", created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-04T10:00:00Z" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(user)).mockResolvedValueOnce(json(projects)));
    sessionStorage.setItem("solarplan.access_token", "test-token");

    renderApp("/dashboard");

    expect(await screen.findByText("Family house")).toBeInTheDocument();
    expect(screen.getByText("Analyzed")).toBeInTheDocument();
    expect(screen.queryByText("Setup")).not.toBeInTheDocument();
  });

  test("reveals trapezoid dimensions when the shape changes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(user)));
    sessionStorage.setItem("solarplan.access_token", "test-token");
    renderApp("/projects/p1/roof-surfaces/new");
    expect(await screen.findByRole("heading", { name: /add a roof surface/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/top width/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /trapezoid/i }));
    expect(screen.getByLabelText(/top width/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/top edge offset/i)).toBeInTheDocument();
  });
  test("shows the split project location form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(user)).mockResolvedValueOnce(new Response(null, { status: 404 })));
    sessionStorage.setItem("solarplan.access_token", "test-token");
    renderApp("/projects/p1/location");
    expect(await screen.findByRole("heading", { name: /set the project location/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/usable roof width/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue to roof surfaces/i })).toBeInTheDocument();
  });

  test("summarizes multiple roof surfaces and their layouts", async () => {
    const panel = { id: "panel1", manufacturer: "LONGi", model_sku: "LR5-54HTH-435M", power_wp: 435 };
    const layout = { id: "l1", project_id: "p1", roof_surface_id: "s1", solar_panel_id: "panel1", solar_panel: panel, panel_count: 12, installed_kwp: 5.22 };
    const surfaces = [
      { id: "s1", project_id: "p1", name: "South roof", shape_type: "rectangle", bottom_width_m: 8, top_width_m: 8, top_offset_m: 0, length_m: 6, tilt_deg: 30, azimuth_deg: 180, edge_margin_m: .3, panel_gap_m: .02, panel_layout: layout, created_at: "", updated_at: "" },
      { id: "s2", project_id: "p1", name: "West roof", shape_type: "trapezoid", bottom_width_m: 5, top_width_m: 3, top_offset_m: 1, length_m: 4, tilt_deg: 28, azimuth_deg: 270, edge_margin_m: .3, panel_gap_m: .02, panel_layout: null, created_at: "", updated_at: "" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(user)).mockResolvedValueOnce(json(surfaces)));
    sessionStorage.setItem("solarplan.access_token", "test-token");
    renderApp("/projects/p1/roof-surfaces");
    expect(await screen.findByRole("heading", { name: "Roof surfaces" })).toBeInTheDocument();
    expect(screen.getByText("South roof")).toBeInTheDocument();
    expect(screen.getByText("West roof")).toBeInTheDocument();
    expect(screen.getByText(/12 panels · 5.22 kWp total/i)).toBeInTheDocument();
  });

  test("keeps roof management available when a project is ready for analysis", async () => {
    const project = { id: "p1", name: "Family house", description: null, status: "analyzed", created_at: "", updated_at: "" };
    const location = { id: "loc1", project_id: "p1", lat: 43.8563, lon: 18.4131, location_label: "Sarajevo", created_at: "", updated_at: "" };
    const panel = { id: "panel1", manufacturer: "LONGi", model_sku: "LR5-54HTH-435M", power_wp: 435 };
    const layout = { id: "l1", project_id: "p1", roof_surface_id: "s1", solar_panel_id: "panel1", solar_panel: panel, panel_count: 12, installed_kwp: 5.22 };
    const surfaces = [{ id: "s1", project_id: "p1", name: "South roof", shape_type: "rectangle", bottom_width_m: 8, top_width_m: 8, top_offset_m: 0, length_m: 6, tilt_deg: 30, azimuth_deg: 180, edge_margin_m: .3, panel_gap_m: .02, panel_layout: layout, created_at: "", updated_at: "" }];
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return Promise.resolve(json(user));
      if (url.endsWith("/projects/p1/location")) return Promise.resolve(json(location));
      if (url.endsWith("/projects/p1/roof-surfaces")) return Promise.resolve(json(surfaces));
      if (url.endsWith("/projects/p1")) return Promise.resolve(json(project));
      return Promise.resolve(new Response(null, { status: 404 }));
    }));
    sessionStorage.setItem("solarplan.access_token", "test-token");

    renderApp("/projects/p1");

    expect(await screen.findByRole("heading", { name: "Family house" })).toBeInTheDocument();
    expect(screen.getByText("Analyzed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage roof surfaces/i })).toHaveAttribute("href", "/projects/p1/roof-surfaces");
    expect(screen.getByRole("link", { name: /view production analysis/i })).toHaveAttribute("href", "/projects/p1/analysis");
    expect(screen.getByRole("link", { name: /simulation history/i })).toHaveAttribute("href", "/projects/p1/simulations");
  });

  test("runs and displays a complete production analysis", async () => {
    const monthly_results = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, energy_kwh: 1000 + index * 25 }));
    const simulation = {
      id: "sim1", project_id: "p1", provider_version: "5.3", method_version: "solarplan-pvgis-v1",
      system_loss_percent: 14, installed_kwp: 10.44, annual_kwh: 13250,
      specific_yield_kwh_per_kwp: 1269, input_snapshot: {}, monthly_results,
      surface_results: [{
        roof_surface_id: "s1", name: "South roof", installed_kwp: 10.44, tilt_deg: 30,
        azimuth_deg: 180, pvgis_aspect: 0, annual_kwh: 13250,
        specific_yield_kwh_per_kwp: 1269, monthly_results,
      }],
      created_at: "2026-11-03T12:00:00Z",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(user))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(json(simulation, 201));
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.setItem("solarplan.access_token", "test-token");
    renderApp("/projects/p1/analysis");
    expect(await screen.findByRole("heading", { name: /no production analysis yet/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /run first analysis/i }));
    expect((await screen.findAllByText("13,250")).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /contribution by roof surface/i })).toBeInTheDocument();
    expect(screen.getByText("South roof")).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({ system_loss_percent: 14 });
  });

  test("reveals, validates and submits a manual system-loss value", async () => {
    const monthly_results = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, energy_kwh: 900 + index * 20 }));
    const simulation = {
      id: "sim-custom", project_id: "p1", provider_version: "5.3", method_version: "solarplan-pvgis-v1",
      system_loss_percent: 9.5, installed_kwp: 8.7, annual_kwh: 11100,
      specific_yield_kwh_per_kwp: 1275.86, input_snapshot: {}, monthly_results,
      surface_results: [{
        roof_surface_id: "s1", name: "South roof", installed_kwp: 8.7, tilt_deg: 30,
        azimuth_deg: 180, pvgis_aspect: 0, annual_kwh: 11100,
        specific_yield_kwh_per_kwp: 1275.86, monthly_results,
      }],
      created_at: "2026-11-04T12:00:00Z",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(user))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(json(simulation, 201));
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.setItem("solarplan.access_token", "test-token");

    renderApp("/projects/p1/analysis");
    expect(await screen.findByRole("heading", { name: /no production analysis yet/i })).toBeInTheDocument();
    expect(screen.getByText(/system losses are the energy lost during solar system operation/i)).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: /loss percentage/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /manually adjust system losses/i }));
    const input = screen.getByRole("spinbutton", { name: /loss percentage/i });
    fireEvent.change(input, { target: { value: "31" } });
    expect(screen.getByText(/enter a value from 0% to 30%/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^run analysis$/i })).toBeDisabled();

    fireEvent.change(input, { target: { value: "9.5" } });
    expect(screen.getByRole("button", { name: /^run analysis$/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /^run analysis$/i }));

    expect((await screen.findAllByText("11,100")).length).toBeGreaterThan(0);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({ system_loss_percent: 9.5 });
  });

  test("saves an annual household consumption profile", async () => {
    const profile = {
      id: "c1", project_id: "p1", source: "manual", annual_consumption_kwh: 4800,
      monthly_values: [], known_months: 0, total_known_consumption_kwh: 4800,
      average_known_monthly_kwh: null, coverage_percent: 0, profile_kind: "annual_only",
      created_at: "2026-11-03T12:00:00Z", updated_at: "2026-11-03T12:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json(user))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(json(profile)));
    sessionStorage.setItem("solarplan.access_token", "test-token");
    renderApp("/projects/p1/consumption");
    expect(await screen.findByRole("heading", { name: /household energy consumption/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /annual total/i }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /annual consumption/i }), { target: { value: "4800" } });
    fireEvent.click(screen.getByRole("button", { name: /save consumption/i }));
    expect(await screen.findByRole("heading", { name: /saved profile/i })).toBeInTheDocument();
    expect(screen.getByText("4,800 kWh")).toBeInTheDocument();
  });

  test("shows a saved configuration optimization ranking", async () => {
    const panel = {
      id: "panel1", manufacturer: "LONGi", model_sku: "LR5-54HTH-435M", category: "compact",
      power_wp: 435, width_mm: 1134, length_mm: 1722, thickness_mm: 30,
      efficiency_percent: 22.3, cell_technology: "N-type monocrystalline",
      temperature_coefficient_pmax: -0.29, datasheet_url: "https://example.com/datasheet",
      bih_source_name: "BiH supplier", bih_source_url: "https://example.com/listing",
      verified_at: "2026-10-26", created_at: "2026-10-26T10:00:00Z", updated_at: "2026-10-26T10:00:00Z",
    };
    const candidate = {
      candidate_id: "candidate0000001", rank: 1, recommended: true, panel,
      total_panel_count: 12, installed_kwp: 5.22, occupied_area_m2: 23.43,
      annual_kwh: 6450, specific_yield_kwh_per_kwp: 1235.6,
      target_difference_kwh: null, target_coverage_percent: null,
      monthly_results: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, energy_kwh: 500 })),
      surfaces: [{
        roof_surface_id: "s1", name: "South roof", orientation: "portrait", panel_count: 12,
        maximum_panel_count: 12, installed_kwp: 5.22, occupied_area_m2: 23.43,
        utilization_percent: 62.1, tilt_deg: 30, azimuth_deg: 180, annual_kwh: 6450,
        monthly_results: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, energy_kwh: 500 })),
      }],
      explanation: "Uses the highest feasible panel count on every roof surface.",
    };
    const optimization = {
      id: "opt1", project_id: "p1", criterion: "maximum_production", system_loss_percent: 14,
      target_consumption_kwh: null, input_hash: "hash", candidates: [candidate], rejected_candidates: [],
      selected_candidate_id: null, selected_simulation_id: null, methodology: "solarplan-optimizer-v1",
      created_at: "2026-11-03T12:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(user)).mockResolvedValueOnce(json(optimization)));
    sessionStorage.setItem("solarplan.access_token", "test-token");

    renderApp("/projects/p1/optimizer");

    expect(await screen.findByRole("heading", { name: /configuration optimizer/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "LR5-54HTH-435M" })).toBeInTheDocument();
    expect(screen.getByText("6,450")).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
  });

  test("lists saved simulations with their original configuration summary", async () => {
    const history = [{
      id: "sim2", project_id: "p1", provider_version: "5.3", method_version: "solarplan-optimizer-v1",
      source: "configuration_optimizer", system_loss_percent: 14, installed_kwp: 4.2,
      annual_kwh: 5026, specific_yield_kwh_per_kwp: 1196.67, roof_surface_count: 1,
      panel_count: 6, panel_manufacturer: "Hanersun", panel_model_sku: "HN21N-66HT700W",
      created_at: "2026-11-04T10:00:00Z",
    }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(user)).mockResolvedValueOnce(json(history)));
    sessionStorage.setItem("solarplan.access_token", "test-token");

    renderApp("/projects/p1/simulations");

    expect(await screen.findByRole("heading", { name: /simulation history/i })).toBeInTheDocument();
    expect(screen.getByText("Optimizer configuration")).toBeInTheDocument();
    expect(screen.getByText("Hanersun HN21N-66HT700W")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view details/i })).toHaveAttribute("href", "/projects/p1/simulations/sim2");
  });

  test("opens an immutable saved simulation without recalculating it", async () => {
    const monthly_results = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, energy_kwh: 400 + index * 10 }));
    const simulation = {
      id: "sim2", project_id: "p1", provider_version: "5.3", method_version: "solarplan-optimizer-v1",
      system_loss_percent: 14, installed_kwp: 4.2, annual_kwh: 5026,
      specific_yield_kwh_per_kwp: 1196.67,
      input_snapshot: { source: "configuration_optimizer" }, monthly_results,
      surface_results: [{
        roof_surface_id: "s1", name: "South roof", installed_kwp: 4.2, tilt_deg: 30,
        azimuth_deg: 180, pvgis_aspect: 0, annual_kwh: 5026,
        specific_yield_kwh_per_kwp: 1196.67, monthly_results,
      }],
      created_at: "2026-11-04T10:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(user)).mockResolvedValueOnce(json(simulation)));
    sessionStorage.setItem("solarplan.access_token", "test-token");

    renderApp("/projects/p1/simulations/sim2");

    expect(await screen.findByRole("heading", { name: /simulation details/i })).toBeInTheDocument();
    expect(screen.getByText(/read-only calculation snapshot/i)).toBeInTheDocument();
    expect(screen.getByText("South roof")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /recalculate/i })).not.toBeInTheDocument();
  });

  test("selects two saved simulations and compares project totals", async () => {
    const summaries = [
      {
        id: "newer", project_id: "p1", provider_version: "5.3", method_version: "solarplan-pvgis-v1",
        source: "manual_analysis", system_loss_percent: 12, installed_kwp: 5.22,
        annual_kwh: 6500, specific_yield_kwh_per_kwp: 1245.21, roof_surface_count: 2,
        panel_count: 12, panel_manufacturer: "LONGi", panel_model_sku: "435M",
        created_at: "2026-11-04T12:00:00Z",
      },
      {
        id: "older", project_id: "p1", provider_version: "5.3", method_version: "solarplan-pvgis-v1",
        source: "manual_analysis", system_loss_percent: 14, installed_kwp: 4.35,
        annual_kwh: 5200, specific_yield_kwh_per_kwp: 1195.4, roof_surface_count: 1,
        panel_count: 10, panel_manufacturer: "LONGi", panel_model_sku: "435M",
        created_at: "2026-11-03T12:00:00Z",
      },
    ];
    const comparison = {
      baseline: { ...summaries[1], monthly_results: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, energy_kwh: 300 + index })) },
      comparison: { ...summaries[0], monthly_results: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, energy_kwh: 400 + index })) },
      deltas: { panel_count: 2, installed_kwp: 0.87, annual_kwh: 1300, specific_yield_kwh_per_kwp: 49.81, system_loss_percent: -2 },
      monthly_comparison: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, baseline_kwh: 300 + index, comparison_kwh: 400 + index, delta_kwh: 100 })),
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(user))
      .mockResolvedValueOnce(json(summaries))
      .mockResolvedValueOnce(json(comparison));
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.setItem("solarplan.access_token", "test-token");

    renderApp("/projects/p1/simulations");
    expect(await screen.findByRole("heading", { name: /simulation history/i })).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole("button", { name: /compare selected/i }));

    expect(await screen.findByRole("heading", { name: /compare simulations/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /system-level differences/i })).toBeInTheDocument();
    expect(screen.getByText("+1,300 kWh")).toBeInTheDocument();
    expect(screen.getByText(/roof-surface-level differences are intentionally excluded/i)).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[2][0])).toContain("baseline_id=older&comparison_id=newer");
  });
});
