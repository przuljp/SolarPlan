import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "../lib/api";
import { RoofSurfacesPage } from "./RoofSurfacesPage";
vi.mock("../lib/api", () => ({ api: { roofSurfaces: vi.fn(), deleteRoofSurface: vi.fn() } }));
const roof = { id: "s1", name: "South roof", shape_type: "rectangle", bottom_width_m: 8, length_m: 6, tilt_deg: 20, azimuth_deg: 180, panel_layout: null };
const layout = { solar_panel_id: "panel1", panel_count: 12, installed_kwp: 5.22, solar_panel: { manufacturer: "LONGi", model_sku: "435M" } };
function open(data: unknown[] | Error, saved = false) {
  if (data instanceof Error) vi.mocked(api.roofSurfaces).mockRejectedValue(data);
  else vi.mocked(api.roofSurfaces).mockResolvedValue(data as never);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[`/projects/p1/roof-surfaces${saved ? "?saved=1" : ""}`]}><Routes><Route path="/projects/:projectId/roof-surfaces" element={<RoofSurfacesPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
test("empty state has zero summary and no analysis action", async () => {
  open([]); await screen.findByText("No roof surfaces yet");
  expect(screen.queryByRole("link", { name: /Open production analysis/ })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Add first surface/ })).toHaveAttribute("href", "/projects/p1/roof-surfaces/new");
});
test("one complete surface shows real totals, exact categories and preserved routes", async () => {
  open([{ ...roof, panel_layout: layout }]);
  await screen.findByText("South roof");
  expect(within(screen.getByLabelText("Project summary")).getByText("12")).toBeInTheDocument();
  expect(screen.getByText("South (S)")).toBeInTheDocument();
  expect(screen.getByText("Gentle slope · 20°")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Review layout/ })).toHaveAttribute("href", "/projects/p1/roof-surfaces/s1/layout?panel=panel1");
  expect(screen.getByRole("link", { name: /Edit surface/ })).toHaveAttribute("href", "/projects/p1/roof-surfaces/s1/edit");
  expect(screen.getByRole("link", { name: /Open production analysis/ })).toHaveAttribute("href", "/projects/p1/analysis");
});
test("mixed layouts preserve legacy angles without rounding and withhold analysis", async () => {
  open([{ ...roof, panel_layout: layout }, { ...roof, id: "s2", name: "Older roof", azimuth_deg: 172, tilt_deg: 27 }]);
  await screen.findByText("Older roof");
  expect(screen.getByText("Saved direction · 172°")).toBeInTheDocument();
  expect(screen.getByText("Saved slope · 27°")).toBeInTheDocument();
  expect(screen.getByText("Needs layout")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Choose panel/ })).toHaveAttribute("href", "/projects/p1/roof-surfaces/s2/panels");
  expect(screen.queryByRole("link", { name: /Open production analysis/ })).not.toBeInTheDocument();
});
test("saved notification can be dismissed", async () => {
  open([roof], true); await screen.findByText("South roof");
  expect(screen.getByRole("status")).toHaveTextContent("Panel layout saved.");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss saved notification" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
test("failure state offers retry without showing an empty project", async () => {
  open(new Error("offline"));
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
  expect(screen.queryByText("No roof surfaces yet")).not.toBeInTheDocument();
  vi.mocked(api.roofSurfaces).mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No roof surfaces yet")).toBeInTheDocument();
});
test("shows an accessible loading state before data arrives", async () => {
  open([]);
  expect(screen.getByRole("status")).toHaveTextContent("Loading roof surfaces");
  await screen.findByText("No roof surfaces yet");
});
test("keeps deletion confirmation and reports a failed deletion", async () => {
  open([roof]); await screen.findByText("South roof");
  const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
  vi.stubGlobal("confirm", confirm);
  vi.mocked(api.deleteRoofSurface).mockRejectedValue(new Error("Please try deleting again."));
  fireEvent.click(screen.getByRole("button", { name: "Delete South roof" }));
  expect(api.deleteRoofSurface).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete South roof" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try deleting again.");
  expect(api.deleteRoofSurface).toHaveBeenCalledWith("p1", "s1");
});
