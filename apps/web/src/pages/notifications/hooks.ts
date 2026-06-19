import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AppNotification, NotificationListResponse } from "@crestly/shared";

const KEY = ["notifications"] as const;

export function useNotifications() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<NotificationListResponse>("/notifications")).data,
    refetchInterval: 60_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.post<AppNotification>(`/notifications/${id}/read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<{ ok: true; count: number }>("/notifications/mark-all-read")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
