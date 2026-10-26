import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "../lib/api";
import { clearAccessToken, getAccessToken, setAccessToken } from "../lib/token-storage";
import type { LoginInput, RegisterInput, User } from "../types/api";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(getAccessToken()));

  useEffect(() => {
    if (!getAccessToken()) {
      setIsLoading(false);
      return;
    }

    api
      .currentUser()
      .then(setUser)
      .catch(() => clearAccessToken())
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login: async (input) => {
        const token = await api.login(input);
        setAccessToken(token.access_token);
        try {
          setUser(await api.currentUser());
        } catch (error) {
          clearAccessToken();
          throw error;
        }
      },
      register: async (input) => {
        await api.register(input);
        const token = await api.login({ email: input.email, password: input.password });
        setAccessToken(token.access_token);
        try {
          setUser(await api.currentUser());
        } catch (error) {
          clearAccessToken();
          throw error;
        }
      },
      logout: async () => {
        try {
          await api.logout();
        } finally {
          clearAccessToken();
          setUser(null);
        }
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
