import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PickupPointDetail, PickupPointListResponse, PickupPointUpsertInput,
} from "@crestly/shared";

const KEY = ["transport"] as const;

export function usePickupPoints(q?: string) {
  return useQuery({
    queryKey: [...KEY, "list", q],
    queryFn: async () => (await api.get<PickupPointListResponse>("/transport", { params: { q } })).data,
  });
}

export function usePickupPoint(id: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "one", id],
    enabled: id !== undefined && !Number.isNaN(id),
    queryFn: async () => (await api.get<PickupPointDetail>(`/transport/${id}`)).data,
  });
}

export function useSavePickup(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PickupPointUpsertInput) => {
      if (id) return (await api.put<PickupPointDetail>(`/transport/${id}`, input)).data;
      return (await api.post<PickupPointDetail>("/transport", input)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeletePickup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete<{ ok: true }>(`/transport/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
