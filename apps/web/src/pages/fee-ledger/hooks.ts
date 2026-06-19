import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CheckoutCreateInput,
  CheckoutSession,
  FeeLedgerQuery,
  FeeLedgerResponse,
  PaymentAttempt,
  ReceiptListQuery,
  ReceiptListResponse,
  ReceiptPrint,
  RecordPaymentInput,
  StudentFeeDetail,
} from "@crestly/shared";

const KEY = ["fees"] as const;

export function useFeeLedger(query: Partial<FeeLedgerQuery>) {
  return useQuery({
    queryKey: [...KEY, "ledger", query],
    queryFn: async () => (await api.get<FeeLedgerResponse>("/fees", { params: query })).data,
    placeholderData: (prev) => prev,
  });
}

export function useReceipts(query: Partial<ReceiptListQuery>) {
  return useQuery({
    queryKey: [...KEY, "receipts", query],
    queryFn: async () => (await api.get<ReceiptListResponse>("/fees/receipts", { params: query })).data,
    placeholderData: (prev) => prev,
  });
}

export function useReceiptDetail(paymentId: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "receipt", paymentId],
    enabled: paymentId !== undefined && !Number.isNaN(paymentId),
    queryFn: async () => (await api.get<ReceiptPrint>(`/fees/payment/${paymentId}/receipt`)).data,
  });
}

export function useStudentFee(srNumber: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "student", srNumber],
    enabled: srNumber !== undefined && !Number.isNaN(srNumber),
    queryFn: async () => (await api.get<StudentFeeDetail>(`/fees/student/${srNumber}`)).data,
  });
}

export function useRecordPayment(srNumber: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordPaymentInput) =>
      (await api.post<StudentFeeDetail>(`/fees/student/${srNumber}/payment`, input)).data,
    onSuccess: (data) => {
      qc.setQueryData([...KEY, "student", srNumber], data);
      qc.invalidateQueries({ queryKey: [...KEY, "ledger"] });
    },
  });
}

export function useVoidPayment(srNumber: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: number; reason?: string }) =>
      (await api.post<StudentFeeDetail>(`/fees/payment/${paymentId}/void`, { reason })).data,
    onSuccess: (data) => {
      qc.setQueryData([...KEY, "student", srNumber], data);
      qc.invalidateQueries({ queryKey: [...KEY, "ledger"] });
    },
  });
}

/** Manually triggers the fee.reminder WhatsApp template for a student. */
export function useSendFeeReminder(srNumber: number) {
  return useMutation({
    mutationFn: async () =>
      (await api.post<{ ok: true; due: number }>(`/fees/student/${srNumber}/reminder`)).data,
  });
}

/** Creates an HDFC SmartGateway checkout session for a student. */
export function useCreateCheckout(srNumber: number) {
  return useMutation({
    mutationFn: async (input: CheckoutCreateInput) =>
      (await api.post<CheckoutSession>(`/fees/student/${srNumber}/checkout`, input)).data,
  });
}

/** Lists HDFC payment attempts for a student (or globally if sr is undefined). */
export function usePaymentAttempts(srNumber?: number) {
  return useQuery({
    queryKey: ["fees", "payment-attempts", srNumber],
    queryFn: async () =>
      (await api.get<PaymentAttempt[]>("/fees/payment-attempts", {
        params: srNumber ? { sr: srNumber } : {},
      })).data,
  });
}
