import type { z } from "zod";
import { validateRentalListQuery } from "./queries";
import { mainInstance } from "../../../config/api";
import { apiPath } from "../../../config/apiPath";
import type {
  RentalListResource,
  RentalRecordMap,
  RentalDetailMap,
  RentalPage,
  RentalQuery,
  RentalCommand,
  RentalPreviewInput,
} from "../types";
import {
  ackSchema,
  availabilitySchema,
  calendarSchema,
  cancellationPreviewSchema,
  idSchema,
  overviewSchema,
  recoverySchema,
  rentalPageSchema,
  rentalRecordSchemas,
  turnoverDetailSchema,
} from "./schemas";

const base = "/rental/properties";
export class RentalClientValidationError extends Error {}
export class RentalMutationResponseError extends Error {}
const ownPath = (propertyId: string) => `${base}/${idSchema.parse(propertyId)}`;
function listPath(resource: RentalListResource, propertyId?: string): string {
  if (resource === "properties") return base;
  if (!propertyId)
    throw new RentalClientValidationError("rental:invalid_input");
  return `${ownPath(propertyId)}/${resource}`;
}
export function serializeRentalQuery(query: RentalQuery): string {
  const params = new URLSearchParams();
  for (const [field, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (field === "q") {
      for (const [key, entry] of Object.entries(query.q ?? {}))
        params.set(`q[${key}]`, entry);
    } else if (Array.isArray(value))
      value.forEach((entry, index) =>
        params.set(`${field}[${index}]`, String(entry)),
      );
    else params.set(field, String(value));
  }
  return params.toString();
}
const paramsConfig = (query: RentalQuery, signal?: AbortSignal) => ({
  params: query,
  paramsSerializer: () => serializeRentalQuery(query),
  signal,
});
export async function getRentalList<R extends RentalListResource>(
  resource: R,
  propertyId: string | undefined,
  query: RentalQuery = {},
  signal?: AbortSignal,
): Promise<RentalPage<RentalRecordMap[R]>> {
  validateRentalListQuery(resource, query);
  const { data } = await mainInstance.get<unknown>(
    apiPath(listPath(resource, propertyId)),
    paramsConfig(query, signal),
  );
  // Both the mapped type and runtime registry are derived from these same schemas.
  const schema = rentalRecordSchemas[resource] as unknown as z.ZodType<
    RentalRecordMap[R]
  >;
  return rentalPageSchema(schema).parse(data);
}
export async function getRentalRecord<R extends RentalListResource>(
  resource: R,
  propertyId: string | undefined,
  id: string,
  signal?: AbortSignal,
): Promise<RentalDetailMap[R]> {
  if (
    resource === "audit-events" ||
    resource === "collaborator-candidates" ||
    resource === "collaborators"
  )
    throw new RentalClientValidationError("rental:invalid_input");
  const { data } = await mainInstance.get<unknown>(
    apiPath(`${listPath(resource, propertyId)}/${idSchema.parse(id)}`),
    { signal },
  );
  const schema = (resource === "turnovers"
    ? turnoverDetailSchema
    : rentalRecordSchemas[resource]) as unknown as z.ZodType<
    RentalDetailMap[R]
  >;
  return schema.parse(data);
}
export const rentalReadSchemas = {
  calendar: calendarSchema,
  availability: availabilitySchema,
  overview: overviewSchema,
} as const;
export async function getRentalRead<K extends keyof typeof rentalReadSchemas>(
  kind: K,
  propertyId: string,
  query: RentalQuery,
  signal?: AbortSignal,
): Promise<z.infer<(typeof rentalReadSchemas)[K]>> {
  const { data } = await mainInstance.get<unknown>(
    apiPath(`${ownPath(propertyId)}/${kind}`),
    paramsConfig(query, signal),
  );
  return rentalReadSchemas[kind].parse(data) as z.infer<
    (typeof rentalReadSchemas)[K]
  >;
}
export async function previewRentalCancellation(
  propertyId: string,
  id: string,
  input: RentalPreviewInput,
  signal?: AbortSignal,
) {
  const { data } = await mainInstance.post<unknown>(
    apiPath(
      `${ownPath(propertyId)}/reservations/${idSchema.parse(id)}/cancellation-preview`,
    ),
    input,
    { signal },
  );
  return cancellationPreviewSchema.parse(data);
}
export async function recoverRentalOperation(
  propertyId: string,
  key: string,
  signal?: AbortSignal,
) {
  if (!isRentalRequestKey(key))
    throw new RentalClientValidationError("rental:invalid_input");
  const { data } = await mainInstance.get<unknown>(
    apiPath(`${ownPath(propertyId)}/operations/${key}`),
    { signal },
  );
  return recoverySchema.parse(data);
}
const resources = {
  property: "properties",
  collaborator: "collaborators",
  policy: "cancellation-policies",
  reservation: "reservations",
  payment: "payments",
  expense: "expenses",
  block: "blocks",
  turnover: "turnovers",
} as const;
export function rentalMutationEndpoint(
  propertyId: string | undefined,
  command: RentalCommand,
): { method: "post" | "put"; path: string } {
  const [resource, action] = command.operation.split(".") as [
    keyof typeof resources,
    string,
  ];
  if (command.operation === "property.create")
    return { method: "post", path: base };
  if (!propertyId)
    throw new RentalClientValidationError("rental:invalid_input");
  const propertyPath = ownPath(propertyId);
  if (command.operation === "property.update")
    return { method: "put", path: propertyPath };
  const path = `${propertyPath}/${resources[resource]}`;
  if (action === "create") return { method: "post", path };
  if (!command.id)
    throw new RentalClientValidationError("rental:invalid_input");
  const detail = `${path}/${idSchema.parse(command.id)}`;
  return action === "update"
    ? { method: "put", path: detail }
    : {
        method: "post",
        path: `${detail}/${action === "approve_same_day" ? "approve-same-day" : action}`,
      };
}
export function isRentalRequestKey(key: string): boolean {
  return /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
    key,
  );
}
export function assertRentalAckMatches(
  ack: ReturnType<typeof ackSchema.parse>,
  propertyId: string | undefined,
  command: RentalCommand,
): void {
  const expectedResource = command.operation.split(".")[0];
  if (
    ack.operation !== command.operation ||
    ack.resource_type !== expectedResource ||
    (propertyId !== undefined && ack.property_id !== propertyId) ||
    (command.operation === "property.update" &&
      ack.resource_id !== propertyId) ||
    (command.id !== undefined &&
      command.operation !== "property.update" &&
      ack.resource_id !== command.id)
  )
    throw new RentalMutationResponseError("rental:uncertain_result");
}
export async function executeRentalCommand(
  propertyId: string | undefined,
  command: RentalCommand,
  key: string,
) {
  if (!isRentalRequestKey(key))
    throw new RentalClientValidationError("rental:invalid_input");
  const endpoint = rentalMutationEndpoint(propertyId, command);
  const response = await mainInstance.request<unknown>({
    method: endpoint.method,
    url: apiPath(endpoint.path),
    data: command.data,
    headers: { "Idempotency-Key": key },
  });
  try {
    const ack = ackSchema.parse(response.data);
    assertRentalAckMatches(ack, propertyId, command);
    return ack;
  } catch (cause) {
    throw new RentalMutationResponseError("rental:uncertain_result", { cause });
  }
}
