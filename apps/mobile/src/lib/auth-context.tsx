import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { apiFetch, type LoginResponse } from "./api";

// The bearer token from /api/mobile/auth/login lives in the OS keystore
// (expo-secure-store), never in plain AsyncStorage. Signing out just
// forgets it; the token expires server-side on its own (30 days), and
// a password reset on the web invalidates it immediately.

const TOKEN_KEY = "lean-academy.session-token";

interface AuthState {
  /** undefined while the stored token is still being read. */
  token: string | null | undefined;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY)
      .then((stored) => setToken(stored))
      .catch(() => setToken(null));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { token: issued } = await apiFetch<LoginResponse>("/api/mobile/auth/login", {
      method: "POST",
      body: { email: email.trim(), password },
    });
    await SecureStore.setItemAsync(TOKEN_KEY, issued);
    setToken(issued);
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
  }, []);

  const value = useMemo(() => ({ token, signIn, signOut }), [token, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
