export type ModuleType = "module" | "submodule";

export type ParentModule = {
  id: string;
  key: string;
};

export type ModuleItem = {
  id: string;
  key: string;
  type: ModuleType;
  parentModule: ParentModule | null;
  nameTranslations: Record<string, string>;
  isActive: boolean;
};

export type ModuleFormData = {
  id?: string;
  key: string;
  type: ModuleType;
  parentId: string | null;
  parentKey?: string | null;
  nameTranslations: Record<string, string>;
  isActive: boolean;
};

export type ParentModuleOption = {
  value: string;
  label: string;
  category?: string;
};

export interface ModuleEntity {
  id: string;
  key: string;
  type: ModuleType;
  parent_id: string | null;
  parent_module?: {
    id: string;
    key: string;
    type: ModuleType;
    is_active: boolean;
  } | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GetModulesParams {
  page?: number;
  limit?: number;
  size?: number;
  all?: boolean;
  includes?: boolean;
  q?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}

export interface CreateModulePayload {
  key: string;
  type: ModuleType;
  parent_id?: string | null;
  is_active?: boolean;
}

export interface UpdateModulePayload {
  key?: string;
  type?: ModuleType;
  parent_id?: string | null;
  is_active?: boolean;
}
