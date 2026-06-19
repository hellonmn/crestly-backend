import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Family,
  FamilyListQuery,
  FamilyListResponse,
  FamilyUpsert,
} from "@crestly/shared";

const KEY = ["families"] as const;

export function useFamilies(query: Partial<FamilyListQuery>) {
  return useQuery({
    queryKey: [...KEY, "list", query],
    queryFn: async () => (await api.get<FamilyListResponse>("/families", { params: query })).data,
  });
}

export function useFamily(familyId: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "one", familyId],
    enabled: familyId !== undefined && !Number.isNaN(familyId),
    queryFn: async () => (await api.get<Family>(`/families/${familyId}`)).data,
  });
}

export function useSaveFamily(familyId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FamilyUpsert) => {
      if (familyId !== undefined) return (await api.put<Family>(`/families/${familyId}`, input)).data;
      return (await api.post<Family>("/families", input)).data;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: [...KEY, "list"] });
      qc.setQueryData([...KEY, "one", saved.familyId], saved);
    },
  });
}

export function useDeleteFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (familyId: number) =>
      (await api.delete<{ ok: true }>(`/families/${familyId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
