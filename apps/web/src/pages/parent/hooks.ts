import { useQuery } from "@tanstack/react-query";
import { parentApi } from "@/lib/parent-api";
import type {
  ParentAttendanceMonth, ParentContactResponse, ParentDiaryResponse,
  ParentExamsResponse, ParentFeesResponse, ParentLoginResponse,
  ParentMoreInfo, ParentTimetableResponse,
} from "@crestly/shared";

const KEY = ["parent"] as const;

export function useParentHome() {
  return useQuery({
    queryKey: [...KEY, "home"],
    queryFn: async () => (await parentApi.get<ParentLoginResponse>("/parent/home")).data,
  });
}

export function useParentAttendance(sr: number, month: string) {
  return useQuery({
    queryKey: [...KEY, "attendance", sr, month],
    enabled: sr > 0,
    queryFn: async () =>
      (await parentApi.get<ParentAttendanceMonth>("/parent/attendance", { params: { sr, m: month } })).data,
  });
}

export function useParentExams(sr: number) {
  return useQuery({
    queryKey: [...KEY, "exams", sr],
    enabled: sr > 0,
    queryFn: async () =>
      (await parentApi.get<ParentExamsResponse>("/parent/exams", { params: { sr } })).data,
  });
}

export function useParentFees(sr: number) {
  return useQuery({
    queryKey: [...KEY, "fees", sr],
    enabled: sr > 0,
    queryFn: async () =>
      (await parentApi.get<ParentFeesResponse>("/parent/fees", { params: { sr } })).data,
  });
}

export function useParentDiary(sr: number, date: string) {
  return useQuery({
    queryKey: [...KEY, "diary", sr, date],
    enabled: sr > 0,
    queryFn: async () =>
      (await parentApi.get<ParentDiaryResponse>("/parent/diary", { params: { sr, d: date } })).data,
  });
}

export function useParentTimetable(sr: number) {
  return useQuery({
    queryKey: [...KEY, "timetable", sr],
    enabled: sr > 0,
    queryFn: async () =>
      (await parentApi.get<ParentTimetableResponse>("/parent/timetable", { params: { sr } })).data,
  });
}

export function useParentContact(sr: number) {
  return useQuery({
    queryKey: [...KEY, "contact", sr],
    enabled: sr > 0,
    queryFn: async () =>
      (await parentApi.get<ParentContactResponse>("/parent/contact", { params: { sr } })).data,
  });
}

export function useParentMoreInfo() {
  return useQuery({
    queryKey: [...KEY, "more"],
    staleTime: 5 * 60_000,
    queryFn: async () => (await parentApi.get<ParentMoreInfo>("/parent/more")).data,
  });
}
