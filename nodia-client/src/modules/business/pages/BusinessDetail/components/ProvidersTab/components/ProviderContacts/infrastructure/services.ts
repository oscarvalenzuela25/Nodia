import { mainInstance } from "../../../../../../../../../config/api";
import { apiPath } from "../../../../../../../../../config/apiPath";
import {
  contactListSchema,
  contactSchema,
  type ContactListParams,
  type CreateContact,
  type UpdateContact,
} from "../types";
const path = (providerId: string) =>
  apiPath(`/providers/${encodeURIComponent(providerId)}/contacts`);
export async function getContacts(
  providerId: string,
  params: ContactListParams,
  signal?: AbortSignal,
) {
  const { data } = await mainInstance.get<unknown>(path(providerId), {
    params,
    signal,
  });
  return contactListSchema.parse(data);
}
export async function createContact(
  providerId: string,
  payload: CreateContact,
) {
  const { data } = await mainInstance.post<unknown>(path(providerId), payload);
  return contactSchema.parse(data);
}
export async function updateContact(
  providerId: string,
  id: string,
  payload: UpdateContact,
) {
  const { data } = await mainInstance.put<unknown>(
    `${path(providerId)}/${encodeURIComponent(id)}`,
    payload,
  );
  return contactSchema.parse(data);
}
export async function toggleContact(
  providerId: string,
  id: string,
  version: number,
  is_active: boolean,
) {
  const { data } = await mainInstance.patch<unknown>(
    `${path(providerId)}/${encodeURIComponent(id)}/status`,
    { version, is_active },
  );
  return contactSchema.parse(data);
}
