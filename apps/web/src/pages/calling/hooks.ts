import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CallingSettings, CallingSettingsUpdate, CallingTestResult,
} from "@crestly/shared";

const KEY = ["calling"] as const;

export function useCallingSettings() {
  return useQuery({
    queryKey: [...KEY, "settings"],
    queryFn: async () => (await api.get<CallingSettings>("/calling/settings")).data,
    staleTime: 30_000,
  });
}

export function useSaveCallingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CallingSettingsUpdate) =>
      (await api.put<CallingSettings>("/calling/settings", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "settings"] }),
  });
}

export function useTestCalling() {
  return useMutation({
    mutationFn: async () => (await api.post<CallingTestResult>("/calling/settings/test")).data,
  });
}
