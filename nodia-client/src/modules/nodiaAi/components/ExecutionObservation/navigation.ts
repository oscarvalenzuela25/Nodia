import type { NodiaAiToolObservation } from "../../infrastructure/types";
import { canonicalModuleDestination } from "../../../../routes/moduleDestinations";

const moduleRoutes = new Set(["/business", "/reservations", "/finances-personal", "/nodia-ai", "/users", "/roles", "/actions", "/modules", "/ai-providers"]);

export function nodiaAiObservationDestination(item: NodiaAiToolObservation["navigation"][number]): string | null {
  const destination = canonicalModuleDestination(item.module_route);
  if (!moduleRoutes.has(destination)) return null;
  if (item.kind === "module") return item.id === null ? destination : null;
  if (item.kind === "business_detail" && destination === "/business" && item.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id))
    return `${destination}/${encodeURIComponent(item.id)}`;
  if (item.kind === "rental_property" && destination === "/reservations" && item.id && /^[1-9]\d{0,18}$/.test(item.id) && BigInt(item.id) <= 9223372036854775807n)
    return `${destination}?property=${encodeURIComponent(item.id)}`;
  return null;
}
