import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { api } from "../lib/api";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("../lib/api", () => ({ api: { login: vi.fn(), currentUser: vi.fn(), logout: vi.fn() } }));
afterEach(() => { cleanup(); sessionStorage.clear(); vi.resetAllMocks(); });
function Controls() {
  const auth = useAuth();
  return <><span>{auth.user?.full_name ?? "Signed out"}</span><button onClick={() => auth.login({ email: "qa@example.com", password: "test" })}>Sign in</button><button onClick={() => auth.logout()}>Sign out</button></>;
}
test("clears private cached data when switching sessions and on logout", async () => {
  const client = new QueryClient();
  client.setQueryData(["projects"], [{ name: "Previous user's private project" }]);
  vi.mocked(api.login).mockResolvedValue({ access_token: "test-token" } as never);
  vi.mocked(api.currentUser).mockResolvedValue({ full_name: "New user" } as never);
  vi.mocked(api.logout).mockResolvedValue(undefined);
  render(<QueryClientProvider client={client}><AuthProvider><Controls /></AuthProvider></QueryClientProvider>);
  fireEvent.click(screen.getByText("Sign in"));
  await screen.findByText("New user");
  expect(client.getQueryData(["projects"])).toBeUndefined();
  client.setQueryData(["projects"], [{ name: "New private project" }]);
  fireEvent.click(screen.getByText("Sign out"));
  await waitFor(() => expect(client.getQueryData(["projects"])).toBeUndefined());
  expect(sessionStorage.getItem("solarplan.access_token")).toBeNull();
});
