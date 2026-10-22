import type { NodiaAiToolObservation } from "../../infrastructure/types";

const moduleRoutes = new Set(["/tools/business", "/tools/reservations", "/tools/finances-personal", "/tools/nodia-ai", "/settings/users", "/settings/roles", "/settings/actions", "/settings/modules", "/settings/ai-providers"]);

export function nodiaAiObservationDestination(item: NodiaAiToolObservation["navigation"][number]): string | null {
  if (!moduleRoutes.has(item.module_route)) return null;
  if (item.kind === "module") return item.id === null ? item.module_route : null;
  if (item.kind === "business_detail" && item.module_route === "/tools/business" && item.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id))
    return `${item.module_route}/${encodeURIComponent(item.id)}`;
  if (item.kind === "rental_property" && item.module_route === "/tools/reservations" && item.id && /^[1-9]\d{0,18}$/.test(item.id) && BigInt(item.id) <= 9223372036854775807n)
    return `${item.module_route}?property=${encodeURIComponent(item.id)}`;
  return null;
}
