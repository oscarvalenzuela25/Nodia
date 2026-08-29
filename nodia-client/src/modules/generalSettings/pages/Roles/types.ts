export type RoleItem = {
  id: string;
  key: string;
  nameTranslations: Record<string, string>;
  actions: string[];
  isActive: boolean;
};

export type RoleFormData = {
  id?: string;
  key: string;
  nameTranslations: Record<string, string>;
  actions: string[];
  isActive: boolean;
};

export type ActionOption = {
  value: string;
  label: string;
  category?: string;
};
