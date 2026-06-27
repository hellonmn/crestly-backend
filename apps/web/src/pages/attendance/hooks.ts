import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AttendanceBulk,
  AttendanceHistoryResponse,
  AttendanceMark,
  AttendanceRosterQuery,
  AttendanceRosterResponse,
  MarkableClassesResponse,
} from "@crestly/shared";

const KEY = ["attendance"] as const;

/** Classes the logged-in user may mark (class teachers → own section only). */
export function useMyAttendanceClasses() {
  return useQuery({
    queryKey: [...KEY, "my-classes"],
    staleTime: 5 * 60_000,
    queryFn: async () => (await api.get<MarkableClassesResponse>("/attendance/my-classes")).data,
  });
}

export function useRoster(query: AttendanceRosterQuery | null) {
  return useQuery({
    queryKey: [...KEY, "roster", query],
    enabled: !!query,
    queryFn: async () => (await api.get<AttendanceRosterResponse>("/attendance/roster", { params: query })).data,
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AttendanceMark) =>
      (await api.post<{ ok: true }>("/attendance/mark", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "roster"] }),
  });
}

export function useBulkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AttendanceBulk) =>
      (await api.post<{ ok: true; count: number }>("/attendance/bulk", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "roster"] }),
  });
}

export function useAttendanceHistory(srNumber: number | undefined, year: number, month: number) {
  return useQuery({
    queryKey: [...KEY, "history", srNumber, year, month],
    enabled: srNumber !== undefined && !Number.isNaN(srNumber),
    queryFn: async () =>
      (await api.get<AttendanceHistoryResponse>("/attendance/history", {
        params: { srNumber, year, month },
      })).data,
  });
}
