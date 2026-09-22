export interface TranslateItem {
  key: string;
  es: string;
  en: string;
}

export interface BusinessOwner {
  id: string;
  name: string;
  email?: string;
  image_url?: string | null;
}

export interface BusinessCollaborator {
  id: string;
  user_id: string;
  position: string | null;
  action_ids: string[];
  is_active: boolean;
  user?: BusinessOwner;
}

export interface BusinessEntity {
  id: string;
  name: string;
  owner_id: string;
  has_description: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  owner?: BusinessOwner;
  collaborators?: BusinessCollaborator[];
  user_role?: "owner" | "collaborator";
  user_position?: string | null;
  user_action_ids?: string[];
  collaborators_count?: number;
  translates?: TranslateItem[];
}

export interface GetBusinessesResponse {
  data: BusinessEntity[];
  meta: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}

export interface BusinessFormData {
  id?: string;
  name: string;
  description_es?: string;
  description_en?: string;
  is_active?: boolean;
  translates?: TranslateItem[];
}

export interface CollaboratorAssignmentItem {
  user_id: string;
  position?: string;
  action_ids: string[];
}

export interface AssignCollaboratorsPayload {
  users: CollaboratorAssignmentItem[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

export interface GetBusinessesParams {
  page?: number;
  limit?: number;
  all?: boolean;
  includes?: boolean;
  q?: Record<string, string | number | boolean>;
}

// ----------------------------------------------------
// Product Types
// ----------------------------------------------------
export interface ProductEntity {
  id: string;
  business_id: string;
  provider_id?: string | null;
  code: string;
  name: string;
  cost_price: number;
  cost_price_tax: number;
  profit_percentage: number;
  sale_price: number;
  stock: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  provider?: ProviderEntity | null;
}

export interface CreateProductPayload {
  business_id: string;
  provider_id?: string | null;
  code: string;
  name: string;
  cost_price: number;
  cost_price_tax: number;
  profit_percentage: number;
  sale_price: number;
  stock?: number;
  is_active?: boolean;
}

export interface UpdateProductPayload {
  provider_id?: string | null;
  code?: string;
  name?: string;
  cost_price?: number;
  cost_price_tax?: number;
  profit_percentage?: number;
  sale_price?: number;
  stock?: number;
  is_active?: boolean;
}

export interface BulkUpdateProductItemPayload extends UpdateProductPayload {
  id: string;
}

export interface GetProductsResponse {
  data: ProductEntity[];
  meta: PaginationMeta;
}

export interface GetProductsParams {
  page?: number;
  limit?: number;
  all?: boolean;
  includes?: boolean;
  q?: {
    business_id_eq?: string;
    provider_id_eq?: string;
    provider_id_in?: string[];
    code_cont?: string;
    code_eq?: string;
    code_in?: string[];
    name_cont?: string;
    name_in?: string[];
    is_active_eq?: boolean;
    stock_status_in?: string[];
    s?: string;
    [key: string]: unknown;
  };
}

// ----------------------------------------------------
// Provider Types
// ----------------------------------------------------
export interface ProviderFieldConfig {
  value: string;
  instructions?: string;
}

export type ProviderFieldsMapping = Record<
  string,
  ProviderFieldConfig | string | unknown
>;

export interface ProviderEntity {
  id: string;
  business_id: string;
  name: string;
  tax: number;
  fields?: ProviderFieldsMapping;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateProviderPayload {
  business_id: string;
  name: string;
  tax?: number;
  fields?: Record<string, unknown>;
  is_active?: boolean;
}

export interface UpdateProviderPayload {
  name?: string;
  tax?: number;
  fields?: Record<string, unknown>;
  is_active?: boolean;
}

export interface GetProvidersResponse {
  data: ProviderEntity[];
  meta: PaginationMeta;
}

export interface GetProvidersParams {
  page?: number;
  limit?: number;
  all?: boolean;
  includes?: boolean;
  q?: {
    name_cont?: string;
    business_id_eq?: string;
    is_active_eq?: boolean;
    s?: string;
    [key: string]: unknown;
  };
}

// ----------------------------------------------------
// Invoice Types
// ----------------------------------------------------
export interface InvoiceEntity {
  id: string;
  business_id: string;
  provider_id?: string | null;
  code: string;
  total_amount: number;
  path_storage: string;
  data?: {
    status?: "paid" | "pending" | "overdue";
    issue_date?: string;
    due_date?: string;
    notes?: string;
    [key: string]: unknown;
  };
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  provider?: ProviderEntity | null;
}

export interface CreateInvoicePayload {
  business_id: string;
  provider_id?: string | null;
  code: string;
  total_amount?: number;
  path_storage: string;
  data?: Record<string, unknown>;
}

export interface UpdateInvoicePayload {
  provider_id?: string | null;
  code?: string;
  total_amount?: number;
  path_storage?: string;
  data?: Record<string, unknown>;
  is_active?: boolean;
}

export interface GetInvoicesResponse {
  data: InvoiceEntity[];
  meta: PaginationMeta;
}

export interface GetInvoicesParams {
  page?: number;
  limit?: number;
  all?: boolean;
  includes?: boolean;
  q?: {
    business_id_eq?: string;
    provider_id_eq?: string;
    code_cont?: string;
    code_eq?: string;
    is_active_eq?: boolean;
    s?: string;
    [key: string]: unknown;
  };
}

// ----------------------------------------------------
// Invoice Analysis Types
// ----------------------------------------------------
export interface ExtractedInvoiceItem {
  code?: string | null;
  name: string;
  quantity: number;
  cost_price?: number | null;
  cost_price_tax?: number | null;
  unit_price?: number | null;
  total_price?: number | null;
  [key: string]: unknown;
}

export interface AnalyzeInvoiceResponse {
  business_id: string;
  provider_id: string | null;
  code: string;
  total_amount: number;
  data: {
    issue_date?: string;
    items: ExtractedInvoiceItem[];
    [key: string]: unknown;
  };
}

export interface AnalyzeInvoiceParams {
  file: File;
  business_id: string;
  provider_id?: string;
  ai_provider?: 'gemini' | 'mistral';
}

export interface CreateInvoiceWithFileParams {
  file?: File;
  business_id: string;
  provider_id?: string | null;
  code: string;
  total_amount?: number;
  path_storage?: string;
  data?: Record<string, unknown>;
  is_active?: boolean;
}

// ----------------------------------------------------
// Product Log Types
// ----------------------------------------------------
export interface ProductLogEntity {
  id: string;
  product_id: string;
  code: string;
  name: string;
  cost_price: number;
  cost_price_tax: number;
  profit_percentage: number;
  sale_price: number;
  stock: number;
  created_at: string;
  updated_at: string;
}

export interface GetProductLogsResponse {
  data: ProductLogEntity[];
  meta: PaginationMeta;
}

export interface GetProductLogsParams {
  page?: number;
  limit?: number;
  all?: boolean;
  includes?: boolean;
  q?: {
    product_id_eq?: string;
    product_id_in?: string[];
    code_cont?: string;
    code_eq?: string;
    code_in?: string[];
    name_cont?: string;
    s?: string;
    [key: string]: unknown;
  };
}
