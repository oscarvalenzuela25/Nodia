import type { GetBusinessesParams } from "./types";

export const normalizeProductParams = (
  params?: import("./types").GetProductsParams
): import("./types").GetProductsParams | undefined => {
  if (!params) return undefined;
  if (params.all) return params;
  return {
    ...params,
    page: params.page ?? 1,
    q: {
      ...params.q,
      s: params.q?.s ?? "created_at desc",
    },
  };
};

export const normalizeProviderParams = (
  params?: import("./types").GetProvidersParams
): import("./types").GetProvidersParams | undefined => {
  if (!params) return undefined;
  if (params.all) return params;
  return {
    ...params,
    page: params.page ?? 1,
    q: {
      ...params.q,
      s: params.q?.s ?? "created_at desc",
    },
  };
};

export const businessKeys = {
  all: ["business"] as const,
  lists: () => [...businessKeys.all, "list"] as const,
  list: (params?: GetBusinessesParams) =>
    [...businessKeys.lists(), params] as const,
  details: () => [...businessKeys.all, "detail"] as const,
  detail: (id: string) => [...businessKeys.details(), id] as const,
};

export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (params?: import("./types").GetProductsParams) =>
    [...productKeys.lists(), normalizeProductParams(params)] as const,
};

export const providerKeys = {
  all: ["providers"] as const,
  lists: () => [...providerKeys.all, "list"] as const,
  list: (params?: import("./types").GetProvidersParams) =>
    [...providerKeys.lists(), normalizeProviderParams(params)] as const,
};

export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (params?: import("./types").GetInvoicesParams) =>
    [...invoiceKeys.lists(), params] as const,
};

export const productLogKeys = {
  all: ["product-logs"] as const,
  list: (params?: import("./types").GetProductLogsParams) =>
    [...productLogKeys.all, "list", params] as const,
};
