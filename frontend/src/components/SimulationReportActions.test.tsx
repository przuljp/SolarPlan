import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { SimulationReportActions } from "./SimulationReportActions";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Simulation report downloads", () => {
  test.each(["pdf", "csv"] as const)("downloads authenticated %s for the selected snapshot", async (format) => {
    const fetch = vi.fn().mockResolvedValue(new Response("report", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const createObjectURL = vi.fn().mockReturnValue("blob:report");
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = vi.fn();
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    sessionStorage.setItem("solarplan.access_token", "test-token");
    render(<SimulationReportActions projectId="p1" simulationId="saved2" />);

    fireEvent.click(screen.getByRole("button", { name: `Download ${format.toUpperCase()}` }));

    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(fetch.mock.calls[0][0]).toContain(`/projects/p1/simulations/saved2/report?format=${format}`);
    expect(fetch.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer test-token");
    expect(createObjectURL).toHaveBeenCalledOnce();
    const link = click.mock.instances[0] as HTMLAnchorElement;
    expect(link.download).toBe(`solarplan-saved2.${format}`);
    expect(link.isConnected).toBe(false);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("disables both actions while downloading and allows retry after a failure", async () => {
    let complete!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { complete = resolve; }));
    vi.stubGlobal("fetch", fetch);
    render(<SimulationReportActions projectId="p1" simulationId="saved2" />);
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(screen.getByRole("button", { name: "Preparing PDF…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeDisabled();
    complete(new Response(JSON.stringify({ detail: { message: "Authentication is required." } }), { status: 401 }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Authentication is required.");
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
    complete(new Response(null, { status: 503 }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be downloaded/i);
  });
});
