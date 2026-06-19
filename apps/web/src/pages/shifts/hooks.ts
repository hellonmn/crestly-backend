import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  HoursBulkUpdate, SalaryBulkUpdate, ShiftListQuery, ShiftListResponse, ShiftUpsertInput,
} from "@crestly/shared";

const KEY = ["shifts"] as const;

export function useShifts(query: Partial<ShiftListQuery>) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: async () => (await api.get<ShiftListResponse>("/shifts", { params: query })).data,
  });
}

export function useSaveShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ShiftUpsertInput) =>
      (await api.post<{ ok: true; id: number }>("/shifts", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useBulkHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: HoursBulkUpdate) =>
      (await api.post<{ ok: true; count: number }>("/shifts/bulk/hours", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useBulkSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalaryBulkUpdate) =>
      (await api.post<{ ok: true; count: number }>("/shifts/bulk/salary", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
