import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  EditRequest, EditRequestListQuery, EditRequestStatus, ReviewDecisionInput,
} from "@crestly/shared";

const KEY = ["approvals"] as const;

export function useEditRequests(query: { status?: EditRequestStatus; mine?: boolean }) {
  return useQuery({
    queryKey: [...KEY, "list", query],
    queryFn: async () => (await api.get<EditRequest[]>("/approvals", { params: query satisfies EditRequestListQuery })).data,
  });
}

export function useEditRequest(id: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "one", id],
    enabled: id !== undefined && !Number.isNaN(id),
    queryFn: async () => (await api.get<EditRequest>(`/approvals/${id}`)).data,
  });
}

export function useReviewRequest(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReviewDecisionInput) =>
      (await api.post<EditRequest>(`/approvals/${id}/review`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
