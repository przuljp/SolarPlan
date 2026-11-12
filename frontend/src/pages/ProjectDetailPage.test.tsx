import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "../lib/api";
import { ProjectDetailPage } from "./ProjectDetailPage";
vi.mock("../lib/api",async(original)=>({...await original<typeof import("../lib/api")>(),api:{project:vi.fn(),projectLocation:vi.fn(),roofSurfaces:vi.fn(),deleteProject:vi.fn()}}));
const roof={id:"s1",panel_layout:{panel_count:12,installed_kwp:5.22,solar_panel:{manufacturer:"LONGi",model_sku:"435M"}}};
function open(surfaces:unknown[]=[],location:unknown={location_label:"Dobro Polje, Kalinovik, Bosnia and Herzegovina"},status="draft",error=false){
 vi.mocked(api.project).mockResolvedValue({name:"Family house",description:"Home",status} as never);
 vi.mocked(api.projectLocation).mockResolvedValue(location as never);
 if(error)vi.mocked(api.roofSurfaces).mockRejectedValue(new Error("offline"));else vi.mocked(api.roofSurfaces).mockResolvedValue(surfaces as never);
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={["/projects/p1"]}><Routes><Route path="/projects/:projectId" element={<ProjectDetailPage/>}/><Route path="/projects" element={<p>Projects destination</p>}/></Routes></MemoryRouter></QueryClientProvider>);
}
afterEach(()=>{cleanup();vi.resetAllMocks();vi.unstubAllGlobals();});
test("empty geometry has accurate summary and unavailable analysis",async()=>{
 open();await screen.findByRole("heading",{name:"Family house"});expect(screen.getByRole("button",{name:"View production analysis"})).toBeDisabled();expect(screen.getByText("Not selected yet")).toBeInTheDocument();expect(screen.queryByText("Project register")).not.toBeInTheDocument();expect(screen.getByRole("link",{name:"Edit location"})).toHaveAttribute("href","/projects/p1/location");
});
test("complete geometry preserves all navigation and analyzed status",async()=>{
 open([roof,{...roof,id:"s2"}],undefined,"analyzed");await screen.findByText("Analyzed");
 expect(screen.getByText("24")).toBeInTheDocument();expect(screen.getByText("2 of 2 layouts saved")).toBeInTheDocument();
 for(const [name,path] of [["Edit details","edit"],["Manage roof surfaces","roof-surfaces"],["Energy consumption","consumption"],["View production analysis","analysis"],["Compare configurations","optimizer"],["Simulation history","simulations"]])expect(screen.getByRole("link",{name:new RegExp(name)})).toHaveAttribute("href",`/projects/p1/${path}`);
});
test("a missing layout cannot enable analysis",async()=>{open([roof,{id:"s2",panel_layout:null}]);await screen.findByText("1 of 2 layouts saved");expect(screen.getByRole("button",{name:"View production analysis"})).toBeDisabled();});
test("missing location keeps original setup gating",async()=>{open([],null);await screen.findByText("Location not set");expect(screen.getByRole("link",{name:"Set project location"})).toBeInTheDocument();expect(screen.queryByRole("link",{name:/Manage roof surfaces/})).not.toBeInTheDocument();});
test("deletion requires confirmation and returns to projects",async()=>{
 open();await screen.findByText("Family house");expect(screen.queryByText("More options")).not.toBeInTheDocument();const confirm=vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);vi.stubGlobal("confirm",confirm);vi.mocked(api.deleteProject).mockResolvedValue(undefined);
 fireEvent.click(screen.getByRole("button",{name:"Delete project"}));expect(api.deleteProject).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Delete project"}));expect(await screen.findByText("Projects destination")).toBeInTheDocument();expect(api.deleteProject).toHaveBeenCalledWith("p1");
});
test("loading and failed dependencies do not display invented zero totals",async()=>{open([],undefined,"draft",true);expect(screen.getByRole("status")).toHaveTextContent("Loading project overview");expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");expect(screen.getByRole("button",{name:"Try again"})).toBeInTheDocument();});
