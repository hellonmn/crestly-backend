import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AiAskInput, AiAskResponse,
  AiSettings, AiSettingsUpdate, AiTestResult,
} from "@crestly/shared";

const KEY = ["ai"] as const;

export function useAiSettings() {
  return useQuery({
    queryKey: [...KEY, "settings"],
    queryFn: async () => (await api.get<AiSettings>("/ai/settings")).data,
    staleTime: 30_000,
  });
}

export function useSaveAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AiSettingsUpdate) =>
      (await api.put<AiSettings>("/ai/settings", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "settings"] }),
  });
}

export function useTestAi() {
  return useMutation({
    mutationFn: async () =>
      (await api.post<AiTestResult>("/ai/settings/test")).data,
  });
}

export function useAiAsk() {
  return useMutation({
    mutationFn: async (input: AiAskInput) =>
      (await api.post<AiAskResponse>("/ai/ask", input, { timeout: 60_000 })).data,
  });
}
