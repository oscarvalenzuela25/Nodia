import { mainInstance } from "../../../config/api";
import { apiPath } from "../../../config/apiPath";
import type {
  AssignCollaboratorsPayload,
  BusinessCollaborator,
  BusinessEntity,
  GetBusinessesParams,
  GetBusinessesResponse,
} from "./types";

export const getBusinesses = async (
  params?: GetBusinessesParams
): Promise<GetBusinessesResponse> => {
  const { data } = await mainInstance.get<GetBusinessesResponse>(
    apiPath("/business"),
    { params }
  );
  return data;
};

export const getBusinessById = async (id: string): Promise<BusinessEntity> => {
  const { data } = await mainInstance.get<BusinessEntity>(
    apiPath(`/business/${id}`)
  );
  return data;
};

export const createBusiness = async (
  payload: Partial<BusinessEntity>
): Promise<BusinessEntity> => {
  const { data } = await mainInstance.post<BusinessEntity>(
    apiPath("/business"),
    payload
  );
  return data;
};

export const updateBusiness = async (
  id: string,
  payload: Partial<BusinessEntity>
): Promise<BusinessEntity> => {
  const { data } = await mainInstance.put<BusinessEntity>(
    apiPath(`/business/${id}`),
    payload
  );
  return data;
};

export const assignCollaborators = async (
  businessId: string,
  payload: AssignCollaboratorsPayload
): Promise<BusinessCollaborator[]> => {
  const { data } = await mainInstance.put<BusinessCollaborator[]>(
    apiPath(`/business/${businessId}/collaborators`),
    payload
  );
  return data;
};

// ----------------------------------------------------
// Product Services
// ----------------------------------------------------
export const getProducts = async (
  params?: import("./types").GetProductsParams
): Promise<import("./types").GetProductsResponse> => {
  const { data } = await mainInstance.get<import("./types").GetProductsResponse>(
    apiPath("/products"),
    { params }
  );
  return data;
};

export const createProduct = async (
  payload: import("./types").CreateProductPayload
): Promise<import("./types").ProductEntity> => {
  const { data } = await mainInstance.post<import("./types").ProductEntity>(
    apiPath("/products"),
    payload
  );
  return data;
};

export const updateProduct = async (
  id: string,
  payload: import("./types").UpdateProductPayload
): Promise<import("./types").ProductEntity> => {
  const { data } = await mainInstance.put<import("./types").ProductEntity>(
    apiPath(`/products/${id}`),
    payload
  );
  return data;
};

export const bulkCreateProducts = async (
  items: import("./types").CreateProductPayload[]
): Promise<import("./types").ProductEntity[]> => {
  const { data } = await mainInstance.post<import("./types").ProductEntity[]>(
    apiPath("/products/bulk"),
    { items }
  );
  return data;
};

export const bulkUpdateProducts = async (
  items: import("./types").BulkUpdateProductItemPayload[]
): Promise<import("./types").ProductEntity[]> => {
  const { data } = await mainInstance.put<import("./types").ProductEntity[]>(
    apiPath("/products/bulk"),
    { items }
  );
  return data;
};

export const exportProductsCsv = async (params?: {
  business_id?: string;
  lang?: string;
}): Promise<string> => {
  const { data } = await mainInstance.get<string>(
    apiPath("/products/export-csv"),
    { params, responseType: "text" }
  );
  return data;
};

// ----------------------------------------------------
// Provider Services
// ----------------------------------------------------
export const getProviders = async (
  params?: import("./types").GetProvidersParams
): Promise<import("./types").GetProvidersResponse> => {
  const { data } = await mainInstance.get<import("./types").GetProvidersResponse>(
    apiPath("/providers"),
    { params }
  );
  return data;
};

export const createProvider = async (
  payload: import("./types").CreateProviderPayload
): Promise<import("./types").ProviderEntity> => {
  const { data } = await mainInstance.post<import("./types").ProviderEntity>(
    apiPath("/providers"),
    payload
  );
  return data;
};

export const updateProvider = async (
  id: string,
  payload: import("./types").UpdateProviderPayload
): Promise<import("./types").ProviderEntity> => {
  const { data } = await mainInstance.put<import("./types").ProviderEntity>(
    apiPath(`/providers/${id}`),
    payload
  );
  return data;
};

export const bulkCreateProviders = async (
  items: import("./types").CreateProviderPayload[]
): Promise<import("./types").ProviderEntity[]> => {
  const { data } = await mainInstance.post<import("./types").ProviderEntity[]>(
    apiPath("/providers/bulk"),
    { items }
  );
  return data;
};

export const bulkUpdateProviders = async (
  items: import("./types").BulkUpdateProviderItemPayload[]
): Promise<import("./types").ProviderEntity[]> => {
  const { data } = await mainInstance.put<import("./types").ProviderEntity[]>(
    apiPath("/providers/bulk"),
    { items }
  );
  return data;
};

export const exportProvidersCsv = async (params?: {
  business_id?: string;
  lang?: string;
}): Promise<string> => {
  const { data } = await mainInstance.get<string>(
    apiPath("/providers/export-csv"),
    { params, responseType: "text" }
  );
  return data;
};

