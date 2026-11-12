import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../lib/api";
import { ConfigurationOptimizerPage, productionDifference } from "./ConfigurationOptimizerPage";
vi.mock("../lib/api",async(original)=>({...await original<typeof import("../lib/api")>(),api:{latestOptimization:vi.fn(),runOptimization:vi.fn(),selectOptimizationCandidate:vi.fn()}}));
const candidate=(id:string,rank:number,annual:number)=>({candidate_id:id,rank,recommended:rank===1,panel:{manufacturer:"QA maker",model_sku:`Model ${rank}`},annual_kwh:annual,installed_kwp:4,total_panel_count:10,occupied_area_m2:20,specific_yield_kwh_per_kwp:1250,target_coverage_percent:null,explanation:"Fits the roof.",surfaces:[{roof_surface_id:"s1",name:"South roof",panel_count:10,orientation:"portrait",installed_kwp:4,annual_kwh:annual,tilt_deg:20,azimuth_deg:180,occupied_area_m2:20,utilization_percent:60,maximum_panel_count:12}]});
const result={id:"opt1",criterion:"consumption_match",created_at:"2026-11-12T12:00:00Z",system_loss_percent:14,target_consumption_kwh:4500,selected_candidate_id:null,candidates:[candidate("c1",1,4500),candidate("c2",2,5000)],rejected_candidates:[]};
function open(overrides: Partial<typeof result> = {}){vi.mocked(api.latestOptimization).mockResolvedValue({...result, ...overrides} as never);render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><MemoryRouter initialEntries={["/projects/p1/optimizer"]}><Routes><Route path="/projects/:projectId/optimizer" element={<ConfigurationOptimizerPage/>}/></Routes></MemoryRouter></QueryClientProvider>);}
beforeEach(()=>{
 Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute("open","");}});
 Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute("open");}});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.resetAllMocks();});
