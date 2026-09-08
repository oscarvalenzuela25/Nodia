export interface RoleSummary {
  id: string;
  key: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  translates?: Array<{ key: string; es: string; en: string }>;
}

export interface ModuleSummary {
  id: string;
  key: string;
  group_by?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  translates?: Array<{ key: string; es: string; en: string }>;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  roles: RoleSummary[];
  modules?: ModuleSummary[];
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

export interface GetUsersParams {
  page?: number;
  size?: number;
  all?: boolean;
  includes?: boolean;
  q?: Record<string, unknown>;
}

export interface CreateUserPayload {
  email: string;
  name?: string | null;
  image_url?: string | null;
  is_active?: boolean;
  roles?: string[];
  modules?: string[];
}

export interface UpdateUserPayload {
  email?: string;
  name?: string | null;
  image_url?: string | null;
  is_active?: boolean;
  roles?: string[];
  modules?: string[];
}
