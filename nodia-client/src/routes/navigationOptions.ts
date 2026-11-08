import { PERSONAL_FINANCE_ROUTE } from "../modules/finances/constants/routes";
import { RENTAL_RESERVATIONS_ROUTE } from "../modules/rentals/constants/routes";
import { BUSINESS_ROUTE } from "../modules/business/constants/routes";
import { NODIA_AI_ROUTE } from "../modules/nodiaAi/constants/routes";
import { NODIA_TEACHER_ROUTE } from "../modules/teacher/constants/routes";

export interface AppRouteOption {
  value: string;
  labelKey: string;
  defaultLabel: string;
}

export const APP_AVAILABLE_ROUTES: AppRouteOption[] = [
  { value: NODIA_TEACHER_ROUTE, labelKey: "modules:routes.nodia_teacher", defaultLabel: "Nodia Teacher (/nodia-teacher)" },
  { value: NODIA_AI_ROUTE, labelKey: "modules:routes.nodia_ai", defaultLabel: "NodiaAI (/nodia-ai)" },
  {value:RENTAL_RESERVATIONS_ROUTE,labelKey:"modules:routes.rental_reservations",defaultLabel:"Reservas (/reservations)"},
  {
    value: PERSONAL_FINANCE_ROUTE,
    labelKey: "modules:routes.personal_finance",
    defaultLabel: "Finanzas personales (/finances-personal)",
  },
  {
    value: BUSINESS_ROUTE,
    labelKey: "modules:routes.business",
    defaultLabel: "Negocios (/business)",
  },
  {
    value: "/users",
    labelKey: "modules:routes.users",
    defaultLabel: "Usuarios (/users)",
  },
  {
    value: "/roles",
    labelKey: "modules:routes.roles",
    defaultLabel: "Roles (/roles)",
  },
  {
    value: "/actions",
    labelKey: "modules:routes.actions",
    defaultLabel: "Acciones (/actions)",
  },
  {
    value: "/modules",
    labelKey: "modules:routes.modules",
    defaultLabel: "Módulos (/modules)",
  },
  {
    value: "/ai-providers",
    labelKey: "modules:routes.ai_providers",
    defaultLabel: "Proveedores de IA (/ai-providers)",
  },
];
