import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../lib/api";
import { SimulationHistoryPage } from "./SimulationHistoryPage";
import { SimulationComparisonPage } from "./SimulationComparisonPage";
import { SavedMonthlyChart, annualDifference } from "../components/SavedMonthlyChart";
vi.mock("../lib/api",()=>({api:{energySimulations:vi.fn(),compareEnergySimulations:vi.fn(),aiStatus:vi.fn().mockResolvedValue({configured:false})}}));
beforeEach(()=>{vi.mocked(api.aiStatus).mockResolvedValue({configured:false} as never);});
afterEach(()=>{cleanup();vi.resetAllMocks();});
const summary=(id:string,day:number)=>({id,project_id:"p1",created_at:`2026-11-${day}T12:00:00Z`,source:"manual_analysis",annual_kwh:5000,installed_kwp:5,panel_count:12,panel_manufacturer:"Maker",panel_model_sku:id,system_loss_percent:14,specific_yield_kwh_per_kwp:1000});
function Location(){return <p>{useLocation().search}</p>;}
function open(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={["/projects/p1/simulations"]}><Routes><Route path="/projects/:projectId/simulations" element={<SimulationHistoryPage/>}/><Route path="/projects/:projectId/simulations/compare" element={<Location/>}/></Routes></MemoryRouter></QueryClientProvider>);}
test("sorts history, restricts selection to two, clears and compares chronologically",async()=>{
 vi.mocked(api.energySimulations).mockResolvedValue([summary("old",10),summary("new",12),summary("middle",11)] as never);open();
 await screen.findByText("Maker new");
 const rows=screen.getAllByRole("article");expect(rows[0]).toHaveTextContent("Latest");expect(rows[0]).toHaveTextContent("Maker new");expect(screen.queryByRole("button",{name:"Compare Simulations"})).not.toBeInTheDocument();
 const boxes=screen.getAllByRole("checkbox");fireEvent.click(boxes[0]);expect(screen.getByRole("button",{name:"Compare Simulations"})).toBeDisabled();fireEvent.click(boxes[2]);expect(boxes[1]).toBeDisabled();expect(boxes[0]).toBeEnabled();fireEvent.click(boxes[1]);expect(boxes[1]).not.toBeChecked();
 fireEvent.click(screen.getByRole("button",{name:"Clear selection"}));expect(boxes[0]).not.toBeChecked();fireEvent.click(boxes[0]);fireEvent.click(boxes[2]);fireEvent.click(screen.getByRole("button",{name:"Compare Simulations"}));expect(await screen.findByText("?baseline=old&comparison=new")).toBeInTheDocument();expect(api.compareEnergySimulations).not.toHaveBeenCalled();
});
test("empty, loading and retry states are explicit",async()=>{
 vi.mocked(api.energySimulations).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce([]);open();expect(screen.getByRole("status")).toHaveTextContent("Loading simulation history");fireEvent.click(await screen.findByRole("button",{name:"Try again"}));expect(await screen.findByText("No simulations yet")).toBeInTheDocument();expect(screen.getByRole("link",{name:"Open Production Analysis"})).toHaveAttribute("href","/projects/p1/analysis");
});
test.each([[100,120,20,20],[100,80,-20,-20],[100,100,0,0],[0,10,10,null]])("annual difference %i to %i handles signs and zero",(old,newer,amount,percent)=>{expect(annualDifference(old,newer)).toEqual({amount,percent});});
test("monthly chart uses saved values, complete months and accessible data table",()=>{
 const values=Array.from({length:12},(_,i)=>({month:i+1,energy_kwh:i*20}));render(<SavedMonthlyChart older={values} newer={values}/>);expect(screen.getByLabelText("January: Older simulation 0 kWh; Newer simulation 0 kWh")).toHaveAttribute("tabindex","0");fireEvent.click(screen.getByText("View monthly values as a table"));expect(screen.getAllByRole("row")).toHaveLength(13);
});
test("incomplete monthly data is never synthesized",()=>{render(<SavedMonthlyChart older={[]} newer={[{month:1,energy_kwh:400}]}/>);expect(screen.getByText(/Complete saved monthly production is unavailable/)).toBeInTheDocument();expect(screen.queryByRole("table")).not.toBeInTheDocument();});
test("comparison reorders reversed results and shows missing metrics without NaN",async()=>{
 vi.mocked(api.compareEnergySimulations).mockResolvedValue({baseline:{...summary("new",12),annual_kwh:0,monthly_results:[]},comparison:{...summary("old",10),annual_kwh:0,panel_count:null,monthly_results:[]}} as never);
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={["/projects/p1/simulations/compare?baseline=new&comparison=old"]}><Routes><Route path="/projects/:projectId/simulations/compare" element={<SimulationComparisonPage/>}/></Routes></MemoryRouter></QueryClientProvider>);
 const table=await screen.findByRole("table");expect(within(table).getByText("Unavailable")).toBeInTheDocument();expect(screen.getByText(/older production is zero/)).toBeInTheDocument();expect(screen.getByText(/same annual production/)).toBeInTheDocument();expect(document.body).not.toHaveTextContent("NaN");await waitFor(()=>expect(api.compareEnergySimulations).toHaveBeenCalledTimes(1));
});
