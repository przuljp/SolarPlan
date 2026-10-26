export type User = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  updated_at: string;
};

export type ProjectStatus = "draft";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

export type ProjectInput = {
  name: string;
  description?: string | null;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  full_name: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};
