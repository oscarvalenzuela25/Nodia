export type ActionItem = {
  id: string;
  key: string;
  nameTranslations?: Record<string, string>;
  description: string | null;
  moduleId?: string | null;
  moduleKey: string | null;
  isActive: boolean;
};

export type ActionFormData = {
  id?: string;
  key: string;
  nameTranslations?: Record<string, string>;
  description: string | null;
  moduleId?: string | null;
  moduleKey?: string | null;
  isActive: boolean;
};

export type ModuleOption = {
  value: string;
  label: string;
  category?: string;
};

export type Action = {
  id: string;
  key: string;
  description?: string | null;
  is_active?: boolean;
  module_id?: string | null;
  module?: {
    id: string;
    key: string;
    type?: string;
  } | null;
  created_at?: string;
  updated_at?: string;
};

export type CreateActionPayload = {
  key: string;
  module_id?: string | null;
  description?: string | null;
  is_active?: boolean;
};

export type UpdateActionPayload = {
  key?: string;
  module_id?: string | null;
  description?: string | null;
  is_active?: boolean;
};

export type GetActionsParams = {
  all?: boolean;
  includes?: boolean;
  page?: number;
  size?: number;
  q?: Record<string, unknown>;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
};
