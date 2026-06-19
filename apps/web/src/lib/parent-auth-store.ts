import { useSyncExternalStore } from "react";
import type { ParentKid } from "@crestly/shared";

/* ============================================================
   Parent portal auth — fully separate from the admin/staff
   auth-store. Different localStorage keys so a school admin can
   be logged into BOTH portals on the same browser without one
   stomping the other.
   ============================================================ */

const TOKEN_KEY = "crestly.parent.token";
const KIDS_KEY  = "crestly.parent.kids";
const LABEL_KEY = "crestly.parent.label";

interface ParentSession {
  token: string | null;
  kids: ParentKid[];
  parentLabel: string | null;
}

function read(): ParentSession {
  try {
    return {
      token: localStorage.getItem(TOKEN_KEY),
      kids: JSON.parse(localStorage.getItem(KIDS_KEY) ?? "[]"),
      parentLabel: localStorage.getItem(LABEL_KEY),
    };
  } catch {
    return { token: null, kids: [], parentLabel: null };
  }
}

const listeners = new Set<() => void>();
let snapshot: ParentSession = read();
function emit() { snapshot = read(); listeners.forEach((l) => l()); }

export const parentAuthStore = {
  get: () => snapshot,
  set(token: string, kids: ParentKid[], parentLabel: string) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(KIDS_KEY, JSON.stringify(kids));
    localStorage.setItem(LABEL_KEY, parentLabel);
    emit();
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(KIDS_KEY);
    localStorage.removeItem(LABEL_KEY);
    emit();
  },
  subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); },
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === TOKEN_KEY || e.key === KIDS_KEY || e.key === LABEL_KEY) emit();
  });
}

export function useParentAuth() {
  return useSyncExternalStore(parentAuthStore.subscribe, parentAuthStore.get, parentAuthStore.get);
}
