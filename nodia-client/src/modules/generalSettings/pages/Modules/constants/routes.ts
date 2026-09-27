export interface AppRouteOption {
  value: string;
  labelKey: string;
  defaultLabel: string;
}

export const APP_AVAILABLE_ROUTES: AppRouteOption[] = [
  { value: "/", labelKey: "modules:routes.home", defaultLabel: "Inicio (/)" },
  {
    value: "/business",
    labelKey: "modules:routes.business",
    defaultLabel: "Negocios (/business)",
  },
  {
    value: "/settings/users",
    labelKey: "modules:routes.users",
    defaultLabel: "Usuarios (/settings/users)",
  },
  {
    value: "/settings/roles",
    labelKey: "modules:routes.roles",
    defaultLabel: "Roles (/settings/roles)",
  },
  {
    value: "/settings/actions",
    labelKey: "modules:routes.actions",
    defaultLabel: "Acciones (/settings/actions)",
  },
  {
    value: "/settings/modules",
    labelKey: "modules:routes.modules",
    defaultLabel: "Módulos (/settings/modules)",
  },
  {
    value: "/settings/ai-providers",
    labelKey: "modules:routes.ai_providers",
    defaultLabel: "Proveedores de IA (/settings/ai-providers)",
  },
];
