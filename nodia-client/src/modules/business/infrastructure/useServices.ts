import useAuth from "../../../hooks/useAuth";
import type { AxiosError } from "axios";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { sileo } from "sileo";
import i18n from "../../../translate";
import {
  getBusinesses,
  getBusinessById,
  createBusiness,
  updateBusiness,
  assignCollaborators,
  getProviders,
  createProvider,
  updateProvider,
  getInvoices,
  createInvoice,
  updateInvoice,
  analyzeInvoice,
  createInvoiceWithFile,
  getProducts,
  createProduct,
  updateProduct,
  bulkCreateProducts,
  bulkUpdateProducts,
  getProductLogs,
} from "./services";
import type {
  AssignCollaboratorsPayload,
  BusinessEntity,
  GetBusinessesParams,
} from "./types";

export const businessKeys = {
  all: ["business"] as const,
  lists: () => [...businessKeys.all, "list"] as const,
  list: (params?: GetBusinessesParams) =>
    [...businessKeys.lists(), params] as const,
  details: () => [...businessKeys.all, "detail"] as const,
  detail: (id: string) => [...businessKeys.details(), id] as const,
};

export const useBusinesses = (
  params?: GetBusinessesParams,
  options?: { enabled?: boolean }
) => {
  const { isSessionActive } = useAuth();
  return useQuery({
    queryKey: businessKeys.list(params),
    queryFn: () => getBusinesses(params),
    placeholderData: keepPreviousData,
    enabled: isSessionActive && (options?.enabled ?? true),
  });
};

export const useBusiness = (
  id?: string,
  options?: { enabled?: boolean }
) => {
  const { isSessionActive } = useAuth();
  return useQuery({
    queryKey: businessKeys.detail(id ?? ""),
    queryFn: () => getBusinessById(id!),
    enabled: isSessionActive && Boolean(id) && (options?.enabled ?? true),
  });
};

export const useCreateBusiness = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<BusinessEntity>) => createBusiness(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: businessKeys.lists() });
      sileo.success({
        title: i18n.t("business:created_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string; error?: string }>) => {
      const serverMessage =
        error.response?.data?.message || error.response?.data?.error;
      sileo.error({
        title: i18n.t("core:server_error_toast"),
        description: serverMessage,
      });
    },
  });
};

export const useUpdateBusiness = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<BusinessEntity>;
    }) => updateBusiness(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: businessKeys.all });
      sileo.success({
        title: i18n.t("business:updated_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string; error?: string }>) => {
      const serverMessage =
        error.response?.data?.message || error.response?.data?.error;
      sileo.error({
        title: i18n.t("core:server_error_toast"),
        description: serverMessage,
      });
    },
  });
};

export const useAssignCollaborators = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      payload,
    }: {
      businessId: string;
      payload: AssignCollaboratorsPayload;
    }) => assignCollaborators(businessId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: businessKeys.all });
      sileo.success({
        title: i18n.t("business:collaborators_assigned_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string; error?: string }>) => {
      const serverMessage =
        error.response?.data?.message || error.response?.data?.error;
      sileo.error({
        title: i18n.t("core:server_error_toast"),
        description: serverMessage,
      });
    },
  });
};

// ----------------------------------------------------
// Product Hooks
// ----------------------------------------------------
export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (params?: import("./types").GetProductsParams) =>
    [...productKeys.lists(), params] as const,
};

export const useProducts = (
  params?: import("./types").GetProductsParams,
  options?: { enabled?: boolean }
) => {
  const { isSessionActive } = useAuth();
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => getProducts(params),
    placeholderData: keepPreviousData,
    enabled: isSessionActive && (options?.enabled ?? true),
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: import("./types").CreateProductPayload) =>
      createProduct(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      sileo.success({
        title: i18n.t("business:product_created_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string; error?: string }>) => {
      const serverMessage =
        error.response?.data?.message || error.response?.data?.error;
      sileo.error({
        title: i18n.t("core:server_error_toast"),
        description: serverMessage,
      });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: import("./types").UpdateProductPayload;
    }) => updateProduct(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      sileo.success({
        title: i18n.t("business:product_updated_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string; error?: string }>) => {
      const serverMessage =
        error.response?.data?.message || error.response?.data?.error;
      sileo.error({
        title: i18n.t("core:server_error_toast"),
        description: serverMessage,
      });
    },
  });
};

export const useBulkCreateProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: import("./types").CreateProductPayload[]) =>
      bulkCreateProducts(items),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      sileo.success({
        title: i18n.t("business:products_bulk_created_success", {
          count: data.length,
        }),
      });
    },
    onError: (error: AxiosError<{ message?: string; error?: string }>) => {
      const serverMessage =
        error.response?.data?.message || error.response?.data?.error;
      sileo.error({
        title: i18n.t("core:server_error_toast"),
        description: serverMessage,
      });
    },
  });
};

