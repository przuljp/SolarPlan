import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { AiExplanation } from "../types/api";
import { AiExplanationPanel } from "./AiExplanationPanel";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const example: AiExplanation = {
  simulation_id: "saved", comparison_simulation_id: null, consumption_included: false,
  consumption_updated_at: null, source: "openai", model: "gpt-5-mini", cached: false,
  generated_at: "2026-11-05T10:00:00Z",
  content: {
    summary: "The saved configuration is a preliminary energy estimate.",
    production_insights: ["Installed power describes the system capacity."],
    seasonal_insights: "The monthly pattern varies through the year.",
    consumption_insights: null, comparison_insights: null,
    limitations: ["Production varies with actual weather."],
  },
};

function setup(comparisonSimulationId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><AiExplanationPanel projectId="p1" simulationId="saved" comparisonSimulationId={comparisonSimulationId} /></QueryClientProvider>);
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });

describe("AI result explanations", () => {
  test("is unavailable without a configured backend and never posts automatically", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ available: false }));
    vi.stubGlobal("fetch", fetch);
    setup();
    expect(await screen.findByText(/AI explanations are not available yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explain results" })).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain("/ai/status");
  });

  test("explains only after a click and renders the structured response", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ available: true })).mockResolvedValueOnce(json(example));
    vi.stubGlobal("fetch", fetch);
    sessionStorage.setItem("solarplan.access_token", "test-token");
    setup();
    await waitFor(() => expect(screen.getByRole("button", { name: "Explain results" })).toBeEnabled());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Your name, address and coordinates are not sent/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Explain results" }));
    expect(await screen.findByText(example.content.summary)).toBeInTheDocument();
    expect(fetch.mock.calls[1][0]).toContain("/projects/p1/simulations/saved/explanation");
    const options = fetch.mock.calls[1][1];
    expect(options.headers.get("Authorization")).toBe("Bearer test-token");
    expect(JSON.parse(options.body)).toEqual({ comparison_simulation_id: null, include_current_consumption: false });
    expect(screen.getByRole("heading", { name: "Seasonal pattern" })).toBeInTheDocument();
    expect(screen.getByText(/AI-generated explanation/i)).toBeInTheDocument();
    const hide = screen.getByRole("button", { name: "Hide explanation" });
    expect(hide).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(hide);
    expect(screen.getByText(example.content.summary)).not.toBeVisible();
    const show = screen.getByRole("button", { name: "Show explanation" });
    expect(show).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(show);
    expect(screen.getByText(example.content.summary)).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("heading", { name: "Current household consumption" })).not.toBeInTheDocument();
  });

  test("sends selected comparison IDs and explicit consumption opt-in", async () => {
    const result = { ...example, comparison_simulation_id: "newer", consumption_included: true, content: { ...example.content, comparison_insights: "The newer system produces more across the saved year.", consumption_insights: "The baseline production exceeds the current household annual total." } };
    const fetch = vi.fn().mockResolvedValueOnce(json({ available: true })).mockResolvedValueOnce(json(result));
    vi.stubGlobal("fetch", fetch);
    setup("newer");
    await waitFor(() => expect(screen.getByRole("button", { name: "Explain results" })).toBeEnabled());
    const option = screen.getByRole("checkbox");
    expect(option).not.toBeChecked();
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Explain results" }));
    expect(await screen.findByText(result.content.comparison_insights)).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ comparison_simulation_id: "newer", include_current_consumption: true });
    expect(screen.getByRole("heading", { name: "Current household consumption (baseline)" })).toBeInTheDocument();
  });

  test("handles pending, failure and explicit retry without automatic paid retries", async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(json({ available: true }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce(json(example));
    vi.stubGlobal("fetch", fetch);
    setup();
    await waitFor(() => expect(screen.getByRole("button", { name: "Explain results" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Explain results" }));
    expect(await screen.findByRole("button", { name: "Explaining…" })).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    finish(json({ detail: { message: "Please wait before trying again." } }, 429));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please wait before trying again.");
    expect(fetch).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Explain results" }));
    expect(await screen.findByText(example.content.summary)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("reports a missing consumption profile without inventing consumption", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ available: true })).mockResolvedValueOnce(json(example)));
    setup();
    await waitFor(() => expect(screen.getByRole("button", { name: "Explain results" })).toBeEnabled());
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Explain results" }));
    expect(await screen.findByText(/No household consumption profile was available/i)).toBeInTheDocument();
  });

  test("rechecks availability after a configuration change", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ available: false })).mockResolvedValueOnce(json({ available: true })));
    setup();
    expect(await screen.findByText(/AI explanations are not available yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Explain results" })).toBeEnabled());
  });
});
