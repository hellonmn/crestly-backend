import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CoGradeSave, ExamClassSubjectToggle, ExamDatesheetRow, ExamDatesheetUpsert,
  ExamMarkSave, ExamMarksQuery, ExamMarksResponse, ExamSubject, ExamSubjectUpsert,
  ExamTerm, ExamTermUpsert, ResultsQuery, ResultsResponse, Marksheet,
} from "@crestly/shared";

const KEY = ["exams"] as const;

// --- terms ---
export function useExamTerms() {
  return useQuery({
    queryKey: [...KEY, "terms"],
    queryFn: async () => (await api.get<ExamTerm[]>("/exams/terms")).data,
  });
}
export function useSaveTerm(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExamTermUpsert) => {
      if (id) return (await api.put<ExamTerm>(`/exams/terms/${id}`, input)).data;
      return (await api.post<ExamTerm>("/exams/terms", input)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "terms"] }),
  });
}
export function useDeleteTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete<{ ok: true }>(`/exams/terms/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "terms"] }),
  });
}
export function useToggleFinalize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, finalize }: { id: number; finalize: boolean }) =>
      (await api.post<ExamTerm>(`/exams/terms/${id}/${finalize ? "finalize" : "unfinalize"}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "terms"] }),
  });
}

// --- subjects ---
export function useExamSubjects() {
  return useQuery({
    queryKey: [...KEY, "subjects"],
    queryFn: async () => (await api.get<ExamSubject[]>("/exams/subjects")).data,
  });
}
export function useSaveSubject(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExamSubjectUpsert) => {
      if (id) return (await api.put<ExamSubject>(`/exams/subjects/${id}`, input)).data;
      return (await api.post<ExamSubject>("/exams/subjects", input)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "subjects"] }),
  });
}
export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete<{ ok: true }>(`/exams/subjects/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "subjects"] }),
  });
}
export function useToggleSubjectClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExamClassSubjectToggle) =>
      (await api.post<{ ok: true }>("/exams/subjects/class-toggle", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "subjects"] }),
  });
}

// --- datesheet ---
export function useDatesheet(termId: number | undefined, classSlug?: string) {
  return useQuery({
    queryKey: [...KEY, "datesheet", termId, classSlug],
    enabled: termId !== undefined && !Number.isNaN(termId),
    queryFn: async () =>
      (await api.get<ExamDatesheetRow[]>("/exams/datesheet", { params: { termId, class: classSlug } })).data,
  });
}
export function useSaveDatesheet(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExamDatesheetUpsert) => {
      if (id) return (await api.put<ExamDatesheetRow>(`/exams/datesheet/${id}`, input)).data;
      return (await api.post<ExamDatesheetRow>("/exams/datesheet", input)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "datesheet"] }),
  });
}
export function useDeleteDatesheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete<{ ok: true }>(`/exams/datesheet/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "datesheet"] }),
  });
}

// --- marks ---
export function useMarks(query: ExamMarksQuery | null) {
  return useQuery({
    queryKey: [...KEY, "marks", query],
    enabled: !!query,
    queryFn: async () => (await api.get<ExamMarksResponse>("/exams/marks", { params: query })).data,
  });
}
export function useSaveMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExamMarkSave) => (await api.post<{ ok: true }>("/exams/marks", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "marks"] }),
  });
}

// --- co-scholastic ---
export function useCoGrid(termId: number | undefined, classSlug: string, section: string) {
  return useQuery({
    queryKey: [...KEY, "co", termId, classSlug, section],
    enabled: termId !== undefined && !!classSlug && !!section,
    queryFn: async () =>
      (await api.get("/exams/co-grid", { params: { termId, class: classSlug, section } })).data as {
        term: { id: number; name: string; isFinalized: boolean };
        areas: { id: number; name: string; description: string | null; sortOrder: number }[];
        students: { srNumber: number; studentName: string; grades: Record<number, "A" | "B" | "C" | null> }[];
      },
  });
}
export function useSaveCoGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CoGradeSave) => (await api.post<{ ok: true }>("/exams/co-grade", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "co"] }),
  });
}

// --- results ---
export function useResults(query: ResultsQuery | null) {
  return useQuery({
    queryKey: [...KEY, "results", query],
    enabled: !!query,
    queryFn: async () => (await api.get<ResultsResponse>("/exams/results", { params: query })).data,
  });
}

// --- marksheet (single-student print payload) ---
export function useMarksheet(sr: number | undefined, termId?: number) {
  return useQuery({
    queryKey: [...KEY, "marksheet", sr, termId ?? null],
    enabled: typeof sr === "number" && !Number.isNaN(sr),
    queryFn: async () =>
      (await api.get<Marksheet>(`/exams/marksheet/${sr}`, {
        params: termId ? { termId } : {},
      })).data,
  });
}
