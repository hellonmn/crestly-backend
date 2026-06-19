import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DiaryDayQuery, DiaryDayResponse, DiarySaveInput } from "@crestly/shared";

const KEY = ["diary"] as const;

export function useDiaryDay(query: DiaryDayQuery | null) {
  return useQuery({
    queryKey: [...KEY, "day", query],
    enabled: !!query,
    queryFn: async () => (await api.get<DiaryDayResponse>("/diary", { params: query })).data,
  });
}

export function useSaveDiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DiarySaveInput) =>
      (await api.post<{ ok: true; id: number }>("/diary", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "day"] }),
  });
}
