export type ActionItem = {
  id: string;
  key: string;
  nameTranslations: Record<string, string>;
  description: string | null;
  moduleKey: string | null;
  isActive: boolean;
};

export type ActionFormData = {
  id?: string;
  key: string;
  nameTranslations: Record<string, string>;
  description: string | null;
  moduleKey: string | null;
  isActive: boolean;
};

export type ModuleOption = {
  value: string;
  label: string;
  category?: string;
};
