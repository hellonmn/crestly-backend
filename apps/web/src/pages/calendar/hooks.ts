import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CalendarEvent, CalendarEventUpsert, CalendarFeedResponse,
} from "@crestly/shared";

const KEY = ["calendar"] as const;

export function useCalendarFeed(params: { month?: string; from?: string; to?: string; classSlug?: string }) {
  return useQuery({
    queryKey: [...KEY, "feed", params],
    queryFn: async () =>
      (await api.get<CalendarFeedResponse>("/calendar/feed", { params })).data,
  });
}

export function useSaveCalendarEvent(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CalendarEventUpsert) =>
      id !== undefined
        ? (await api.put<CalendarEvent>(`/calendar/events/${id}`, input)).data
        : (await api.post<CalendarEvent>("/calendar/events", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.delete<{ ok: true }>(`/calendar/events/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