// ----------------------------------------------------
// Invoice Services
// ----------------------------------------------------
export const getInvoices = async (
  params?: import("./types").GetInvoicesParams
): Promise<import("./types").GetInvoicesResponse> => {
  const { data } = await mainInstance.get<import("./types").GetInvoicesResponse>(
    apiPath("/invoices"),
    { params }
  );
  return data;
};

export const createInvoice = async (
  payload: import("./types").CreateInvoicePayload
): Promise<import("./types").InvoiceEntity> => {
  const { data } = await mainInstance.post<import("./types").InvoiceEntity>(
    apiPath("/invoices"),
    payload
  );
  return data;
};

export const updateInvoice = async (
  id: string,
  payload: import("./types").UpdateInvoicePayload
): Promise<import("./types").InvoiceEntity> => {
  const { data } = await mainInstance.put<import("./types").InvoiceEntity>(
    apiPath(`/invoices/${id}`),
    payload
  );
  return data;
};

export const getInvoiceViewUrl = async (
  id: string
): Promise<{ url: string; path_storage: string }> => {
  const { data } = await mainInstance.get<{ url: string; path_storage: string }>(
    apiPath(`/invoices/${id}/view-url`)
  );
  return data;
};

export const analyzeInvoice = async (
  params: import("./types").AnalyzeInvoiceParams
): Promise<import("./types").AnalyzeInvoiceResponse> => {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("business_id", params.business_id);
  if (params.provider_id && params.provider_id !== "null" && params.provider_id.trim() !== "") {
    formData.append("provider_id", params.provider_id.trim());
  }
  if (params.ai_provider) {
    formData.append("ai_provider", params.ai_provider);
  }
  if (params.ai_provider_id) {
    formData.append("ai_provider_id", params.ai_provider_id);
  }
  if (params.model) {
    formData.append("model", params.model);
  }
  if (params.model_type) {
    formData.append("model_type", params.model_type);
  }
  if (params.extended_thinking !== undefined) {
    formData.append("extended_thinking", String(params.extended_thinking));
  }
  if (params.engine) {
    formData.append("engine", params.engine);
  }
  if (params.mode) {
    formData.append("mode", params.mode);
  }
  if (params.thinking_level) {
    formData.append("thinking_level", params.thinking_level);
  }

  const query = new URLSearchParams();
  if (params.mode) query.set("mode", params.mode);
  if (params.thinking_level) query.set("thinking_level", params.thinking_level);
  if (params.engine) query.set("engine", params.engine);
  const queryString = query.toString() ? `?${query.toString()}` : "";

  const { data } = await mainInstance.post<import("./types").AnalyzeInvoiceResponse>(
    apiPath(`/invoices/analyze${queryString}`),
    formData,
    {
      headers: {
        "Content-Type": undefined,
      },
      timeout: 360000,
    }
  );
  return data;
};

export const verifyIaProviders = async (): Promise<import("./types").VerifyIaProvidersResponse> => {
  const { data } = await mainInstance.get<import("./types").VerifyIaProvidersResponse>(
    apiPath("/invoices/verify-ia-providers")
  );
  return data;
};

export const createInvoiceWithFile = async (
  params: import("./types").CreateInvoiceWithFileParams
): Promise<import("./types").InvoiceEntity> => {
  const formData = new FormData();
  if (params.file) {
    formData.append("file", params.file);
  }
  formData.append("business_id", params.business_id);
  if (params.provider_id && params.provider_id !== "null" && params.provider_id.trim() !== "") {
    formData.append("provider_id", params.provider_id.trim());
  }
  formData.append("code", params.code);
  formData.append("total_amount", String(Math.round(params.total_amount ?? 0)));
  if (params.path_storage) {
    formData.append("path_storage", params.path_storage);
  }
  if (params.data) {
    formData.append("data", JSON.stringify(params.data));
  }
  if (params.is_active !== undefined) {
    formData.append("is_active", String(params.is_active));
  }

  const { data } = await mainInstance.post<import("./types").InvoiceEntity>(
    apiPath("/invoices"),
    formData,
    {
      headers: {
        "Content-Type": undefined,
      },
    }
  );
  return data;
};

// ----------------------------------------------------
// Product Log Services
// ----------------------------------------------------
export const queryProductLogs = async (
  payload: import("./types").QueryProductLogsPayload
): Promise<import("./types").GetProductLogsResponse> => {
  const { data } = await mainInstance.post<import("./types").GetProductLogsResponse>(
    apiPath("/product-logs/query"),
    payload
  );
  return data;
};

export const getProductLogs = async (
  params?: import("./types").GetProductLogsParams
): Promise<import("./types").GetProductLogsResponse> => {
  const productIds = params?.q?.product_id_in;
  if (Array.isArray(productIds) && productIds.length > 10) {
    return queryProductLogs({
      product_ids: productIds.map(String),
      codes: params?.q?.code_in ? (params.q.code_in as string[]).map(String) : undefined,
      q: params?.q,
      all: params?.all,
      page: params?.page,
      limit: params?.limit,
      includes: params?.includes,
      s: (params?.q?.s as string) || undefined,
    });
  }

  const { data } = await mainInstance.get<import("./types").GetProductLogsResponse>(
    apiPath("/product-logs"),
    { params }
  );
  return data;
};
