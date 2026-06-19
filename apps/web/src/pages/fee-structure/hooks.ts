import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FeeStructureRow, FeeStructureUpsert, TransportSlabRow } from "@crestly/shared";

const KEY = ["fee-structure"] as const;

export function useFeeStructure() {
  return useQuery({
    queryKey: [...KEY, "list"],
    queryFn: async () => (await api.get<FeeStructureRow[]>("/fee-structure")).data,
  });
}

export function useTransportSlabs() {
  return useQuery({
    queryKey: ["fee-structure", "slabs"],
    queryFn: async () => (await api.get<TransportSlabRow[]>("/fee-structure/transport-slabs")).data,
  });
}

export function useSaveFeeStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FeeStructureUpsert) =>
      (await api.put<FeeStructureRow>(`/fee-structure/${encodeURIComponent(input.class)}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
