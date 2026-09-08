export type TranslateItem = {
  key: string;
  es: string;
  en: string;
};

export interface Action {
  id: string;
  module_id: string;
  key: string;
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  translates?: TranslateItem[];
}

export interface Role {
  id: string;
  key: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  actions?: (Action | string)[];
  nameTranslations?: Record<string, string>;
  translates?: TranslateItem[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface GetRolesParams {
  page?: number;
  size?: number;
  all?: boolean;
  includes?: boolean;
  q?: Record<string, unknown>;
}

export type RoleItem = {
  id: string;
  name?: string | null;
  key: string;
  nameTranslations?: Record<string, string>;
  translates?: TranslateItem[];
  actions: string[];
  isActive: boolean;
};

export type RoleFormData = {
  id?: string;
  key: string;
  nameTranslations?: Record<string, string>;
  actions: string[];
  isActive: boolean;
  translates?: TranslateItem[];
};

export type ActionOption = {
  value: string;
  label: string;
  category?: string;
};

export interface CreateRolePayload {
  key: string;
  is_active?: boolean;
  actions?: string[];
  translates?: TranslateItem[];
}

export interface UpdateRolePayload {
  key?: string;
  is_active?: boolean;
  actions?: string[];
  translates?: TranslateItem[];
}
