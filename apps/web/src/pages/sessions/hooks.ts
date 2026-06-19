import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AcademicSession, AcademicSessionUpsert } from "@crestly/shared";

const KEY = ["sessions"] as const;

export function useSessions() {
  return useQuery({
    queryKey: [...KEY, "list"],
    queryFn: async () => (await api.get<AcademicSession[]>("/sessions")).data,
  });
}

export function useCurrentSession() {
  return useQuery({
    queryKey: [...KEY, "current"],
    queryFn: async () => (await api.get<AcademicSession>("/sessions/current")).data,
    retry: false,
  });
}

export function useSaveSession(code: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AcademicSessionUpsert) => {
      if (code) return (await api.put<AcademicSession>(`/sessions/${code}`, input)).data;
      return (await api.post<AcademicSession>("/sessions", input)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSetCurrentSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => (await api.post<AcademicSession>(`/sessions/${code}/set-current`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
