import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AdmissionEnquiry, AdmissionFollowup, EnquiryListQuery, EnquiryListResponse,
  EnquiryUpsertInput, FollowupAddInput,
} from "@crestly/shared";

const KEY = ["admissions"] as const;

export function useEnquiries(query: Partial<EnquiryListQuery>) {
  return useQuery({
    queryKey: [...KEY, "list", query],
    queryFn: async () => (await api.get<EnquiryListResponse>("/admissions", { params: query })).data,
  });
}

export function useEnquiry(id: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "one", id],
    enabled: id !== undefined && !Number.isNaN(id),
    queryFn: async () =>
      (await api.get<AdmissionEnquiry & { followups: AdmissionFollowup[] }>(`/admissions/${id}`)).data,
  });
}

export function useSaveEnquiry(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EnquiryUpsertInput) => {
      if (id) return (await api.put<AdmissionEnquiry>(`/admissions/${id}`, input)).data;
      return (await api.post<AdmissionEnquiry>("/admissions", input)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAddFollowup(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FollowupAddInput) =>
      (await api.post<AdmissionEnquiry & { followups: AdmissionFollowup[] }>(`/admissions/${id}/followup`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
