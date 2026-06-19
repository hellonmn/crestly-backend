import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Holiday, HolidayCalendarResponse, HolidayUpsert } from "@crestly/shared";

const KEY = ["holidays"] as const;

export function useHolidayCalendar(academicYear?: number) {
  return useQuery({
    queryKey: [...KEY, "calendar", academicYear ?? "current"],
    queryFn: async () =>
      (await api.get<HolidayCalendarResponse>("/holidays", { params: academicYear ? { academicYear } : {} })).data,
  });
}

export function useSaveHoliday(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: HolidayUpsert) => {
      if (id !== undefined) return (await api.put<Holiday>(`/holidays/${id}`, input)).data;
      return (await api.post<Holiday>("/holidays", input)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete<{ ok: true }>(`/holidays/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
