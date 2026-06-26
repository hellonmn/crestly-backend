import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Test, TestListItem, TestListQuery, TestUpsert, TestResultsResponse,
} from "@crestly/shared";

const KEY = ["tests"] as const;

export function useTests(query: TestListQuery) {
  return useQuery({
    queryKey: [...KEY, "list", query],
    queryFn: async () => (await api.get<TestListItem[]>("/tests", { params: query })).data,
  });
}

export function useTest(id?: number) {
  return useQuery({
    queryKey: [...KEY, "one", id],
    enabled: id !== undefined,
    queryFn: async () => (await api.get<Test>(`/tests/${id}`)).data,
  });
}

export function useTestResults(id: number) {
  return useQuery({
    queryKey: [...KEY, "results", id],
    queryFn: async () => (await api.get<TestResultsResponse>(`/tests/${id}/results`)).data,
  });
}

export function useSaveTest(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TestUpsert) =>
      id !== undefined
        ? (await api.put<Test>(`/tests/${id}`, input)).data
        : (await api.post<Test>("/tests", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSetTestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "publish" | "close" }) =>
      (await api.post<Test>(`/tests/${id}/${action}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete<{ ok: true }>(`/tests/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
