import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { sileo } from "sileo";
import useAuth from "../../../../../../../../../hooks/useAuth";
import { notifyHttpError } from "../../../../../../../../../config/httpFeedback";
import i18n from "../../../../../../../../../translate";
import {
  createContact,
  getContacts,
  toggleContact,
  updateContact,
} from "./services";
import type { ContactListParams, CreateContact, UpdateContact } from "../types";
export const contactKeys = {
  provider: (userId: string, providerId: string) =>
    ["provider-contacts", userId, providerId] as const,
};
export function useContacts(providerId: string, params: ContactListParams) {
  const { isSessionActive, user } = useAuth();
  return useQuery({
    queryKey: [...contactKeys.provider(user?.id ?? "", providerId), params],
    queryFn: ({ signal }) => getContacts(providerId, params, signal),
    enabled: isSessionActive,
    placeholderData: keepPreviousData,
  });
}
export function useContactMutations(providerId: string) {
  const client = useQueryClient();
  const { user } = useAuth();
  const success = async () => {
    sileo.success({ title: i18n.t("provider_contacts:saved") });
    await client.invalidateQueries({
      queryKey: contactKeys.provider(user?.id ?? "", providerId),
    });
  };
  const create = useMutation({
    mutationFn: (payload: CreateContact) => createContact(providerId, payload),
    retry: false,
    onSuccess: success,
    onError: notifyHttpError,
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateContact }) =>
      updateContact(providerId, id, payload),
    retry: false,
    onSuccess: success,
    onError: notifyHttpError,
  });
  const toggle = useMutation({
    mutationFn: ({
      id,
      version,
      active,
    }: {
      id: string;
      version: number;
      active: boolean;
    }) => toggleContact(providerId, id, version, active),
    retry: false,
    onSuccess: success,
    onError: notifyHttpError,
  });
  return { create, update, toggle };
}
