import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  HostelBoarder, HostelBoardersQuery, HostelFees, HostelOverview,
  HostelRoom, HostelRoomsQuery, HostelSchedule,
} from "@crestly/shared";

const KEY = ["hostel"] as const;

export function useHostelOverview() {
  return useQuery({
    queryKey: [...KEY, "overview"],
    queryFn: async () => (await api.get<HostelOverview>("/hostel")).data,
  });
}

export function useHostelRooms(query: Partial<HostelRoomsQuery>) {
  return useQuery({
    queryKey: [...KEY, "rooms", query],
    queryFn: async () => (await api.get<HostelRoom[]>("/hostel/rooms", { params: query })).data,
  });
}

export function useHostelBoarders(query: Partial<HostelBoardersQuery>) {
  return useQuery({
    queryKey: [...KEY, "boarders", query],
    queryFn: async () => (await api.get<HostelBoarder[]>("/hostel/boarders", { params: query })).data,
  });
}

export function useHostelFees() {
  return useQuery({
    queryKey: [...KEY, "fees"],
    queryFn: async () => (await api.get<HostelFees>("/hostel/fees")).data,
  });
}

export function useHostelSchedule() {
  return useQuery({
    queryKey: [...KEY, "schedule"],
    queryFn: async () => (await api.get<HostelSchedule>("/hostel/schedule")).data,
  });
}
