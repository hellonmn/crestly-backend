import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  WaActionBinding, WaBindingUpsertInput, WaLogEntry, WaSettings, WaSettingsUpdate, WaStats, WaTemplate,
} from "@crestly/shared";

const KEY = ["whatsapp"] as const;

export function useWaSettings() {
  return useQuery({
    queryKey: [...KEY, "settings"],
    queryFn: async () => (await api.get<WaSettings>("/whatsapp/settings")).data,
  });
}
export function useWaStats() {
  return useQuery({
    queryKey: [...KEY, "stats"],
    queryFn: async () => (await api.get<WaStats>("/whatsapp/stats")).data,
  });
}
export function useSaveWaSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WaSettingsUpdate) => (await api.put<WaSettings>("/whatsapp/settings", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
export function useWaTemplates() {
  return useQuery({
    queryKey: [...KEY, "templates"],
    queryFn: async () => (await api.get<WaTemplate[]>("/whatsapp/templates")).data,
  });
}
export function useRefreshTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<{ ok: true; synced: number }>("/whatsapp/templates/refresh")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
export function useWaBindings() {
  return useQuery({
    queryKey: [...KEY, "bindings"],
    queryFn: async () => (await api.get<WaActionBinding[]>("/whatsapp/bindings")).data,
  });
}
export function useUpsertBinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WaBindingUpsertInput) => (await api.post<WaActionBinding>("/whatsapp/bindings", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
export function useWaLog() {
  return useQuery({
    queryKey: [...KEY, "log"],
    queryFn: async () => (await api.get<WaLogEntry[]>("/whatsapp/log")).data,
  });
}
export function useWaTest() {
  return useMutation({
    mutationFn: async (toPhone: string) => (await api.post<{ ok: boolean; error?: string }>("/whatsapp/test", { toPhone })).data,
  });
}
