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
