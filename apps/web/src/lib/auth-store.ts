import { useSyncExternalStore } from "react";
import type { CurrentUser } from "@crestly/shared";

const TOKEN_KEY = "crestly.token";
const USER_KEY = "crestly.user";

interface AuthState {
  token: string | null;
  user: CurrentUser | null;
}

function read(): AuthState {
  try {
    return {
      token: localStorage.getItem(TOKEN_KEY),
      user: JSON.parse(localStorage.getItem(USER_KEY) ?? "null"),
    };
  } catch {
    return { token: null, user: null };
  }
}

const listeners = new Set<() => void>();
let snapshot: AuthState = read();

function emit() {
  snapshot = read();
  listeners.forEach((l) => l());
}

export const authStore = {
  get: () => snapshot,
  set(token: string, user: CurrentUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    emit();
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    emit();
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

if (typeof window !== "undefined") {
  // Sync across tabs.
  window.addEventListener("storage", (e) => {
    if (e.key === TOKEN_KEY || e.key === USER_KEY) emit();
  });
}

export function useAuth() {
  return useSyncExternalStore(authStore.subscribe, authStore.get, authStore.get);
}
