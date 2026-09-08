export type TranslateItem = {
  key: string;
  es: string;
  en: string;
};

export type ModuleItem = {
  id: string;
  key: string;
  group_by: string;
  nameTranslations?: Record<string, string>;
  isActive: boolean;
  translates?: TranslateItem[];
};

export type ModuleFormData = {
  id?: string;
  key: string;
  group_by: string;
  nameTranslations: Record<string, string>;
  isActive: boolean;
  translates?: TranslateItem[];
};

export interface ModuleEntity {
  id: string;
  key: string;
  group_by: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  translates?: TranslateItem[];
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
  group_by: string;
  is_active?: boolean;
  translates?: TranslateItem[];
}

export interface UpdateModulePayload {
  key?: string;
  group_by?: string;
  is_active?: boolean;
  translates?: TranslateItem[];
}
