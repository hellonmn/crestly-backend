import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PromoteSectionBulk, PromotionOverview, PromotionSectionQuery, PromotionStudent,
} from "@crestly/shared";

const KEY = ["promotion"] as const;

export function usePromotionOverview() {
  return useQuery({
    queryKey: [...KEY, "overview"],
    queryFn: async () => (await api.get<PromotionOverview>("/promotion")).data,
  });
}

export function usePromotionSection(query: PromotionSectionQuery | null) {
  return useQuery({
    queryKey: [...KEY, "section", query],
    enabled: !!query,
    queryFn: async () => (await api.get<PromotionStudent[]>("/promotion/section", { params: query })).data,
  });
}

export function usePromoteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: PromoteSectionBulk) =>
      (await api.post<{ ok: true; count: number }>("/promotion/section", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useFinalizePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await api.post<{ ok: true; promoted: number; graduated: number; heldBack: number }>("/promotion/finalize")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
