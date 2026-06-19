import axios, { AxiosError } from "axios";
import { adminStore } from "./auth-store";

const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api";

export const api = axios.create({ baseURL, headers: { "Content-Type": "application/json" } });

api.interceptors.request.use((cfg) => {
  const t = adminStore.get().token;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use((r) => r, (err: AxiosError) => {
  if (err.response?.status === 401) adminStore.clear();
  return Promise.reject(err);
});

export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data!.message.join(", ");
    if (typeof data?.message === "string") return data.message;
    return err.message || fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
