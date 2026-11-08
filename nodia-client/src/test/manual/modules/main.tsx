// Isolated QA: production components; synthetic data; no real HTTP requests.
import { createRoot } from "react-dom/client";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/dm-sans/700.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import useAuthStore from "../../../store/authStore";
import config from "../../../store/configStore";
import settings from "../../../store/generalSettings/generalSettingsStore";
import { mainInstance } from "../../../config/api";
import i18n from "../../../translate";
import productionRouter from "../../../routes";
import type {
  ModuleEntity,
  ModuleGroupEntity,
  MoveModuleOrderCommand,
  OrderMetadata,
} from "../../../modules/generalSettings/pages/Modules/types";

const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
config.setState({
  themeType: params.get("theme") === "dark" ? "dark" : "light",
});
const actorId = "module-catalog-qa";
useAuthStore
  .getState()
  .login({
    token: "synthetic-never-sent",
    expiresAt: Date.now() + 3_600_000,
    user: { id: actorId, name: "QA" },
  });
type QAGroup = ModuleGroupEntity & { sort_order: number };
type QAModule = ModuleEntity & { sort_order: number; module_group_id: string };
let groups: QAGroup[] = [
  {
    id: "1",
    sort_order: 0,
    key: "administration",
    icon: "SettingsOutlined",
    is_active: true,
    translates: [{ key: "key", es: "Administración", en: "Administration" }],
  },
  {
    id: "2",
    sort_order: 1,
    key: "tools",
    icon: "BuildOutlined",
    is_active: true,
    translates: [{ key: "key", es: "Herramientas", en: "Tools" }],
  },
  {
    id: "3",
    sort_order: 2,
    key: "archived",
    is_active: false,
    translates: [{ key: "key", es: "Archivo", en: "Archive" }],
  },
  {
    id: "4",
    sort_order: 3,
    key: "empty",
    is_active: true,
    translates: [{ key: "key", es: "Grupo vacío", en: "Empty group" }],
  },
];
let modules: QAModule[] = Array.from({ length: 13 }, (_, index) => ({
  id: String(index + 1),
  key: index === 0 ? "users" : index === 1 ? "roles" : index === 2 ? "modules" : `synthetic_module_${index + 1}_long_identifier`,
  link:
    index === 0 ? "/users" : index === 1 ? "/roles" : index === 2 ? "/modules" : `/tools/synthetic-long-route-${index + 1}`,
  module_group_id: index === 11 ? "3" : index === 12 ? "2" : "1",
  sort_order: index >= 11 ? 0 : index,
  is_active: index !== 11,
  translates: [
    {
      key: "key",
      es: index === 0 ? "Usuarios" : index === 1 ? "Roles" : index === 2 ? "Módulos" : `Módulo sintético ${index + 1}`,
      en: index === 0 ? "Users" : index === 1 ? "Roles" : index === 2 ? "Modules" : `Synthetic module ${index + 1}`,
    },
  ],
}));
const byOrder = (left: { id: string; sort_order: number }, right: { id: string; sort_order: number }) =>
  left.sort_order - right.sort_order || (BigInt(left.id) < BigInt(right.id) ? -1 : BigInt(left.id) > BigInt(right.id) ? 1 : 0);
