import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ImportCommitResponse, ImportPreviewRequest, ImportPreviewResponse,
} from "@crestly/shared";

export function usePreviewImport() {
  return useMutation({
    mutationFn: async (input: ImportPreviewRequest) =>
      (await api.post<ImportPreviewResponse>("/import/preview", input)).data,
  });
}

export function useCommitImport() {
  return useMutation({
    mutationFn: async (token: string) =>
      (await api.post<ImportCommitResponse>("/import/commit", { token })).data,
  });
}
