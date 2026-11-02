import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
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
      { id: "s1", project_id: "p1", name: "South roof", width_m: 8, length_m: 6, tilt_deg: 30, azimuth_deg: 180, edge_margin_m: .3, panel_gap_m: .02, panel_layout: layout, created_at: "", updated_at: "" },
      { id: "s2", project_id: "p1", name: "West roof", width_m: 5, length_m: 4, tilt_deg: 28, azimuth_deg: 270, edge_margin_m: .3, panel_gap_m: .02, panel_layout: null, created_at: "", updated_at: "" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(user)).mockResolvedValueOnce(json(surfaces)));
    sessionStorage.setItem("solarplan.access_token", "test-token");
    renderApp("/projects/p1/roof-surfaces");
    expect(await screen.findByRole("heading", { name: "Roof surfaces" })).toBeInTheDocument();
    expect(screen.getByText("South roof")).toBeInTheDocument();
    expect(screen.getByText("West roof")).toBeInTheDocument();
    expect(screen.getByText(/12 panels · 5.22 kWp total/i)).toBeInTheDocument();
  });
});
