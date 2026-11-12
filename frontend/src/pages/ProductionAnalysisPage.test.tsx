import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { api, ApiError } from "../lib/api";
import { ProductionAnalysisPage } from "./ProductionAnalysisPage";
vi.mock("../lib/api", async (original) => ({ ...await original<typeof import("../lib/api")>(), api: { latestEnergySimulation: vi.fn(), energyComparison: vi.fn(), runEnergySimulation: vi.fn(), aiStatus: vi.fn(), explainSimulation: vi.fn(), downloadSimulationReport: vi.fn() } }));
const monthly = Array.from({length:12},(_,i)=>({month:i+1,energy_kwh:100+i*30}));
const simulation = {id:"sim1",project_id:"p1",provider_version:"5.3",system_loss_percent:14,annual_kwh:5000,installed_kwp:4,specific_yield_kwh_per_kwp:1250,monthly_results:monthly,surface_results:[{roof_surface_id:"s1",name:"South roof",installed_kwp:4,tilt_deg:20,azimuth_deg:180,annual_kwh:5000,specific_yield_kwh_per_kwp:1250}],created_at:"2026-11-12T12:00:00Z"};
function open(mode?: "empty" | "error") {
 if (mode === "error") vi.mocked(api.latestEnergySimulation).mockRejectedValue(new ApiError("offline",503));
 else vi.mocked(api.latestEnergySimulation).mockResolvedValue((mode === "empty" ? null : simulation) as never);
 vi.mocked(api.energyComparison).mockResolvedValue(null as never);
 vi.mocked(api.aiStatus).mockResolvedValue({available:true});
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={["/projects/p1/analysis"]}><Routes><Route path="/projects/:projectId/analysis" element={<ProductionAnalysisPage/>}/></Routes></MemoryRouter></QueryClientProvider>);
}
afterEach(()=>{cleanup();vi.resetAllMocks();});
test("dashboard orders results, chart, settings, contributions, AI and consumption",async()=>{
 open(); await screen.findByRole("heading",{name:"AI explanation"});
 const titles=screen.getAllByRole("heading").map(e=>e.textContent);
 expect(titles.indexOf("Production through the year")).toBeLessThan(titles.indexOf("Analysis settings"));
 expect(titles.indexOf("Analysis settings")).toBeLessThan(titles.indexOf("Contribution by roof surface"));
 expect(titles.indexOf("Contribution by roof surface")).toBeLessThan(titles.indexOf("AI explanation"));
 expect(screen.getByText(/100.0% of total production/)).toBeInTheDocument();
 expect(api.explainSimulation).not.toHaveBeenCalled();
 expect(screen.getByRole("link",{name:"View simulation history"})).toHaveAttribute("href","/projects/p1/simulations");
 expect(await screen.findByRole("link",{name:"Add consumption"})).toHaveAttribute("href","/projects/p1/consumption");
});
test("pending losses preserve saved results and exports until recalculation",async()=>{
 open(); await screen.findByRole("heading",{name:"Analysis settings"});
 fireEvent.click(screen.getByText("Adjust system losses"));
 fireEvent.click(screen.getByRole("checkbox",{name:/Manually adjust system losses/}));
 fireEvent.change(screen.getByRole("spinbutton",{name:/Loss percentage/}),{target:{value:"10"}});
 expect(screen.getByText(/New losses are not applied/)).toBeInTheDocument();
 expect(screen.getAllByText("5,000").length).toBeGreaterThan(0);
 expect(api.runEnergySimulation).not.toHaveBeenCalled();
 vi.mocked(api.downloadSimulationReport).mockResolvedValue(undefined);
 fireEvent.click(screen.getByRole("button",{name:"Download PDF"}));
 await waitFor(()=>expect(api.downloadSimulationReport).toHaveBeenCalledWith("p1","sim1","pdf"));
 vi.mocked(api.runEnergySimulation).mockResolvedValue({...simulation,id:"sim2",system_loss_percent:10} as never);
 fireEvent.click(screen.getByRole("button",{name:"Recalculate"}));
 await waitFor(()=>expect(api.runEnergySimulation).toHaveBeenCalledWith("p1",{system_loss_percent:10}));
});
test("failed load offers retry",async()=>{
 open("error");
 expect(await screen.findByText("Production analysis could not be loaded.")).toBeInTheDocument();
 expect(screen.getByRole("button",{name:"Try again"})).toBeInTheDocument();
});
test("empty result still allows first calculation",async()=>{
 open("empty");
 expect(await screen.findByRole("heading",{name:"No production analysis yet"})).toBeInTheDocument();
 expect(screen.getByRole("button",{name:"Run first analysis"})).toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"Download PDF"})).not.toBeInTheDocument();
});
