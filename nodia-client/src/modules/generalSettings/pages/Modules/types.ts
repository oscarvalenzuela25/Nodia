export type TranslateItem = {
  key: string;
  es: string;
  en: string;
};

export interface ModuleGroupSummary {
  id: string;
  key: string;
  icon?: string | null;
  is_active?: boolean;
  translates?: TranslateItem[];
}

export interface ModuleGroupEntity {
  id: string;
  key: string;
  icon?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  translates?: TranslateItem[];
}

export type ModuleGroupItem = {
  id: string;
  key: string;
  icon?: string | null;
  name?: string | null;
  nameTranslations?: Record<string, string>;
  isActive: boolean;
  translates?: TranslateItem[];
};

export type ModuleGroupFormData = {
  id?: string;
  key: string;
  icon?: string | null;
  nameTranslations: Record<string, string>;
  isActive: boolean;
  translates?: TranslateItem[];
};

export interface CreateModuleGroupPayload {
  key: string;
  icon?: string | null;
  is_active?: boolean;
  translates?: TranslateItem[];
}

export interface UpdateModuleGroupPayload {
  key?: string;
  icon?: string | null;
  is_active?: boolean;
  translates?: TranslateItem[];
}

export interface GetModuleGroupsParams {
  page?: number;
  limit?: number;
  size?: number;
  all?: boolean;
  q?: Record<string, unknown>;
}

export type ModuleItem = {
  id: string;
  key: string;
  link?: string;
  icon?: string | null;
  name?: string | null;
  module_group_id?: string;
  module_group?: ModuleGroupSummary;
  groupName?: string | null;
  groupKey?: string | null;
  nameTranslations?: Record<string, string>;
  isActive: boolean;
  translates?: TranslateItem[];
};

export type ModuleFormData = {
  id?: string;
  key: string;
  module_group_id: string;
  link: string;
  icon?: string | null;
  nameTranslations: Record<string, string>;
  isActive: boolean;
  translates?: TranslateItem[];
};

export interface ModuleEntity {
  id: string;
  key: string;
  link?: string;
  icon?: string | null;
  module_group_id?: string;
  module_group?: ModuleGroupSummary;
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
  module_group_id: string;
  link: string;
  icon?: string | null;
  is_active?: boolean;
  translates?: TranslateItem[];
}

export interface UpdateModulePayload {
  key?: string;
  module_group_id?: string;
  link?: string;
  icon?: string | null;
  is_active?: boolean;
  translates?: TranslateItem[];
}
