import type {
  LoginInput,
  Project,
  ProjectInput,
  RegisterInput,
  RoofConfiguration,
  RoofConfigurationInput,
  TokenResponse,
  User,
} from "../types/api";
import { getAccessToken } from "./token-storage";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

type ValidationIssue = {
  msg?: string;
};

type ErrorBody = {
  detail?: string | { message?: string } | ValidationIssue[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(body: ErrorBody | null, fallback: string): string {
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail)) {
    return body.detail.map((issue) => issue.msg).filter(Boolean).join(" ");
  }
  if (body?.detail && "message" in body.detail && body.detail.message) {
    return body.detail.message;
  }
  return fallback;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);

  if (options.body) headers.set("Content-Type", "application/json");
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
  register: (input: RegisterInput) =>
    request<User>("/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (input: LoginInput) =>
    request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  currentUser: () => request<User>("/users/me"),
  projects: () => request<Project[]>("/projects"),
  project: (id: string) => request<Project>(`/projects/${id}`),
  createProject: (input: ProjectInput) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(input) }),
  updateProject: (id: string, input: ProjectInput) =>
    request<Project>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" }),
  roofConfiguration: (projectId: string) =>
    request<RoofConfiguration>(`/projects/${projectId}/roof`),
  saveRoofConfiguration: (projectId: string, input: RoofConfigurationInput) =>
    request<RoofConfiguration>(`/projects/${projectId}/roof`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
};
