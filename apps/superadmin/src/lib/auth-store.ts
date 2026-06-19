import { useSyncExternalStore } from "react";
import type { SuperAdminProfile } from "@crestly/shared";

const TOKEN_KEY = "crestly.super.token";
const ADMIN_KEY = "crestly.super.admin";

interface AuthState {
  token: string | null;
  admin: SuperAdminProfile | null;
}

function read(): AuthState {
  try {
    return {
      token: localStorage.getItem(TOKEN_KEY),
      admin: JSON.parse(localStorage.getItem(ADMIN_KEY) ?? "null"),
    };
  } catch { return { token: null, admin: null }; }
}

const listeners = new Set<() => void>();
let snapshot: AuthState = read();
function emit() { snapshot = read(); listeners.forEach((l) => l()); }

export const adminStore = {
  get: () => snapshot,
  set(token: string, admin: SuperAdminProfile) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
    emit();
  },
  setAdmin(admin: SuperAdminProfile) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
    emit();
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    emit();
  },
  subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); },
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === TOKEN_KEY || e.key === ADMIN_KEY) emit();
  });
}

export function useSuperAuth() {
  return useSyncExternalStore(adminStore.subscribe, adminStore.get, adminStore.get);
}
