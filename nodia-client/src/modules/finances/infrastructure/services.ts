import { mainInstance } from "../../../config/api";
import type { z } from "zod";
import type {
  FinanceQuery,
  FinanceResource,
  FinanceRecordMap,
  FinanceMutationInput,
  FinancePage,
} from "../types";
import {
  financePageSchema,
  financeRecordSchemas,
  financeOverviewSchema,
  financeSummaryPageSchema,
} from "./schemas";

function endpoint(path: string): string {
  return mainInstance.defaults.baseURL?.includes("/api/v1")
    ? `/finance${path}`
    : `/api/v1/finance${path}`;
}

export function serializeFinanceQuery(query: FinanceQuery): string {
  const params = new URLSearchParams();
  if (query.owner_id !== undefined) params.set("owner_id", query.owner_id);
  params.set("active", query.active ?? "active");
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 10));
  for (const [name, value] of Object.entries(query.q ?? {}))
    params.set(`q[${name}]`, value);
  for (const field of ["category_ids", "category_group_ids"] as const) {
    query[field]?.forEach((id, index) => params.set(`${field}[${index}]`, id));
  }
  if (query.obligation_id !== undefined)
    params.set("obligation_id", query.obligation_id);
  return params.toString();
}

const schemas: { [R in FinanceResource]: z.ZodType<FinanceRecordMap[R]> } =
  financeRecordSchemas;

function recordSchema<R extends FinanceResource>(
  resource: R,
): z.ZodType<FinanceRecordMap[R]> {
  return schemas[resource];
}

export async function getFinanceList<R extends FinanceResource>(
  resource: R,
  query: FinanceQuery = {},
  signal?: AbortSignal,
): Promise<FinancePage<FinanceRecordMap[R]>> {
  const { data } = await mainInstance.get<unknown>(endpoint(`/${resource}`), {
    params: query,
    paramsSerializer: () => serializeFinanceQuery(query),
    signal,
  });
  return financePageSchema(recordSchema(resource)).parse(data);
}

export async function getFinanceRecord<R extends FinanceResource>(
  resource: R,
  id: string,
  signal?: AbortSignal,
  ownerId?: string,
): Promise<FinanceRecordMap[R]> {
  const { data } = await mainInstance.get<unknown>(
    endpoint(`/${resource}/${encodeURIComponent(id)}`),
    { signal, params: ownerId ? { owner_id: ownerId } : undefined },
  );
  return recordSchema(resource).parse(data);
}

export async function saveFinanceRecord<R extends FinanceResource>(
  resource: R,
  input: FinanceMutationInput<R>,
  ownerId?: string,
): Promise<FinanceRecordMap[R]> {
  const response =
    input.id === undefined
      ? ownerId
        ? await mainInstance.post<unknown>(
            endpoint("/" + resource),
            input.data,
            { params: { owner_id: ownerId } },
          )
        : await mainInstance.post<unknown>(endpoint("/" + resource), input.data)
      : ownerId
        ? await mainInstance.put<unknown>(
            endpoint("/" + resource + "/" + encodeURIComponent(input.id)),
            input.data,
            { params: { owner_id: ownerId } },
          )
        : await mainInstance.put<unknown>(
            endpoint("/" + resource + "/" + encodeURIComponent(input.id)),
            input.data,
          );
  return recordSchema(resource).parse(response.data);
}

export async function getFinanceOverview(
  query: FinanceQuery,
  signal?: AbortSignal,
) {
  const { data } = await mainInstance.get<unknown>(endpoint("/overview"), {
    params: query,
    paramsSerializer: () => serializeFinanceQuery(query),
    signal,
  });
  return financeOverviewSchema.parse(data);
}

export async function deleteFinanceRecord(
  resource: FinanceResource,
  id: string,
  ownerId?: string,
): Promise<void> {
  if (ownerId)
    await mainInstance.delete(
      endpoint(`/${resource}/${encodeURIComponent(id)}`),
      { params: { owner_id: ownerId } },
    );
  else
    await mainInstance.delete(
      endpoint(`/${resource}/${encodeURIComponent(id)}`),
    );
}

export async function getFinanceSummary(
  kind: "categories" | "category-groups",
  query: FinanceQuery,
  signal?: AbortSignal,
) {
  const { data } = await mainInstance.get<unknown>(
    endpoint(`/overview/${kind}`),
    {
      params: query,
      paramsSerializer: () => serializeFinanceQuery(query),
      signal,
    },
  );
  return financeSummaryPageSchema.parse(data);
}
