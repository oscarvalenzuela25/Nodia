import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import { mainInstance } from "../../../config/api";
import { apiPath } from "../../../config/apiPath";
import { notifyHttpError } from "../../../config/httpFeedback";
import { offlineRequestCode } from "../../../pwa/connectionMonitor";
import { authorizationKeys } from "../../../services/authorizationService";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import i18n from "../../../translate";
import { profilePageSchema, profileRecordSchema, profilesPageSize, type ProfileInput } from "./profileSchema";

const profilesPath = apiPath("/nodia-cv/profiles");

export type ProfileWrite =
  | { kind: "create"; requestKey: string; input: ProfileInput }
  | { kind: "update"; id: string; revision: number; input: ProfileInput }
  | { kind: "delete"; id: string; revision: number };

export function useProfileScope() {
  const userId = useAuthStore(state => state.user?.id);
  const version = useAuthStore(state => state.sessionVersion);
  const active = useAuthStore(hasActiveSession);
  return { scope: ["nodiaCv", userId, version] as const, active: Boolean(userId && active) };
}

export function profileAccessDenied(error: unknown): boolean {
  return isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0);
}

function useClearOnDenial() {
  const { scope } = useProfileScope();
  const queryClient = useQueryClient();
  return (error: unknown) => {
    if (!profileAccessDenied(error)) return;
    void queryClient.invalidateQueries({ queryKey: [...authorizationKeys.context(), scope[1]] });
    queryClient.removeQueries({ queryKey: scope, type: "inactive" });
  };
}

export async function fetchCvProfilesPage(page: number, signal: AbortSignal, version: number) {
  const response = await mainInstance.get<unknown>(profilesPath, {
    signal, expectedAuthSessionVersion: version, params: { page, page_size: profilesPageSize },
  });
  const parsed = profilePageSchema.parse(response.data);
  if (parsed.page !== page || parsed.page_size !== profilesPageSize) throw new Error("Invalid CV profile pagination");
  return parsed;
}

export function useProfiles(page: number, enabled = true) {
  const { scope, active } = useProfileScope();
  const clearOnDenial = useClearOnDenial();
  return useQuery({
    queryKey: [...scope, "list", page] as const, enabled: active && enabled, gcTime: 0,
    queryFn: ({ signal, queryKey }) => fetchCvProfilesPage(page, signal, queryKey[2])
      .catch(error => { clearOnDenial(error); throw error; }),
  });
}

export function useProfileDetail(id: string | null) {
  const { scope, active } = useProfileScope();
  const clearOnDenial = useClearOnDenial();
  return useQuery({
    queryKey: [...scope, "profile", id], enabled: active && id !== null, gcTime: 0,
    queryFn: async ({ signal }) => {
      const response = await mainInstance.get<unknown>(`${profilesPath}/${id}`, { signal })
        .catch(error => { clearOnDenial(error); throw error; });
      const profile = profileRecordSchema.parse(response.data);
      if (profile.id !== id) throw new Error("Unexpected CV profile identity");
      return profile;
    },
  });
}

async function writeProfile(command: ProfileWrite) {
  if (command.kind === "delete") {
    await mainInstance.delete(`${profilesPath}/${command.id}`, { params: { revision: command.revision } });
    return;
  }
  const response = command.kind === "create"
    ? await mainInstance.post<unknown>(profilesPath, { request_key: command.requestKey, profile: command.input })
    : await mainInstance.put<unknown>(`${profilesPath}/${command.id}`, { revision: command.revision, profile: command.input });
  const profile = profileRecordSchema.parse(response.data);
  if (command.kind === "update" && command.id !== profile.id) throw new Error("Unexpected CV profile identity");
  return profile;
}

export function useWriteProfile() {
  const { scope } = useProfileScope();
  const queryClient = useQueryClient();
  const clearOnDenial = useClearOnDenial();
  const sameSession = () => {
    const state = useAuthStore.getState();
    return hasActiveSession(state) && state.user?.id === scope[1] && state.sessionVersion === scope[2];
  };
  return useMutation({
    mutationFn: writeProfile, gcTime: 0,
    onSuccess: (_result, command) => {
      if (!sameSession()) return;
      sileo.success({ title: i18n.t(command.kind === "delete" ? "nodiaCv:profile_deleted" : "nodiaCv:profile_saved") });
      if (command.kind !== "create") void queryClient.invalidateQueries({ queryKey: [...scope, "profile", command.id] });
      void queryClient.invalidateQueries({ queryKey: [...scope, "list"] });
      void queryClient.invalidateQueries({ queryKey: [...scope, "generation-profiles"] });
    },
    onError: error => {
      if (!sameSession()) return;
      clearOnDenial(error);
      notifyHttpError(error);
      if (isAxiosError(error) && [404, 409].includes(error.response?.status ?? 0)) {
        void queryClient.invalidateQueries({ queryKey: [...scope, "list"] });
      }
    },
  });
}

export function profileWriteMayHaveCommitted(error: unknown): boolean {
  if (isAxiosError(error) && error.code === offlineRequestCode) return false;
  return !isAxiosError(error) || !error.response || error.response.status >= 500 || error.response.status === 408;
}
