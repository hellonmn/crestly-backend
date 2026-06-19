import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PunchCreateInput,
  PunchTodayResponse,
  StaffPunch,
  StaffPunchListQuery,
  StaffPunchListResponse,
} from "@crestly/shared";

const KEY = ["staff-attendance"] as const;

export function useStaffAttendance(query: Partial<StaffPunchListQuery>) {
  return useQuery({
    queryKey: [...KEY, "list", query],
    queryFn: async () => (await api.get<StaffPunchListResponse>("/staff-attendance", { params: query })).data,
  });
}

export function useStaffPunchDetail(id: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "one", id],
    enabled: id !== undefined && !Number.isNaN(id),
    queryFn: async () => (await api.get<StaffPunch>(`/staff-attendance/${id}`)).data,
  });
}

export function usePunch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PunchCreateInput) => (await api.post<StaffPunch>("/punch", input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["punch", "today"] });
    },
  });
}

export function usePunchToday() {
  return useQuery({
    queryKey: ["punch", "today"],
    queryFn: async () => (await api.get<PunchTodayResponse>("/punch/today")).data,
    refetchOnWindowFocus: true,
  });
}
