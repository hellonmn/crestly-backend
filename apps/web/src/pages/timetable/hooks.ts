import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  EligibleTeachersResponse,
  SmartAllotInput,
  SmartAllotResult,
  TimetableCell,
  TimetableCellUpsert,
  TimetableGridQuery,
  TimetableGridResponse,
  TimetablePeriod,
  TimetablePeriodUpsert,
  WorkloadRow,
} from "@crestly/shared";

const KEY = ["timetable"] as const;

/* ─── Reads ────────────────────────────────────────────────── */

export function useTimetable(query: TimetableGridQuery | null) {
  return useQuery({
    queryKey: [...KEY, "grid", query],
    enabled: !!query && (!!query.teacherUserId || (!!query.class && !!query.section)),
    queryFn: async () => (await api.get<TimetableGridResponse>("/timetable", { params: query })).data,
  });
}

export function useTimetablePeriods() {
  return useQuery({
    queryKey: [...KEY, "periods"],
    queryFn: async () => (await api.get<TimetablePeriod[]>("/timetable/periods")).data,
  });
}

export function useWorkload() {
  return useQuery({
    queryKey: [...KEY, "workload"],
    queryFn: async () => (await api.get<WorkloadRow[]>("/timetable/workload")).data,
  });
}

/** Eligible teachers per subject for a given class (band-aware). */
export function useEligibleTeachers(classSlug: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, "eligible", classSlug],
    enabled: !!classSlug,
    queryFn: async () =>
      (await api.get<EligibleTeachersResponse>("/timetable/eligible-teachers", {
        params: { class: classSlug },
      })).data,
    staleTime: 60_000,
  });
}

/* ─── Period mutations ─────────────────────────────────────── */

export function useSavePeriod(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TimetablePeriodUpsert) => {
      if (id) return (await api.put<TimetablePeriod>(`/timetable/periods/${id}`, input)).data;
      return (await api.post<TimetablePeriod>("/timetable/periods", input)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, "periods"] });
      qc.invalidateQueries({ queryKey: [...KEY, "grid"] });
    },
  });
}

export function useDeletePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.delete<{ ok: true }>(`/timetable/periods/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, "periods"] });
      qc.invalidateQueries({ queryKey: [...KEY, "grid"] });
    },
  });
}

/* ─── Cell mutations ───────────────────────────────────────── */

export function useSaveCell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TimetableCellUpsert) =>
      (await api.post<TimetableCell>("/timetable/cells", input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, "grid"] });
      qc.invalidateQueries({ queryKey: [...KEY, "workload"] });
    },
  });
}

/** Clear by row id (older callers may still use this). */
export function useDeleteCell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.delete<{ ok: true }>(`/timetable/cells/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, "grid"] });
      qc.invalidateQueries({ queryKey: [...KEY, "workload"] });
    },
  });
}

/** Clear by coordinates — preferred for the cell editor (mirrors PHP). */
export function useClearCell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { classSlug: string; sectionCode: string; dayOfWeek: number; periodId: number }) =>
      (await api.post<{ ok: true }>("/timetable/cells/clear", input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, "grid"] });
      qc.invalidateQueries({ queryKey: [...KEY, "workload"] });
    },
  });
}

/* ─── Smart allot ──────────────────────────────────────────── */

export function useSmartAllot() {
  const qc = useQueryClient();
  return useMutation({
    /** Scope='all' can be slow (60 sections × 8 periods × 6 days of
     *  writes). Give it 5 minutes before we time out client-side; the
     *  server runs the writes in a single transaction so it's usually
     *  much faster, but proxies/CDNs in front can be cranky. */
    mutationFn: async (input: SmartAllotInput) =>
      (await api.post<SmartAllotResult>("/timetable/smart-allot", input, {
        timeout: 5 * 60 * 1000,
      })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, "grid"] });
      qc.invalidateQueries({ queryKey: [...KEY, "workload"] });
    },
  });
}