const sortedGroups = () => [...groups].sort(byOrder);
const sortedModules = () => [...modules].sort((left, right) => {
  const leftGroup = groups.find((group) => group.id === left.module_group_id)!;
  const rightGroup = groups.find((group) => group.id === right.module_group_id)!;
  return byOrder(leftGroup, rightGroup) || byOrder(left, right);
});
const context = () => ({
  roles: [], actions: [],
  modules: sortedGroups().filter((group) => group.is_active !== false).map((group) => ({
    module_group_key: group.key,
    translates: group.translates ?? [],
    modules: sortedModules().filter((item) => item.module_group_id === group.id && item.is_active !== false).map((item) => ({
      key: item.key, link: item.link, translates: item.translates ?? [],
    })),
  })),
});
settings.getState().setContext(context());
const neighbors = (items: Array<{ id: string; sort_order: number }>, id: string): OrderMetadata => {
  const index = items.findIndex((item) => item.id === id);
  const shape = (item: { id: string; sort_order: number } | undefined) => item ? { id: item.id, sort_order: item.sort_order } : null;
  return { previous: shape(items[index - 1]), next: shape(items[index + 1]) };
};
let failedDelete = false;
let failedMove = false;
let failedRecovery = false;
mainInstance.defaults.adapter = async (request) => {
  await new Promise<void>((resolve) => setTimeout(resolve, 150));
  const response = (data: unknown, status = 200) => ({ config: request, data, status, statusText: "QA", headers: {} });
  const fail = (status: number, message: string): never => {
    throw new AxiosError(message, "ERR_BAD_RESPONSE", request, undefined, response({ message }, status));
  };
  if (request.method === "get" && request.url?.endsWith("/authorization/context")) return response(context());
  const isGroup = /module-group/.test(request.url ?? "");
  if (request.method === "patch" && request.url?.endsWith("/order")) {
    const id = request.url.split("/").at(-2);
    const command = JSON.parse(String(request.data)) as MoveModuleOrderCommand;
    const item = isGroup ? groups.find((entry) => entry.id === id) : modules.find((entry) => entry.id === id);
    if (!item) return fail(404, isGroup ? "modules:groups.not_found" : "modules:not_found");
    if (!isGroup && (item as QAModule).module_group_id !== command.expected_module_group_id) return fail(409, "modules:order_conflict");
    const scope = isGroup ? sortedGroups() : sortedModules().filter((entry) => entry.module_group_id === (item as QAModule).module_group_id);
    const current = neighbors(scope, item.id);
    const isPlacement = command.direction === "before" || command.direction === "after";
    const neighbor = isPlacement
      ? scope.find((entry) => entry.id === command.expected_neighbor?.id)
      : command.direction === "up" ? current.previous : current.next;
    if (command.expected_sort_order !== item.sort_order || neighbor?.id !== command.expected_neighbor?.id || neighbor?.sort_order !== command.expected_neighbor?.sort_order)
      return fail(409, "modules:order_conflict");
    if (isPlacement && (!neighbor || neighbor.id === item.id)) return fail(409, "modules:order_conflict");
    const sourceIndex = scope.findIndex((entry) => entry.id === item.id);
    const targetIndex = scope.findIndex((entry) => entry.id === neighbor?.id);
    // One synthetic transaction: rotate the affected interval, retaining its original ranks.
    // A placement uses the target's captured CAS metadata, not the immediate neighbor.
    const orderedScope = [...scope];
    if (targetIndex !== -1) {
      const [source] = orderedScope.splice(sourceIndex, 1);
      const adjustedTargetIndex = targetIndex - (sourceIndex < targetIndex ? 1 : 0);
      const insertionIndex = isPlacement
        ? adjustedTargetIndex + (command.direction === "after" ? 1 : 0)
        : targetIndex;
      orderedScope.splice(insertionIndex, 0, source);
    }
    const moved = orderedScope.some((entry, index) => entry.id !== scope[index].id);
    const originalRanks = scope.map((entry) => entry.sort_order);
    orderedScope.forEach((entry, index) => { entry.sort_order = originalRanks[index]; });
    if (params.has("failMove") && !failedMove) {
      failedMove = true;
      // Simulate another administrator's change or a committed response lost in transport.
      if (params.get("failMove") === "conflict") return fail(409, "modules:order_conflict");
      if (params.get("failMove") === "timeout") throw new AxiosError("Synthetic response lost", "ECONNABORTED", request);
      if (params.get("failMove") === "invalid") return response({ status: "moved", id: item.id });
    }
    const ordered = isGroup ? sortedGroups() : sortedModules();
    const position = ordered.findIndex((entry) => entry.id === item.id) + 1;
    const updatedScope = isGroup ? sortedGroups() : sortedModules().filter((entry) => entry.module_group_id === (item as QAModule).module_group_id);
    return response({
      status: moved ? "moved" : "unchanged", id: item.id,
      ...(!isGroup ? { module_group_id: (item as QAModule).module_group_id } : {}),
      sort_order: item.sort_order, ...neighbors(updatedScope, item.id),
      page: Math.ceil(position / (command.page_size ?? 10)), position,
    });
  }
  if (request.method === "delete") {
    const id = request.url?.split("/").at(-1);
    if (isGroup && modules.some((item) => item.module_group_id === id)) return fail(409, "modules:groups.delete_has_modules");
    if (!isGroup && params.get("failDelete") === "1" && !failedDelete) {
      failedDelete = true;
      return fail(503, "core:server_error_toast");
    }
    if (isGroup) groups = groups.filter((item) => item.id !== id);
    else modules = modules.filter((item) => item.id !== id);
    return response(undefined, 204);
  }
  if (request.method !== "get" || !/modules?/.test(request.url ?? "")) throw new Error("Unexpected QA request");
  const query = request.params ?? {};
  const filter = query.q ?? {};
  if (query.ordering && (query.all || Object.keys(filter).length || Number(query.size ?? query.limit ?? 10) > 100)) return fail(400, "modules:invalid_order_view");
  if (query.ordering && params.get("failRecovery") === "1" && failedMove && !failedRecovery) {
    failedRecovery = true;
    return fail(503, "core:server_error_toast");
  }
  let rows: Array<ModuleEntity | ModuleGroupEntity> = isGroup
    ? sortedGroups().map((item) => ({ ...item, ...(query.ordering && params.get("missingMetadata") !== "1" ? { ordering: neighbors(sortedGroups(), item.id) } : {}) }))
    : sortedModules().map((item) => ({
        ...item,
        ...(query.includes === false ? {} : { module_group: groups.find((group) => group.id === item.module_group_id) }),
        ...(query.ordering && params.get("missingMetadata") !== "1" ? {
          ordering: neighbors(sortedModules().filter((entry) => entry.module_group_id === item.module_group_id), item.id),
          group_ordering: neighbors(sortedGroups(), item.module_group_id),
        } : {}),
      }));
  if (typeof filter.is_active_eq === "boolean") rows = rows.filter((item) => item.is_active === filter.is_active_eq);
  if (typeof filter.key_cont === "string") rows = rows.filter((item) => item.key.includes(filter.key_cont));
  if (Array.isArray(filter.module_group_id_in)) rows = rows.filter((item) => "module_group_id" in item && filter.module_group_id_in.includes(item.module_group_id));
  if (Array.isArray(filter.key_in)) rows = rows.filter((item) => filter.key_in.includes(item.key));
  const limit = Number(query.size ?? query.limit ?? 10);
  const anchor = query.locate_id ? rows.findIndex((item) => item.id === query.locate_id) : undefined;
  if (anchor === -1) return fail(404, isGroup ? "modules:groups.not_found" : "modules:not_found");
  const page = anchor === undefined ? Number(query.page ?? 1) : Math.floor(anchor / limit) + 1;
  return response({
    data: query.all ? rows : rows.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total_items: rows.length, total_pages: Math.ceil(rows.length / limit) },
  });
};
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
client.setQueryData(["authorization", "context", actorId], context());
const router = createMemoryRouter(productionRouter.routes, {
  initialEntries: ["/modules"],
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <MUIProvider>
      <RouterProvider router={router} />
    </MUIProvider>
  </QueryClientProvider>,
);
