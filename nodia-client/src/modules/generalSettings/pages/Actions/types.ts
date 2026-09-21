export type TranslateItem = {
  key: string;
  es: string;
  en: string;
};

export type ActionItem = {
  id: string;
  name?: string | null;
  key: string;
  nameTranslations?: Record<string, string>;
  descriptionTranslations?: Record<string, string>;
  description: string | null;
  isActive: boolean;
  translates?: TranslateItem[];
};

export type ActionFormData = {
  id?: string;
  key: string;
  nameTranslations?: Record<string, string>;
  descriptionTranslations?: Record<string, string>;
  description: string | null;
  isActive: boolean;
  translates?: TranslateItem[];
};

export type Action = {
  id: string;
  key: string;
  description?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  translates?: TranslateItem[];
};

export type CreateActionPayload = {
  key: string;
  description?: string | null;
  is_active?: boolean;
  translates?: TranslateItem[];
};

export type UpdateActionPayload = {
  key?: string;
  description?: string | null;
  is_active?: boolean;
  translates?: TranslateItem[];
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

export type BusinessAction = {
  id: string;
  key: string;
  has_description?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  translates?: TranslateItem[];
};

export type CreateBusinessActionPayload = {
  key: string;
  has_description?: boolean;
  is_active?: boolean;
  translates?: TranslateItem[];
};

export type UpdateBusinessActionPayload = {
  key?: string;
  has_description?: boolean;
  is_active?: boolean;
  translates?: TranslateItem[];
};

export type BusinessActionFormData = {
  id?: string;
  key: string;
  has_description?: boolean;
  is_active?: boolean;
  nameTranslations?: Record<string, string>;
  descriptionTranslations?: Record<string, string>;
  translates?: TranslateItem[];
};
