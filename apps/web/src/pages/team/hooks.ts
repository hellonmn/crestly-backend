import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  TeamMember,
  TeamListQuery,
  TeamListResponse,
  TeamUpsert,
  Role,
  Permission,
  RolePermToggle,
} from "@crestly/shared";

const KEY = ["team"] as const;
const ROLES_KEY = ["roles"] as const;

export function useTeamList(query: Partial<TeamListQuery>) {
  return useQuery({
    queryKey: [...KEY, "list", query],
    queryFn: async () => (await api.get<TeamListResponse>("/team", { params: query })).data,
  });
}

/**
 * Lightweight picker list — open to every logged-in user.
 * Use this from picker/dropdown UIs that need to surface staff names
 * but don't require the viewer to have team.view permission (e.g.
 * a class teacher assigning a teacher to their section).
 */
export function usePickableTeam() {
  return useQuery({
    queryKey: [...KEY, "pickable"],
    queryFn: async () => (await api.get<TeamListResponse>("/team/pickable")).data,
    staleTime: 60_000,
  });
}

export function useTeamMember(id: number | undefined) {
  return useQuery({
    queryKey: [...KEY, "one", id],
    enabled: id !== undefined && !Number.isNaN(id),
    queryFn: async () => (await api.get<TeamMember>(`/team/${id}`)).data,
  });
}

export function useSaveTeamMember(id: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TeamUpsert) => {
      if (id !== undefined) return (await api.put<TeamMember>(`/team/${id}`, input)).data;
      return (await api.post<TeamMember>("/team", input)).data;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: [...KEY, "list"] });
      qc.setQueryData([...KEY, "one", saved.id], saved);
    },
  });
}

export function useSetTeamPassword(id: number) {
  return useMutation({
    mutationFn: async (password: string) => (await api.post<{ ok: true }>(`/team/${id}/password`, { password })).data,
  });
}

export function useDeactivateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete<TeamMember>(`/team/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// --- Roles ---

export function useRoles() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: async () => (await api.get<Role[]>("/roles")).data,
  });
}

export function usePermissions() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: async () => (await api.get<Permission[]>("/permissions")).data,
  });
}

export function useToggleRolePermission(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: RolePermToggle) =>
      (await api.put<{ ok: true }>(`/roles/${slug}/permissions`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
  });
}
