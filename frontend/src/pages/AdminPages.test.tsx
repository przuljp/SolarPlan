import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "../App";
import { AuthProvider } from "../auth/AuthContext";

const account = { id: "a1", full_name: "QA Admin", email: "admin@example.com", role: "ADMIN", is_active: true };
const owner = { ...account, id: "u2", full_name: "QA Owner", email: "owner@example.com", role: "USER", project_count: 3 };
const panel = { id: "p1", manufacturer: "Test maker", model_sku: "QA-430", category: "standard", power_wp: 430, width_mm: 1134, length_mm: 1722, thickness_mm: 30, efficiency_percent: 22, cell_technology: "Mono", temperature_coefficient_pmax: -0.29, datasheet_url: "https://example.com/datasheet", bih_source_name: "Test source", bih_source_url: "https://example.com/panel", verified_at: "2026-01-01", is_active: true };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function open(route: string, role = "ADMIN", respond?: (path: string, init?: RequestInit) => Response) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/users/me")) return json({ ...account, role });
    if (path === "/api/v1/projects/workspace") return json({projects:[],total_projects:0,analyzed_projects:0,in_progress:0,latest_analysis:null});
    if (path === "/api/v1/projects") return json([]);
    return respond?.(path + new URL(url).search, init) ?? json({ total_users: 7, active_users: 5, total_projects: 12, panel_models: 9 });
  });
  vi.stubGlobal("fetch", fetch);
  sessionStorage.setItem("solarplan.access_token", "qa-token");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}><AuthProvider><App /></AuthProvider></MemoryRouter></QueryClientProvider>);
  return fetch;
}

beforeEach(() => { sessionStorage.clear(); vi.stubGlobal("confirm", vi.fn(() => true)); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test.each(["/admin", "/admin/users", "/admin/panels"])("blocks USER access to %s without requesting admin data", async (route) => {
  const fetch = open(route, "USER");
  expect(await screen.findByRole("heading", { name: /your solar workspace/i })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
  expect(fetch.mock.calls.some(([url]) => url.includes("/api/v1/admin"))).toBe(false);
});

test("shows backend dashboard counts and admin navigation", async () => {
  open("/admin");
  expect(await screen.findByText("12")).toBeInTheDocument();
  expect(screen.getByText("Total users")).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "Panel catalog" })).toHaveLength(2);
  expect(screen.queryByRole("link", { name: "Workspace" })).not.toBeInTheDocument();
  for (const brand of screen.getAllByRole("link", { name: "SolarPlan home" })) {
    expect(brand).toHaveAttribute("href", "/admin");
  }
});

test("redirects a signed-in administrator from login to administration", async () => {
  open("/login");
  expect(await screen.findByRole("heading", { name: "Administration" })).toBeInTheDocument();
});

test("filters accounts and confirms deactivation; current account is disabled", async () => {
  const fetch = open("/admin/users", "ADMIN", (path, init) => {
    if (init?.method === "PATCH") return json({ ...owner, is_active: false });
    if (path.startsWith("/api/v1/admin/users")) return json({ items: [{ ...account, project_count: 0 }, owner], total: 2, offset: 0, limit: 20 });
    return json({});
  });
  expect(await screen.findByText("owner@example.com")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Your account" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Search by email"), { target: { value: "owner" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes("email=owner"))).toBe(true));
  fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
  expect(await screen.findByText("Account deactivated.")).toBeInTheDocument();
  expect(window.confirm).toHaveBeenCalled();
  expect(fetch.mock.calls.some(([url, init]) => url.includes("/u2/activity") && init?.body === '{"is_active":false}')).toBe(true);
});

test("keeps a panel when confirmation is cancelled and shows server deletion conflicts", async () => {
  const fetch = open("/admin/panels", "ADMIN", (_, init) => init?.method === "DELETE" ? json({ detail: "This panel is in use. Deactivate it instead." }, 409) : json([panel]));
  await screen.findByRole("button", { name: "Edit QA-430" });
  vi.mocked(window.confirm).mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole("button", { name: "Delete QA-430" }));
  expect(fetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Delete QA-430" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("This panel is in use.");
  expect(screen.getByRole("button", { name: "Edit QA-430" })).toBeInTheDocument();
});

test("edits existing technical specifications using a numeric API payload", async () => {
  const fetch = open("/admin/panels", "ADMIN", (_, init) => init?.method === "PUT" ? json(panel) : json([panel]));
  await screen.findByRole("button", { name: "Edit QA-430" });
  fireEvent.click(screen.getByRole("button", { name: "Edit QA-430" }));
  fireEvent.change(screen.getByLabelText("Nominal power (Wp)"), { target: { value: "500" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByText("Panel saved.")).toBeInTheDocument();
  const call = fetch.mock.calls.find(([, init]) => init?.method === "PUT");
  expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ power_wp: 500, width_mm: 1134, temperature_coefficient_pmax: -0.29 });
  expect(JSON.parse(String(call?.[1]?.body))).not.toHaveProperty("is_active");
});

test("shows loading failures with retry and empty catalog state", async () => {
  let failed = true;
  open("/admin/panels", "ADMIN", () => failed ? json({ detail: "Catalog unavailable." }, 503) : json([]));
  expect(await screen.findByRole("alert")).toHaveTextContent("Catalog unavailable.");
  failed = false;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(/No panel models yet/)).toBeInTheDocument();
});
