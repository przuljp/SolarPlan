import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { api } from "../lib/api";
import type { RoofSurface } from "../types/api";
import { RoofSurfaceFormPage } from "./RoofSurfaceFormPage";

vi.mock("../lib/api", () => ({ api: { roofSurface: vi.fn(), createRoofSurface: vi.fn(), updateRoofSurface: vi.fn() } }));
const saved = { id: "s1", project_id: "p1", name: "Original roof", shape_type: "rectangle", bottom_width_m: 6, top_width_m: 6, top_offset_m: 0, length_m: 10, tilt_deg: 27, azimuth_deg: 172, edge_margin_m: 0.3, panel_gap_m: 0.02, panel_layout: null, created_at: "2026-01-01", updated_at: "2026-01-01" } as RoofSurface;

function open(edit = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/projects/p1/roof-surfaces/${edit ? "s1/edit" : "new"}`]}><Routes>
    <Route path="/projects/:projectId/roof-surfaces/new" element={<RoofSurfaceFormPage />} />
    <Route path="/projects/:projectId/roof-surfaces/:surfaceId/edit" element={<RoofSurfaceFormPage />} />
    <Route path="/projects/:projectId/roof-surfaces/:surfaceId/panels" element={<p>Choose panel next</p>} />
  </Routes></MemoryRouter></QueryClientProvider>);
  return client;
}

function fillDimensions() {
  fireEvent.change(screen.getByLabelText("Surface name"), { target: { value: "South roof" } });
  fireEvent.change(screen.getByLabelText(/Surface width/), { target: { value: "6" } });
  fireEvent.change(screen.getByLabelText(/Surface length/), { target: { value: "10" } });
}
const submit = () => fireEvent.click(screen.getByRole("button", { name: /Save and choose panel/ }));

beforeEach(() => {
  vi.mocked(api.roofSurface).mockResolvedValue(saved);
  vi.mocked(api.createRoofSurface).mockResolvedValue(saved);
  vi.mocked(api.updateRoofSurface).mockResolvedValue(saved);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

test.each([
  ["N — North", 0], ["NE — Northeast", 45], ["E — East", 90], ["SE — Southeast", 135],
  ["S — South", 180], ["SW — Southwest", 225], ["W — West", 270], ["NW — Northwest", 315],
])("creates a roof surface using %s as geographic azimuth %s", async (label, degrees) => {
  open(); fillDimensions();
  fireEvent.click(screen.getByRole("radio", { name: String(label) }));
  fireEvent.click(screen.getByRole("radio", { name: "Gentle slope — estimated 20°" }));
  submit();
  await screen.findByText("Choose panel next");
  expect(api.createRoofSurface).toHaveBeenCalledWith("p1", expect.objectContaining({ azimuth_deg: degrees, tilt_deg: 20, bottom_width_m: 6, length_m: 10, edge_margin_m: 0.5, panel_gap_m: 0.02 }));
});

test.each([["Flat roof", 3], ["Gentle slope", 20], ["Steep slope", 40]])("maps %s to %s degrees", async (label, degrees) => {
  open(); fillDimensions();
  fireEvent.click(screen.getByRole("radio", { name: "S — South" }));
  fireEvent.click(screen.getByRole("radio", { name: `${label} — estimated ${degrees}°` }));
  submit();
  await waitFor(() => expect(api.createRoofSurface).toHaveBeenCalledWith("p1", expect.objectContaining({ tilt_deg: degrees, azimuth_deg: 180 })));
});

test("requires dimensions and both choices, without manual angle inputs", () => {
  open();
  expect(screen.queryByRole("spinbutton", { name: /tilt|azimuth/i })).not.toBeInTheDocument();
  fillDimensions(); submit();
  expect(api.createRoofSurface).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("radio", { name: "S — South" })); submit();
  expect(api.createRoofSurface).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("radio", { name: "Flat roof — estimated 3°" }));
  fireEvent.change(screen.getByLabelText(/Surface width/), { target: { value: "" } }); submit();
  expect(api.createRoofSurface).not.toHaveBeenCalled();
});

test("preserves exact legacy angles when another field is edited", async () => {
  open(true);
  expect(await screen.findByRole("radio", { name: "Previously saved direction: 172°" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Previously saved slope: 27°" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "S — South" })).not.toBeChecked();
  fireEvent.change(screen.getByLabelText("Surface name"), { target: { value: "Renamed roof" } });
  submit();
  await waitFor(() => expect(api.updateRoofSurface).toHaveBeenCalledWith("p1", "s1", expect.objectContaining({ name: "Renamed roof", tilt_deg: 27, azimuth_deg: 172, edge_margin_m: 0.3, panel_gap_m: 0.02, top_offset_m: 0 })));
});

test("only changes the angle explicitly selected by the user", async () => {
  open(true);
  await screen.findByRole("radio", { name: "Previously saved direction: 172°" });
  fireEvent.click(screen.getByRole("radio", { name: "W — West" })); submit();
  await waitFor(() => expect(api.updateRoofSurface).toHaveBeenCalledWith("p1", "s1", expect.objectContaining({ azimuth_deg: 270, tilt_deg: 27 })));
});

test("preserves legacy direction when only a slope category changes", async () => {
  open(true);
  await screen.findByRole("radio", { name: "Previously saved slope: 27°" });
  fireEvent.click(screen.getByRole("radio", { name: "Steep slope — estimated 40°" })); submit();
  await waitFor(() => expect(api.updateRoofSurface).toHaveBeenCalledWith("p1", "s1", expect.objectContaining({ azimuth_deg: 172, tilt_deg: 40 })));
});

test("background refetch does not overwrite explicit choices or other edits", async () => {
  const client = open(true);
  await screen.findByRole("radio", { name: "Previously saved slope: 27°" });
  fireEvent.click(screen.getByRole("radio", { name: "NE — Northeast" }));
  fireEvent.click(screen.getByRole("radio", { name: "Flat roof — estimated 3°" }));
  fireEvent.change(screen.getByLabelText("Surface name"), { target: { value: "In progress" } });
  vi.mocked(api.roofSurface).mockResolvedValue({ ...saved, tilt_deg: 28, azimuth_deg: 173 });
  await client.refetchQueries({ queryKey: ["projects", "p1", "roof-surfaces", "s1"] });
  expect(screen.getByRole("radio", { name: "NE — Northeast" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Flat roof — estimated 3°" })).toBeChecked();
  submit();
  await waitFor(() => expect(api.updateRoofSurface).toHaveBeenCalledWith("p1", "s1", expect.objectContaining({ name: "In progress", azimuth_deg: 45, tilt_deg: 3 })));
});

test("recognizes existing exact category values without a legacy choice", async () => {
  vi.mocked(api.roofSurface).mockResolvedValue({ ...saved, tilt_deg: 20, azimuth_deg: 225 });
  open(true);
  expect(await screen.findByRole("radio", { name: "SW — Southwest" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Gentle slope — estimated 20°" })).toBeChecked();
  expect(screen.queryByRole("radio", { name: /Previously saved/ })).not.toBeInTheDocument();
});

test("does not offer a blank edit form after a failed load", async () => {
  vi.mocked(api.roofSurface).mockRejectedValue(new Error("Unavailable"));
  open(true);
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
  expect(screen.queryByRole("button", { name: /Save and choose panel/ })).not.toBeInTheDocument();
});

function choosePosition() {
  fireEvent.click(screen.getByRole("radio", { name: "S — South" }));
  fireEvent.click(screen.getByRole("radio", { name: "Gentle slope — estimated 20°" }));
}

test("shows illustrated rectangle dimensions without editable layout spacing", () => {
  open();
  expect(screen.getByRole("group", { name: "Roof Surface Dimensions" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Rectangle" })).toBeChecked();
  expect(screen.getByText("Equal top and bottom widths.")).toBeInTheDocument();
  expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
  expect(screen.queryByRole("spinbutton", { name: /top width|bottom width|offset|edge margin|panel gap/i })).not.toBeInTheDocument();
  expect(screen.queryByText("Layout clearances")).not.toBeInTheDocument();
  expect(screen.getByText(/not universal safety standards/)).toBeInTheDocument();
});

test.each([[10, 6, 2], [12, 4, 4]])("centers a new trapezoid with bottom %s and top %s at offset %s", async (bottom, top, offset) => {
  open();
  fireEvent.click(screen.getByRole("radio", { name: "Trapezoid" }));
  expect(screen.getByRole("radio", { name: "Trapezoid" })).toBeChecked();
  expect(screen.queryByLabelText(/surface width|offset/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Center top edge" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("spinbutton")).toHaveLength(3);
  fireEvent.change(screen.getByLabelText("Surface name"), { target: { value: "Centered roof" } });
  fireEvent.change(screen.getByLabelText(/Bottom width/), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText(/Top width/), { target: { value: "6" } });
  // Centering follows the final dimensions, including changes after the first input.
  fireEvent.change(screen.getByLabelText(/Bottom width/), { target: { value: String(bottom) } });
  fireEvent.change(screen.getByLabelText(/Top width/), { target: { value: String(top) } });
  fireEvent.change(screen.getByLabelText(/Surface length/), { target: { value: "8" } });
  choosePosition(); submit();
  await waitFor(() => expect(api.createRoofSurface).toHaveBeenCalledWith("p1", expect.objectContaining({ shape_type: "trapezoid", bottom_width_m: bottom, top_width_m: top, top_offset_m: offset, edge_margin_m: 0.5, panel_gap_m: 0.02 })));
});

const asymmetric = { ...saved, shape_type: "trapezoid", bottom_width_m: 10, top_width_m: 6, top_offset_m: 0.75, edge_margin_m: 0.42, panel_gap_m: 0.035 } as RoofSurface;

test("preserves asymmetric geometry and custom spacing when another field changes", async () => {
  vi.mocked(api.roofSurface).mockResolvedValue(asymmetric);
  open(true);
  expect(await screen.findByLabelText(/Saved top edge offset/)).toHaveValue(0.75);
  expect(screen.queryByLabelText(/edge margin|panel gap/i)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Surface name"), { target: { value: "Renamed asymmetric roof" } });
  submit();
  await waitFor(() => expect(api.updateRoofSurface).toHaveBeenCalledWith("p1", "s1", expect.objectContaining({ name: "Renamed asymmetric roof", shape_type: "trapezoid", bottom_width_m: 10, top_width_m: 6, top_offset_m: 0.75, edge_margin_m: 0.42, panel_gap_m: 0.035, tilt_deg: 27, azimuth_deg: 172 })));
});

test("permits offset edits only for a saved asymmetric surface", async () => {
  vi.mocked(api.roofSurface).mockResolvedValue(asymmetric);
  open(true);
  fireEvent.change(await screen.findByLabelText(/Saved top edge offset/), { target: { value: "1.5" } });
  fireEvent.change(screen.getByLabelText(/Bottom width/), { target: { value: "12" } });
  submit();
  await waitFor(() => expect(api.updateRoofSurface).toHaveBeenCalledWith("p1", "s1", expect.objectContaining({ bottom_width_m: 12, top_offset_m: 1.5, edge_margin_m: 0.42, panel_gap_m: 0.035 })));
});

test("rejects an asymmetric offset that no longer fits after changing widths", async () => {
  vi.mocked(api.roofSurface).mockResolvedValue(asymmetric);
  open(true);
  await screen.findByLabelText(/Saved top edge offset/);
  fireEvent.change(screen.getByLabelText(/Top width/), { target: { value: "9.5" } });
  submit();
  expect(api.updateRoofSurface).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Saved top edge offset/), { target: { value: "0.25" } });
  submit();
  await waitFor(() => expect(api.updateRoofSurface).toHaveBeenCalledWith("p1", "s1", expect.objectContaining({ top_width_m: 9.5, top_offset_m: 0.25 })));
});

test.each([[10, 2], [12, 3]])("keeps or recenters a saved symmetric trapezoid for bottom width %s", async (bottom, offset) => {
  vi.mocked(api.roofSurface).mockResolvedValue({ ...asymmetric, top_offset_m: 2 });
  open(true);
  await screen.findByRole("heading", { name: "Edit roof surface" });
  expect(screen.queryByLabelText(/offset/i)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Bottom width/), { target: { value: String(bottom) } });
  submit();
  await waitFor(() => expect(api.updateRoofSurface).toHaveBeenCalledWith("p1", "s1", expect.objectContaining({ bottom_width_m: bottom, top_offset_m: offset, edge_margin_m: 0.42, panel_gap_m: 0.035 })));
});

test("cannot submit a new trapezoid with a top wider than its bottom", () => {
  open();
  fireEvent.click(screen.getByRole("radio", { name: "Trapezoid" }));
  fireEvent.change(screen.getByLabelText("Surface name"), { target: { value: "Invalid roof" } });
  fireEvent.change(screen.getByLabelText(/Bottom width/), { target: { value: "6" } });
  fireEvent.change(screen.getByLabelText(/Top width/), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText(/Surface length/), { target: { value: "8" } });
  choosePosition(); submit();
  expect(api.createRoofSurface).not.toHaveBeenCalled();
});
