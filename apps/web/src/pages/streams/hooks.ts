import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StreamSummary } from "@crestly/shared";

interface StreamRosterRow {
  srNumber: number;
  studentName: string;
  class: string;
  section: string;
  fatherName: string | null;
  gender: string | null;
}

export function useStreams() {
  return useQuery({
    queryKey: ["streams", "summary"],
    queryFn: async () => (await api.get<StreamSummary[]>("/streams")).data,
  });
}

export function useStreamRoster(stream: string | undefined) {
  return useQuery({
    queryKey: ["streams", "roster", stream],
    enabled: !!stream,
    queryFn: async () => (await api.get<StreamRosterRow[]>(`/streams/${stream}/roster`)).data,
  });
}
