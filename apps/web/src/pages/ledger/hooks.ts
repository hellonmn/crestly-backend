import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LedgerOverview, StaffSalaryQuery, StaffSalaryResponse } from "@crestly/shared";

export function useLedgerOverview(from: string, to: string) {
  return useQuery({
    queryKey: ["ledger", "overview", from, to],
    queryFn: async () => (await api.get<LedgerOverview>("/ledger", { params: { from, to } })).data,
    enabled: !!from && !!to,
  });
}

export function useStaffSalaryLedger(query: StaffSalaryQuery | null) {
  return useQuery({
    queryKey: ["ledger", "staff", query],
    enabled: !!query,
    queryFn: async () => (await api.get<StaffSalaryResponse>("/ledger/staff", { params: query })).data,
  });
}
