import type {
  GeocodingResult, LoginInput, LayoutInput, LayoutPreview, PanelLayout,
  Project, ProjectInput, ProjectLocation, ProjectLocationInput, RegisterInput,
  RoofSurface, RoofSurfaceInput, SolarPanel, TokenResponse, User,
} from "../types/api";
import { getAccessToken } from "./token-storage";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
type ValidationIssue = { msg?: string };
type ErrorBody = { detail?: string | { message?: string } | ValidationIssue[] };

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}
function errorMessage(body: ErrorBody | null, fallback: string): string {
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail)) return body.detail.map((issue) => issue.msg).filter(Boolean).join(" ");
  if (body?.detail && "message" in body.detail && body.detail.message) return body.detail.message;
  return fallback;
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorBody | null;
    throw new ApiError(errorMessage(body, "Something went wrong. Please try again."), response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  register: (input: RegisterInput) => request<User>("/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (input: LoginInput) => request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  currentUser: () => request<User>("/users/me"),
  projects: () => request<Project[]>("/projects"),
  project: (id: string) => request<Project>(`/projects/${id}`),
  createProject: (input: ProjectInput) => request<Project>("/projects", { method: "POST", body: JSON.stringify(input) }),
  updateProject: (id: string, input: ProjectInput) => request<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" }),
  projectLocation: (projectId: string) => request<ProjectLocation>(`/projects/${projectId}/location`),
  saveProjectLocation: (projectId: string, input: ProjectLocationInput) => request<ProjectLocation>(`/projects/${projectId}/location`, { method: "PUT", body: JSON.stringify(input) }),
  roofSurfaces: (projectId: string) => request<RoofSurface[]>(`/projects/${projectId}/roof-surfaces`),
  roofSurface: (projectId: string, surfaceId: string) => request<RoofSurface>(`/projects/${projectId}/roof-surfaces/${surfaceId}`),
  createRoofSurface: (projectId: string, input: RoofSurfaceInput) => request<RoofSurface>(`/projects/${projectId}/roof-surfaces`, { method: "POST", body: JSON.stringify(input) }),
  updateRoofSurface: (projectId: string, surfaceId: string, input: RoofSurfaceInput) => request<RoofSurface>(`/projects/${projectId}/roof-surfaces/${surfaceId}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteRoofSurface: (projectId: string, surfaceId: string) => request<void>(`/projects/${projectId}/roof-surfaces/${surfaceId}`, { method: "DELETE" }),
  solarPanels: () => request<SolarPanel[]>("/panels"),
  solarPanel: (id: string) => request<SolarPanel>(`/panels/${id}`),
  previewLayout: (projectId: string, surfaceId: string, input: LayoutInput) => request<LayoutPreview>(`/projects/${projectId}/roof-surfaces/${surfaceId}/layout/preview`, { method: "POST", body: JSON.stringify(input) }),
  panelLayout: (projectId: string, surfaceId: string) => request<PanelLayout>(`/projects/${projectId}/roof-surfaces/${surfaceId}/layout`),
  savePanelLayout: (projectId: string, surfaceId: string, input: LayoutInput) => request<PanelLayout>(`/projects/${projectId}/roof-surfaces/${surfaceId}/layout`, { method: "PUT", body: JSON.stringify(input) }),
  searchLocations: (query: string) => request<GeocodingResult[]>(`/geocoding/search?${new URLSearchParams({ q: query })}`),
  reverseLocation: (latitude: number, longitude: number) => request<GeocodingResult>(`/geocoding/reverse?${new URLSearchParams({ lat: String(latitude), lon: String(longitude) })}`),
};
