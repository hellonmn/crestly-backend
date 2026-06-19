import axios, { AxiosError } from "axios";
import { parentAuthStore } from "./parent-auth-store";

/* ============================================================
   Parent-portal axios instance.

   Keeps a separate token namespace from the admin/staff API.
   Same baseURL (the Nest server hosts both at /api/parent/*)
   but the Authorization header comes from
   localStorage.crestly.parent.token, not the staff store.
   ============================================================ */

export const parentApi = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

parentApi.interceptors.request.use((cfg) => {
  const t = parentAuthStore.get().token;
  if (t) cfg.headers.set("Authorization", `Bearer ${t}`);
  return cfg;
});

parentApi.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    // If our parent token is dead, drop it so the route guards
    // bounce the user to /parent/login.
    if (err.response?.status === 401) parentAuthStore.clear();
    return Promise.reject(err);
  },
);

export function getParentErrorMessage(err: unknown, fallback: string): string {
  const ax = err as AxiosError<{ message?: string | string[] }>;
  const data = ax?.response?.data;
  if (data?.message) {
    return Array.isArray(data.message) ? data.message.join(" · ") : data.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
