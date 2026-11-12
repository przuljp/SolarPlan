import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "../lib/api";
import { ConsumptionPage } from "./ConsumptionPage";
vi.mock("../lib/api",()=>({api:{consumptionProfile:vi.fn(),saveConsumptionProfile:vi.fn()}}));
const profile={profile_kind:"partial_monthly",annual_consumption_kwh:null,monthly_values:[{month:1,consumption_kwh:400},{month:2,consumption_kwh:500}]};
function open(saved: unknown = null){
 if (saved instanceof Error) vi.mocked(api.consumptionProfile).mockRejectedValue(saved);
 else vi.mocked(api.consumptionProfile).mockResolvedValue(saved as never);
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/projects/p1/consumption"]}><Routes><Route path="/projects/:projectId/consumption" element={<ConsumptionPage/>}/><Route path="/projects/:projectId/analysis" element={<p>Production destination</p>}/><Route path="/projects/:projectId" element={<p>Project destination</p>}/></Routes></MemoryRouter></QueryClientProvider>);
 return client;
}
afterEach(()=>{cleanup();vi.resetAllMocks();vi.unstubAllGlobals();});
test("switching input mode preserves both drafts and labels partial data honestly",async()=>{
 open();await screen.findByRole("heading",{name:"Household consumption"});
 fireEvent.change(screen.getByLabelText("January consumption"),{target:{value:"400"}});
 expect(screen.getByText("Partial profile")).toBeInTheDocument();expect(screen.getByText("1/12")).toBeInTheDocument();
 expect(screen.getByText("Sum of known months")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("radio",{name:"Annual total"}));
 fireEvent.change(screen.getByRole("spinbutton",{name:"Annual electricity consumption (kWh)"}),{target:{value:"4800"}});
 fireEvent.click(screen.getByRole("radio",{name:"Monthly values"}));
 expect(screen.getByLabelText("January consumption")).toHaveValue(400);
 fireEvent.click(screen.getByRole("radio",{name:"Annual total"}));
 expect(screen.getByRole("spinbutton",{name:"Annual electricity consumption (kWh)"})).toHaveValue(4800);
});
test("twelve months show the actual annual sum without estimates",async()=>{
 open();await screen.findByLabelText("January consumption");
 for(const input of screen.getAllByRole("spinbutton")) fireEvent.change(input,{target:{value:"100"}});
 expect(screen.getByText("Complete profile")).toBeInTheDocument();expect(screen.getByText("12/12")).toBeInTheDocument();
 expect(screen.getByText("1,200 kWh")).toBeInTheDocument();
});
test("clearing a saved month removes only that month from the existing API payload",async()=>{
 open(profile);expect(await screen.findByLabelText("January consumption")).toHaveValue(400);
 fireEvent.change(screen.getByLabelText("January consumption"),{target:{value:""}});
 vi.mocked(api.saveConsumptionProfile).mockResolvedValue({...profile,monthly_values:[profile.monthly_values[1]]} as never);
 fireEvent.click(screen.getByRole("button",{name:"Save consumption"}));
 await waitFor(()=>expect(api.saveConsumptionProfile).toHaveBeenCalledWith("p1",{annual_consumption_kwh:null,monthly_values:[{month:2,consumption_kwh:500}]}));
 expect(await screen.findByRole("status")).toHaveTextContent("Consumption profile saved.");
});
test("background refresh does not overwrite unsaved input",async()=>{
 const client=open(profile);await screen.findByLabelText("January consumption");
 fireEvent.change(screen.getByLabelText("January consumption"),{target:{value:"777"}});
 vi.mocked(api.consumptionProfile).mockResolvedValue({...profile,monthly_values:[]} as never);
 await client.refetchQueries({queryKey:["projects","p1","consumption"]});
 expect(screen.getByLabelText("January consumption")).toHaveValue(777);
});
test("warns before leaving for analysis or cancel with unsaved changes",async()=>{
 open();await screen.findByLabelText("January consumption");
 fireEvent.change(screen.getByLabelText("January consumption"),{target:{value:"100"}});
 const confirm=vi.fn().mockReturnValue(false);vi.stubGlobal("confirm",confirm);
 fireEvent.click(screen.getByRole("link",{name:/Continue to production analysis/}));
 expect(screen.queryByText("Production destination")).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("link",{name:"Cancel"}));expect(screen.queryByText("Project destination")).not.toBeInTheDocument();
 confirm.mockReturnValue(true);fireEvent.click(screen.getByRole("link",{name:/Continue to production analysis/}));
 expect(await screen.findByText("Production destination")).toBeInTheDocument();
});
test("rejects an empty monthly submission and retains save errors",async()=>{
 open();await screen.findByLabelText("January consumption");
 fireEvent.click(screen.getByRole("button",{name:"Save consumption"}));expect(await screen.findByRole("alert")).toHaveTextContent("at least one month");
 fireEvent.change(screen.getByLabelText("January consumption"),{target:{value:"100"}});
 vi.mocked(api.saveConsumptionProfile).mockRejectedValue(new Error("Save unavailable"));
 fireEvent.click(screen.getByRole("button",{name:"Save consumption"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("Save unavailable");
});

test("loads a saved annual profile without introducing monthly values",async()=>{
 open({profile_kind:"annual_only",annual_consumption_kwh:4800,monthly_values:[]});
 expect(await screen.findByRole("spinbutton",{name:"Annual electricity consumption (kWh)"})).toHaveValue(4800);
 expect(screen.getByRole("radio",{name:"Annual total"})).toBeChecked();
 expect(screen.getByText("Annual total known")).toBeInTheDocument();
});
test("loading and load failure have accessible recovery states",async()=>{
 open(new Error("offline"));
 expect(screen.getByRole("status")).toHaveTextContent("Loading consumption profile");
 expect(await screen.findByText("Consumption profile could not be loaded.")).toBeInTheDocument();
 vi.mocked(api.consumptionProfile).mockResolvedValue(null as never);
 fireEvent.click(screen.getByRole("button",{name:"Try again"}));
 expect(await screen.findByLabelText("January consumption")).toHaveValue(null);
});
