import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DailyReportResponse } from "@crestly/shared";

export function useDailyReport(date: string) {
  return useQuery({
    queryKey: ["daily-report", date],
    queryFn: async () => (await api.get<DailyReportResponse>("/daily-report", { params: { date } })).data,
  });
}
