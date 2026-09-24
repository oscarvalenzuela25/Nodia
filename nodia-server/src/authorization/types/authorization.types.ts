export interface TranslateItem {
  key: string;
  es: string;
  en: string;
}

export interface ActionContext {
  key: string;
  translates: TranslateItem[];
}

export interface ModuleContext {
  key: string;
  link: string;
  icon?: string | null;
  translates: TranslateItem[];
}

export interface ModuleGroupContext {
  module_group_key: string;
  icon?: string | null;
  translates: TranslateItem[];
  modules: ModuleContext[];
}

export interface AuthorizationContextResponse {
  roles: string[];
  actions: ActionContext[];
  modules: ModuleGroupContext[];
  can_analyze_invoice: boolean;
  can_use_gemini: boolean;
  can_use_mistral: boolean;
}
