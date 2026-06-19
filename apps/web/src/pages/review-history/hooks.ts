import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ReviewHistoryResponse } from "@crestly/shared";

export function useReviewHistory(window = 30) {
  return useQuery({
    queryKey: ["review-history", window],
    queryFn: async () => (await api.get<ReviewHistoryResponse>("/review-history", { params: { window } })).data,
  });
}
