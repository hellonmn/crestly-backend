import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  SchoolClass,
  SchoolClassUpsert,
  Section,
  SectionUpsert,
} from "@crestly/shared";

const KEY = ["classes"] as const;

export function useClasses() {
  return useQuery({
    queryKey: [...KEY, "list"],
    queryFn: async () => (await api.get<SchoolClass[]>("/classes")).data,
  });
}

export function useSaveClass(id: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SchoolClassUpsert) => {
      if (id !== undefined) return (await api.put<SchoolClass>(`/classes/${id}`, input)).data;
      return (await api.post<SchoolClass>("/classes", input)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete<{ ok: true }>(`/classes/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSaveSection(id: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SectionUpsert) => {
      if (id !== undefined) return (await api.put<Section>(`/sections/${id}`, input)).data;
      return (await api.post<Section>("/sections", input)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete<{ ok: true }>(`/sections/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
