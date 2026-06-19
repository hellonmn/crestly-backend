import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  FeaturesCatalogResponse, RazorpayOrderResponse, RazorpayVerifyInput,
} from "@crestly/shared";

const KEY = ["features-store"] as const;

export function useFeaturesCatalog() {
  return useQuery({
    queryKey: [...KEY, "catalog"],
    queryFn: async () => (await api.get<FeaturesCatalogResponse>("/features")).data,
  });
}

export function useCreateFeatureOrder() {
  return useMutation({
    mutationFn: async (featureKey: string) =>
      (await api.post<RazorpayOrderResponse>(`/features/${encodeURIComponent(featureKey)}/order`)).data,
  });
}

export function useVerifyFeaturePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RazorpayVerifyInput) =>
      (await api.post<{ ok: true; featureKey: string }>("/features/verify", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
