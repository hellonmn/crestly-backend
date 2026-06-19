import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SchoolInfo, SchoolInfoUpdate } from "@crestly/shared";

const KEY = ["school-info"] as const;

export function useSchoolInfo() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<SchoolInfo>("/school-info")).data,
  });
}

export function useSaveSchoolInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SchoolInfoUpdate) => (await api.put<SchoolInfo>("/school-info", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
