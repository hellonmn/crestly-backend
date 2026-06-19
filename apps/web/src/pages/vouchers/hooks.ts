import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Voucher, VoucherApproveInput, VoucherCreateInput, VoucherListQuery,
  VoucherListResponse, VoucherMarkPaidInput,
} from "@crestly/shared";

const KEY = ["vouchers"] as const;

export function useVouchers(query: Partial<VoucherListQuery>) {
  return useQuery({
    queryKey: [...KEY, "list", query],
    queryFn: async () => (await api.get<VoucherListResponse>("/vouchers", { params: query })).data,
  });
}

export function useVoucher(id: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "one", id],
    enabled: id !== undefined && !Number.isNaN(id),
    queryFn: async () => (await api.get<Voucher>(`/vouchers/${id}`)).data,
  });
}

export function useSaveVoucher(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VoucherCreateInput) => {
      if (id) return (await api.put<Voucher>(`/vouchers/${id}`, input)).data;
      return (await api.post<Voucher>("/vouchers", input)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDecideVoucher(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VoucherApproveInput) =>
      (await api.post<Voucher>(`/vouchers/${id}/decide`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useMarkVoucherPaid(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VoucherMarkPaidInput) =>
      (await api.post<Voucher>(`/vouchers/${id}/pay`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCancelVoucher(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<Voucher>(`/vouchers/${id}/cancel`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
