import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { api } from "../lib/api";
import { PanelLayoutPage } from "./PanelLayoutPage";

vi.mock("../lib/api", () => ({ api: { roofSurface: vi.fn(), previewLayout: vi.fn(), savePanelLayout: vi.fn() } }));
const panel = { id: "panel1", manufacturer: "Test", model_sku: "Panel", power_wp: 430, width_mm: 1134, length_mm: 1722 };
const preview = { solar_panel: panel, maximum_panel_count: 18, positions: [], roof_polygon: [], usable_polygon: [], roof_shape_type: "rectangle", roof_bottom_width_m: 8, roof_length_m: 6, usable_roof_area_m2: 40, rows: 3, columns: 6 };

function openLayout() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={["/projects/p1/roof-surfaces/s1/layout?panel=panel1"]}><Routes><Route path="/projects/:projectId/roof-surfaces/:surfaceId/layout" element={<PanelLayoutPage />} /><Route path="/projects/:projectId/roof-surfaces" element={<p>Saved roof surfaces</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.mocked(api.roofSurface).mockResolvedValue({ panel_layout: { solar_panel_id: "panel1", panel_count: 12, orientation: "landscape" } } as never);
  vi.mocked(api.previewLayout).mockResolvedValue(preview as never);
  vi.mocked(api.savePanelLayout).mockResolvedValue({} as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("reopens and saves the stored count and orientation instead of the maximum", async () => {
  openLayout();
  expect(await screen.findByRole("spinbutton", { name: /installed panel count/i })).toHaveValue(12);
  expect(screen.getByRole("radio", { name: "Landscape" })).toBeChecked();
  expect(api.previewLayout).toHaveBeenCalledWith("p1", "s1", { solar_panel_id: "panel1", orientation: "landscape" });
  fireEvent.click(screen.getByRole("button", { name: /save panel layout/i }));
  await waitFor(() => expect(api.savePanelLayout).toHaveBeenCalledWith("p1", "s1", { solar_panel_id: "panel1", orientation: "landscape", panel_count: 12 }));
});

test("uses automatic capacity for a new model and after an orientation change", async () => {
  vi.mocked(api.roofSurface).mockResolvedValue({ panel_layout: { solar_panel_id: "other", panel_count: 2, orientation: "landscape" } } as never);
  openLayout();
  expect(await screen.findByRole("spinbutton", { name: /installed panel count/i })).toHaveValue(18);
  expect(screen.getByRole("radio", { name: "Portrait" })).toBeChecked();
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "5" } });
  fireEvent.click(screen.getByRole("radio", { name: "Landscape" }));
  expect(await screen.findByRole("spinbutton")).toHaveValue(18);
});

test("does not allow overwriting a saved layout when loading it fails", async () => {
  vi.mocked(api.roofSurface).mockRejectedValue(new Error("Unavailable"));
  openLayout();
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
  expect(api.previewLayout).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /save panel layout/i })).not.toBeInTheDocument();
});
