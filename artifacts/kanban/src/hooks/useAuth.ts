import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getListBoardsQueryKey } from "@workspace/api-client-react";

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
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

interface SignupPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  inviteToken?: string;
}

async function signup(payload: SignupPayload): Promise<AuthUser> {
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Sign up failed"));
  }
  return res.json();
}

async function updateProfile(firstName: string, lastName: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/api/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ firstName, lastName }),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to update profile"));
  }
  return res.json();
}

export interface InvitePreview {
  email: string;
  teamName: string;
  token: string;
}

export async function fetchInvitePreview(token: string): Promise<InvitePreview> {
  const res = await fetch(`${BASE}/api/auth/invite/${encodeURIComponent(token)}`);
  if (!res.ok) {
    throw new Error(await parseError(res, "Invitation not found or expired"));
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
    mutationFn: (payload: SignupPayload) => signup(payload),
    onSuccess: (user) => {
      qc.setQueryData(AUTH_QUERY_KEY, user);
      qc.invalidateQueries({ queryKey: getListBoardsQueryKey() });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ firstName, lastName }: { firstName: string; lastName: string }) =>
      updateProfile(firstName, lastName),
    onSuccess: (user) => {
      qc.setQueryData(AUTH_QUERY_KEY, user);
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

export function userInitials(user: { firstName: string; lastName: string }) {
  const first = user.firstName?.[0] ?? "";
  const last = user.lastName?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

export function userDisplayName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`.trim();
}
