import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Student, StudentDetail, StudentListQuery, StudentListResponse, StudentUpsert,
} from "@crestly/shared";

const KEY = ["students"] as const;

export function useStudents(query: Partial<StudentListQuery>) {
  return useQuery({
    queryKey: [...KEY, "list", query],
    queryFn: async () => {
      const { data } = await api.get<StudentListResponse>("/students", { params: query });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useStudent(srNumber: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "one", srNumber],
    enabled: srNumber !== undefined && !Number.isNaN(srNumber),
    queryFn: async () => {
      const { data } = await api.get<Student>(`/students/${srNumber}`);
      return data;
    },
  });
}

/** Full StudentDetail payload powering the View page. */
export function useStudentDetail(srNumber: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "detail", srNumber],
    enabled: srNumber !== undefined && !Number.isNaN(srNumber),
    queryFn: async () => {
      const { data } = await api.get<StudentDetail>(`/students/${srNumber}/detail`);
      return data;
    },
  });
}

export function useSaveStudent(srNumber: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StudentUpsert) => {
      if (srNumber !== undefined) {
        const { data } = await api.put<Student>(`/students/${srNumber}`, input);
        return data;
      }
      const { data } = await api.post<Student>("/students", input);
      return data;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: [...KEY, "list"] });
      qc.setQueryData([...KEY, "one", saved.srNumber], saved);
    },
  });
}

/**
 * Bulk action endpoint used by the sticky action bar on the students list.
 * Mirrors the PHP page's POST `_bulk=activate|deactivate|delete` flow.
 */
export function useStudentBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { op: "activate" | "deactivate" | "delete"; srs: number[] }) => {
      const { data } = await api.post<{ affected: number }>("/students/bulk", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "list"] }),
  });
}