export const useBulkUpdateProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: import("./types").BulkUpdateProductItemPayload[]) =>
      bulkUpdateProducts(items),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      sileo.success({
        title: i18n.t("business:products_bulk_updated_success", {
          count: data.length,
        }),
      });
    },
    onError: (error: AxiosError<{ message?: string; error?: string }>) => {
      const serverMessage =
        error.response?.data?.message || error.response?.data?.error;
      sileo.error({
        title: i18n.t("core:server_error_toast"),
        description: serverMessage,
      });
    },
  });
};

// ----------------------------------------------------
// Provider Hooks
// ----------------------------------------------------
export const providerKeys = {
  all: ["providers"] as const,
  lists: () => [...providerKeys.all, "list"] as const,
  list: (params?: import("./types").GetProvidersParams) =>
    [...providerKeys.lists(), params] as const,
};

export const useProviders = (
  params?: import("./types").GetProvidersParams,
  options?: { enabled?: boolean }
) => {
  const { isSessionActive } = useAuth();
  return useQuery({
    queryKey: providerKeys.list(params),
    queryFn: () => getProviders(params),
    placeholderData: keepPreviousData,
    enabled: isSessionActive && (options?.enabled ?? true),
  });
};

export const useCreateProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: import("./types").CreateProviderPayload) =>
      createProvider(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: providerKeys.all });
      sileo.success({
        title: i18n.t("business:provider_created_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string; error?: string }>) => {
      const serverMessage =
        error.response?.data?.message || error.response?.data?.error;
      sileo.error({
        title: i18n.t("core:server_error_toast"),
        description: serverMessage,
      });
    },
  });
};

export const useUpdateProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: import("./types").UpdateProviderPayload;
    }) => updateProvider(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: providerKeys.all });
      sileo.success({
        title: i18n.t("business:provider_updated_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string; error?: string }>) => {
      const serverMessage =
        error.response?.data?.message || error.response?.data?.error;
      sileo.error({
        title: i18n.t("core:server_error_toast"),
        description: serverMessage,
      });
    },
  });
};

// ----------------------------------------------------
// Invoice Hooks
// ----------------------------------------------------
export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (params?: import("./types").GetInvoicesParams) =>
    [...invoiceKeys.lists(), params] as const,
};

export const useInvoices = (
  params?: import("./types").GetInvoicesParams,
  options?: { enabled?: boolean }
) => {
  const { isSessionActive } = useAuth();
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: () => getInvoices(params),
    placeholderData: keepPreviousData,
    enabled: isSessionActive && (options?.enabled ?? true),
  });
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: import("./types").CreateInvoicePayload) =>
      createInvoice(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      sileo.success({
        title: i18n.t("business:invoice_created_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string; error?: string }>) => {
      const serverMessage =
        error.response?.data?.message || error.response?.data?.error;
      sileo.error({
        title: i18n.t("core:server_error_toast"),
        description: serverMessage,
      });
    },
  });
};

export const useUpdateInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: import("./types").UpdateInvoicePayload;
    }) => updateInvoice(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      sileo.success({
        title: i18n.t("business:invoice_updated_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string; error?: string }>) => {
      const serverMessage =
        error.response?.data?.message || error.response?.data?.error;
      sileo.error({
        title: i18n.t("core:server_error_toast"),
        description: serverMessage,
      });
    },
  });
};

export const useAnalyzeInvoice = () => {
  return useMutation({
    mutationFn: (params: import("./types").AnalyzeInvoiceParams) =>
      analyzeInvoice(params),
    onSuccess: (data) => {
      sileo.success({
        title: i18n.t("business:invoice_analyzed_success", {
          count: data.data?.items?.length || 0,
        }),
      });
    },
    onError: (error: AxiosError<{ message?: string; error?: string }>) => {
      const serverMessage =
        error.response?.data?.message || error.response?.data?.error;
      const status = error.response?.status;

      let title = i18n.t("core:server_error_toast");
      if (status === 503) {
        title = i18n.t("business:ai_service_unavailable_title");
      } else if (status === 429) {
        title = i18n.t("business:ai_rate_limit_title");
      }

      sileo.error({
        title,
        description:
          serverMessage || i18n.t("business:ai_service_error_generic"),
      });
    },
  });
};

export const useCreateInvoiceWithFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: import("./types").CreateInvoiceWithFileParams) =>
      createInvoiceWithFile(params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      sileo.success({
        title: i18n.t("business:invoice_created_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string; error?: string }>) => {
      const serverMessage =
        error.response?.data?.message || error.response?.data?.error;
      sileo.error({
        title: i18n.t("core:server_error_toast"),
        description: serverMessage,
      });
    },
  });
};

export const productLogKeys = {
  all: ["product-logs"] as const,
  list: (params?: import("./types").GetProductLogsParams) =>
    [...productLogKeys.all, "list", params] as const,
};

export const useProductLogs = (
  params?: import("./types").GetProductLogsParams,
  options?: { enabled?: boolean }
) => {
  const { isSessionActive } = useAuth();

  return useQuery({
    queryKey: productLogKeys.list(params),
    queryFn: () => getProductLogs(params),
    enabled: isSessionActive && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
  });
};
