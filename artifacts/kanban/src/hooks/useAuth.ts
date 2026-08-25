import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getListBoardsQueryKey } from "@workspace/api-client-react";

interface AuthUser {
  id: number;
  email: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function parseError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data.error === "string" ? data.error : fallback;
}

async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch auth");
  return res.json();
}

async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Login failed"));
  }
  return res.json();
}

async function signup(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Sign up failed"));
  }
  return res.json();
}

async function logout(): Promise<void> {
  await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
}

export const AUTH_QUERY_KEY = ["auth", "me"];

export function useMe() {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchMe,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: (user) => {
      qc.setQueryData(AUTH_QUERY_KEY, user);
      qc.invalidateQueries({ queryKey: getListBoardsQueryKey() });
    },
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signup(email, password),
    onSuccess: (user) => {
      qc.setQueryData(AUTH_QUERY_KEY, user);
      qc.invalidateQueries({ queryKey: getListBoardsQueryKey() });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      qc.setQueryData(AUTH_QUERY_KEY, null);
      qc.clear();
    },
  });
}