test("percentage comparisons handle the best, equal and zero production",()=>{expect(productionDifference(4500,5000)).toBe("10.0% less annual production");expect(productionDifference(5000,5000)).toBe("Highest annual production");expect(productionDifference(0,0)).toBe("Same annual production");expect(productionDifference(1,0)).toMatch(/zero/);});
test("consumption ranking remains separate from maximum production",async()=>{open();await screen.findByText("Model 1");expect(screen.getByText("10.0% less annual production")).toBeInTheDocument();expect(screen.getByText("Highest annual production")).toBeInTheDocument();expect(api.selectOptimizationCandidate).not.toHaveBeenCalled();});
test("non-first candidate requires confirmation, retries errors and confirms success",async()=>{
 open();await screen.findByText("Model 2");fireEvent.click(screen.getAllByRole("button",{name:"Use this configuration"})[1]);
 const dialog=await screen.findByRole("dialog");expect(within(dialog).getByRole("heading", { level: 2 })).toHaveTextContent("Apply Configuration #2");expect(api.selectOptimizationCandidate).not.toHaveBeenCalled();
 vi.mocked(api.selectOptimizationCandidate).mockRejectedValueOnce(new Error("Stale configuration. Run again."));
 fireEvent.click(within(dialog).getByRole("button",{name:"Apply configuration"}));expect(await within(dialog).findByRole("alert")).toHaveTextContent("Stale configuration");expect(dialog).toHaveAttribute("open");
 vi.mocked(api.selectOptimizationCandidate).mockResolvedValue({optimization:{...result,selected_candidate_id:"c2"},simulation_id:"sim2",applied_candidate_id:"c2"} as never);
 fireEvent.click(within(dialog).getByRole("button",{name:"Apply configuration"}));
 expect(await screen.findByRole("status")).toHaveTextContent("Configuration applied successfully.");expect(api.selectOptimizationCandidate).toHaveBeenLastCalledWith("p1","opt1","c2");expect(screen.getByRole("link",{name:"Open Production Analysis"})).toHaveAttribute("href","/projects/p1/analysis");expect(api.runOptimization).not.toHaveBeenCalled();
});
test("cancel closes the dialog without applying",async()=>{open();await screen.findByText("Model 1");fireEvent.click(screen.getAllByRole("button",{name:"Use this configuration"})[0]);fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button",{name:"Cancel"}));expect(screen.queryByRole("dialog")).not.toBeInTheDocument();expect(api.selectOptimizationCandidate).not.toHaveBeenCalled();});

test("pending application blocks duplicate requests and cancellation", async () => {
 let finish!: (value: never) => void;
 vi.mocked(api.selectOptimizationCandidate).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
 open();
 await screen.findByText("Model 1");
 fireEvent.click(screen.getAllByRole("button", { name: "Use this configuration" })[0]);
 const dialog = await screen.findByRole("dialog");
 const confirm = within(dialog).getByRole("button", { name: "Apply configuration" });
 fireEvent.click(confirm);
 fireEvent.click(confirm);
 await waitFor(() => expect(api.selectOptimizationCandidate).toHaveBeenCalledTimes(1));
 expect(within(dialog).getByRole("button", { name: "Applying…" })).toBeDisabled();
 expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
 expect(within(dialog).getByRole("status")).toHaveTextContent("Applying configuration…");
 expect(screen.queryByText("Configuration applied successfully.")).not.toBeInTheDocument();
 fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
 expect(dialog).toHaveAttribute("open");
 finish({ optimization: { ...result, selected_candidate_id: "c1" }, simulation_id: "sim1", applied_candidate_id: "c1" } as never);
 expect(await screen.findByText("Configuration applied successfully.")).toBeInTheDocument();
});
test.each(["Maximum production","Match consumption","Current manual plan"])("runs %s with the existing payload",async(label)=>{open();await screen.findByText("Model 1");fireEvent.click(screen.getByRole("radio",{name:new RegExp(label)}));vi.mocked(api.runOptimization).mockResolvedValue(result as never);fireEvent.click(screen.getByRole("button",{name:"Run optimizer"}));await waitFor(()=>expect(api.runOptimization).toHaveBeenCalledWith("p1",{criterion:label==="Maximum production"?"maximum_production":label==="Match consumption"?"consumption_match":"manual",system_loss_percent:14,candidate_limit:3}));});


test.each([0, 1, 3, 5])("renders %i candidates without changing ranking", async (count) => {
 open({ candidates: Array.from({ length: count }, (_, index) => candidate(`c${index}`, index + 1, 5000 - index * 200)) });
 await screen.findByRole("heading", { name: "Configuration comparison" });
 expect(screen.queryAllByRole("article")).toHaveLength(count);
 expect(screen.queryAllByText("Recommended")).toHaveLength(count ? 1 : 0);
 if (!count) expect(screen.getByText("No feasible configurations found")).toBeInTheDocument();
});

test("handles missing production and preserves real zero values", async () => {
 expect(productionDifference(undefined, 5000)).toBe("Production comparison unavailable");
 expect(productionDifference(0, null)).toBe("Production comparison unavailable");
 expect(productionDifference(NaN, 0)).toBe("Production comparison unavailable");
 open({ candidates: [{ ...candidate("c1", 1, 0), installed_kwp: 0, total_panel_count: 0 }, { ...candidate("c2", 2, 0), annual_kwh: undefined as never }] });
 await screen.findByText("Model 1");
 expect(screen.getByText("Same annual production")).toBeInTheDocument();
 expect(screen.getByText("Production comparison unavailable")).toBeInTheDocument();
 expect(screen.getAllByRole("article")[0]).toHaveTextContent("0.00");
});

test("restores focus on cancel and shows multiple roof surfaces in the modal", async () => {
 const first = candidate("c1", 1, 5000);
 open({ candidates: [{ ...first, surfaces: [...first.surfaces, { ...first.surfaces[0], roof_surface_id: "s2", name: "West roof", orientation: "landscape" }] }] });
 const trigger = await screen.findByRole("button", { name: "Use this configuration" });
 fireEvent.click(trigger);
 const dialog = await screen.findByRole("dialog");
 fireEvent.click(within(dialog).getByText("Roof-surface breakdown"));
 expect(within(dialog).getByText("South roof")).toBeInTheDocument();
 expect(within(dialog).getByText("West roof")).toBeInTheDocument();
 fireEvent(dialog, new Event("cancel", { cancelable: true }));
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 expect(trigger).toHaveFocus();
 expect(api.selectOptimizationCandidate).not.toHaveBeenCalled();
});

test("system losses can be adjusted, collapsed and validated", async () => {
 open();
 await screen.findByText("Model 1");
 const adjust = screen.getByRole("button", { name: "Adjust" });
 expect(adjust).toHaveAttribute("aria-expanded", "false");
 fireEvent.click(adjust);
 fireEvent.click(screen.getByRole("checkbox", { name: /Manually adjust/ }));
 fireEvent.change(screen.getByRole("spinbutton", { name: /Loss percentage/ }), { target: { value: "31" } });
 expect(screen.getByRole("button", { name: "Run optimizer" })).toBeDisabled();
 fireEvent.click(adjust);
 expect(screen.getByRole("alert")).toHaveTextContent("Open Adjust");
 fireEvent.click(adjust);
 fireEvent.click(screen.getByRole("button", { name: "Use 14% default" }));
 expect(screen.getByRole("button", { name: "Run optimizer" })).toBeEnabled();
});
