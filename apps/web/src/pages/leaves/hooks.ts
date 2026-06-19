import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Leave, LeaveApplyInput, LeaveDecisionInput, LeaveListQuery, LeaveListResponse, LeaveType,
} from "@crestly/shared";

const KEY = ["leaves"] as const;

export function useLeaves(query: Partial<LeaveListQuery>) {
  return useQuery({
    queryKey: [...KEY, "list", query],
    queryFn: async () => (await api.get<LeaveListResponse>("/leaves", { params: query })).data,
  });
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: [...KEY, "types"],
    queryFn: async () => (await api.get<LeaveType[]>("/leaves/types")).data,
  });
}

export function useApplyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeaveApplyInput) => (await api.post<Leave>("/leaves", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDecideLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: LeaveDecisionInput }) =>
      (await api.post<Leave>(`/leaves/${id}/decide`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.post<Leave>(`/leaves/${id}/cancel`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
