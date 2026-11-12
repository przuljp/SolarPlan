import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NavigationEffects } from "./NavigationEffects";
function Harness() {
 const [count,setCount]=useState(0); const navigate=useNavigate();
 return <><NavigationEffects/><nav><Link to="/projects/p1">Overview</Link><Link to="/projects/p1/roof-surfaces">Roofs</Link><Link to="/projects/p1/analysis">Analysis</Link><Link to="/dashboard">Dashboard</Link><Link to="/dashboard#target">Anchor</Link><button onClick={()=>navigate(-1)}>Back</button><button onClick={()=>navigate(1)}>Forward</button></nav><main><button onClick={()=>setCount(count+1)}>State {count}</button><div id="target">Target</div></main></>;
}
beforeEach(()=>{vi.spyOn(window,"scrollTo").mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function open(){return render(<MemoryRouter initialEntries={["/dashboard"]}><Harness/></MemoryRouter>);}
test("standard navigations reset instantly and animate only main without remounting it",()=>{
 open();const main=screen.getByRole("main"), nav=screen.getByRole("navigation");
 for(const name of ["Overview","Roofs","Analysis","Dashboard"]){fireEvent.click(screen.getByRole("link",{name}));expect(window.scrollTo).toHaveBeenLastCalledWith({top:0,left:0,behavior:"instant"});expect(screen.getByRole("main")).toBe(main);expect(main).toHaveClass("route-enter");expect(nav).not.toHaveClass("route-enter");}
 const mutation=vi.spyOn(main.classList,"remove");fireEvent.click(screen.getByRole("button",{name:"State 0"}));expect(mutation).not.toHaveBeenCalled();expect(window.scrollTo).toHaveBeenCalledTimes(4);
});
test("Back and Forward do not override native restoration",()=>{open();fireEvent.click(screen.getByText("Overview"));vi.mocked(window.scrollTo).mockClear();fireEvent.click(screen.getByText("Back"));fireEvent.click(screen.getByText("Forward"));expect(window.scrollTo).not.toHaveBeenCalled();});
test("hash navigation reveals the anchor instead of resetting the page",()=>{
 open();const target=screen.getByText("Target");target.scrollIntoView=vi.fn();fireEvent.click(screen.getByText("Anchor"));expect(target.scrollIntoView).toHaveBeenCalledWith({behavior:"instant",block:"start"});expect(window.scrollTo).not.toHaveBeenCalled();expect(screen.getByRole("main")).not.toHaveClass("route-enter");
});
test("delayed hash target is revealed when asynchronous content arrives",async()=>{
 open();screen.getByText("Target").remove();fireEvent.click(screen.getByText("Anchor"));const target=document.createElement("div");target.id="target";target.scrollIntoView=vi.fn();document.body.append(target);await waitFor(()=>expect(target.scrollIntoView).toHaveBeenCalledOnce());target.remove();
});

