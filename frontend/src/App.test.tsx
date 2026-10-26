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
});
