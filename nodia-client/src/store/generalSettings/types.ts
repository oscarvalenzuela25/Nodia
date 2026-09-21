export interface TranslateItem {
  key: string;
  es: string;
  en: string;
}

export interface ActionContext {
  key: string;
  description: string | null;
  translates: TranslateItem[];
}

export interface ModuleContext {
  key: string;
  link?: string;
  translates: TranslateItem[];
}

export interface ModuleGroupContext {
  module_group_key: string;
  translates: TranslateItem[];
  modules: ModuleContext[];
}

export interface AuthorizationContextResponse {
  roles: string[];
  actions: ActionContext[];
  modules: ModuleGroupContext[];
  can_analyze_invoice?: boolean;
  can_use_gemini?: boolean;
  can_use_mistral?: boolean;
}

export interface GeneralSettingsState {
  roles: string[];
  actions: ActionContext[];
  modules: ModuleGroupContext[];
  isLoaded: boolean;
  can_analyze_invoice: boolean;
  can_use_gemini: boolean;
  can_use_mistral: boolean;

  setContext: (data: AuthorizationContextResponse) => void;
  clearContext: () => void;
}
