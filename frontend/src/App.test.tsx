import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";

function renderApp(route = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SolarPlan application routes", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("renders the public SolarPlan introduction", () => {
    renderApp();
    expect(
      screen.getByRole("heading", { name: /understand what solar could mean for your roof/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start a solar project/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  test("redirects a signed-out visitor from a private route", async () => {
    renderApp("/dashboard");
    expect(
      await screen.findByRole("heading", { name: /open your workspace/i }),
    ).toBeInTheDocument();
  });

  test("logs in and opens the project dashboard", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "test-token", token_type: "bearer", expires_in: 1800 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "4b0b8808-fbcc-4f69-bff6-8f81f2dc8120",
            full_name: "Milan Petrovic",
            email: "milan@example.com",
            created_at: "2026-10-26T10:00:00Z",
            updated_at: "2026-10-26T10:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/login");
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "milan@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "SolarPlanTest1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^log in/i }));

    expect(
      await screen.findByRole("heading", { name: /good to see you, milan/i }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("solarplan.access_token")).toBe("test-token");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  test("loads, edits, and saves a roof configuration", async () => {
    const projectId = "4b0b8808-fbcc-4f69-bff6-8f81f2dc8120";
    const roofConfiguration = {
      id: "6b9f3e33-17ad-4d24-94cc-fd46d3359dd9",
      project_id: projectId,
      width_m: 8.4,
      length_m: 11.2,
      tilt_deg: 32,
      azimuth_deg: 180,
      edge_margin_m: 0.3,
      panel_gap_m: 0.02,
      lat: 43.8563,
      lon: 18.4131,
      location_label: "Family house, Sarajevo",
      created_at: "2026-10-29T10:00:00Z",
      updated_at: "2026-10-29T10:00:00Z",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "2ff4d702-c180-4084-a15a-51dc8280f466",
            full_name: "Milan Petrovic",
            email: "milan@example.com",
            created_at: "2026-10-26T10:00:00Z",
            updated_at: "2026-10-26T10:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(roofConfiguration), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...roofConfiguration, width_m: 9.1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.setItem("solarplan.access_token", "test-token");

    renderApp(`/projects/${projectId}/location`);

    const width = await screen.findByLabelText(/usable roof width/i);
    expect(width).toHaveValue(8.4);
    fireEvent.change(width, { target: { value: "9.1" } });
    fireEvent.click(screen.getByRole("button", { name: /save roof setup/i }));

    expect(
      await screen.findByText(/location and roof measurements saved/i),
    ).toBeInTheDocument();
    const putCall = fetchMock.mock.calls.find(
      ([, options]) => (options as RequestInit | undefined)?.method === "PUT",
    );
    expect(putCall).toBeDefined();
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toMatchObject({
      width_m: 9.1,
      lat: 43.8563,
      azimuth_deg: 180,
    });
  });

  test("searches for a location and applies the selected coordinates", async () => {
    const projectId = "4b0b8808-fbcc-4f69-bff6-8f81f2dc8120";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "2ff4d702-c180-4084-a15a-51dc8280f466",
            full_name: "Milan Petrovic",
            email: "milan@example.com",
            created_at: "2026-10-26T10:00:00Z",
            updated_at: "2026-10-26T10:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "6b9f3e33-17ad-4d24-94cc-fd46d3359dd9",
            project_id: projectId,
            width_m: 8.4,
            length_m: 11.2,
            tilt_deg: 32,
            azimuth_deg: 180,
            edge_margin_m: 0.3,
            panel_gap_m: 0.02,
            lat: 44.0,
            lon: 17.7,
            location_label: null,
            created_at: "2026-10-29T10:00:00Z",
            updated_at: "2026-10-29T10:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              display_name: "Sarajevo, Bosnia and Herzegovina",
              latitude: 43.8570713,
              longitude: 18.4126147,
              category: "boundary",
              type: "administrative",
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.setItem("solarplan.access_token", "test-token");

    renderApp(`/projects/${projectId}/location`);

    const searchInput = await screen.findByLabelText(/search for a place or address/i);
    fireEvent.change(searchInput, { target: { value: "Sarajevo" } });
    fireEvent.click(screen.getByRole("button", { name: /search location/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /sarajevo, bosnia and herzegovina/i }),
    );

    expect(screen.getByLabelText(/latitude/i)).toHaveValue(43.8570713);
    expect(screen.getByLabelText(/longitude/i)).toHaveValue(18.4126147);
    expect(screen.getByLabelText(/location label/i)).toHaveValue(
      "Sarajevo, Bosnia and Herzegovina",
    );
    expect(fetchMock.mock.calls[2][0]).toContain("/geocoding/search?q=Sarajevo");
  });

  test("shows persisted roof configuration on the project overview", async () => {
    const projectId = "4b0b8808-fbcc-4f69-bff6-8f81f2dc8120";
    const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/users/me")) {
        return jsonResponse({
          id: "2ff4d702-c180-4084-a15a-51dc8280f466",
          full_name: "Milan Petrovic",
          email: "milan@example.com",
          created_at: "2026-10-26T10:00:00Z",
          updated_at: "2026-10-26T10:00:00Z",
        });
      }
      if (url.endsWith(`/projects/${projectId}/roof`)) {
        return jsonResponse({
          id: "6b9f3e33-17ad-4d24-94cc-fd46d3359dd9",
          project_id: projectId,
          width_m: 8.4,
          length_m: 11.2,
          tilt_deg: 32,
          azimuth_deg: 180,
          edge_margin_m: 0.3,
          panel_gap_m: 0.02,
          lat: 43.8563,
          lon: 18.4131,
          location_label: "Family house, Sarajevo",
          created_at: "2026-10-29T10:00:00Z",
          updated_at: "2026-10-29T10:00:00Z",
        });
      }
      if (url.endsWith(`/projects/${projectId}`)) {
        return jsonResponse({
          id: projectId,
          owner_id: "2ff4d702-c180-4084-a15a-51dc8280f466",
          name: "Family house",
          description: "Residential solar estimate",
          created_at: "2026-10-26T10:00:00Z",
          updated_at: "2026-10-26T10:00:00Z",
        });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.setItem("solarplan.access_token", "test-token");

    renderApp(`/projects/${projectId}`);

    expect(await screen.findByRole("heading", { name: "Family house" })).toBeInTheDocument();
    expect(screen.getByText("Roof configured")).toBeInTheDocument();
    expect(screen.getByText("Family house, Sarajevo")).toBeInTheDocument();
    expect(screen.getByText("8.4 × 11.2 m")).toBeInTheDocument();
    expect(screen.getByText("180° · South")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review roof setup/i })).toHaveAttribute(
      "href",
      `/projects/${projectId}/location`,
    );
  });
});
