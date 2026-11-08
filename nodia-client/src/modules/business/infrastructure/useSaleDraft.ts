import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import useAuthStore from "../../../store/authStore";
import { SaleWorkspaceEngine } from "./saleWorkspaceEngine";

/** One mounted engine owns every local cart and its durable request identity. */
export function useSaleDraft(businessId: string) {
  const actorId = useAuthStore((state) => state.user?.id ?? "");
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  const queryClient = useQueryClient();
  const engine = useMemo(() => new SaleWorkspaceEngine(actorId, businessId, sessionVersion, async () => {
    await queryClient.invalidateQueries({ queryKey: ["business-sales", businessId] });
  }), [actorId, businessId, sessionVersion, queryClient]);
  useEffect(() => engine.mount(), [engine]);
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const { workspace } = state;
  const active = workspace.sessions.find((entry) => entry.id === workspace.activeId)!;
  // Each callback captures the displayed cart, including across awaits in its caller.
  const id = active.id;
  return {
    ...active,
    busy: state.busyIds.includes(id), storageError: state.storageError,
    sessions: workspace.sessions.map((entry) => ({ ...entry, busy: state.busyIds.includes(entry.id) })),
    activeId: id, activeNumber: active.number,
    canDiscardWorkspace: !state.storageError && state.busyIds.length === 0 && !workspace.sessions.some((entry) => entry.pending),
    hasUnsaved: workspace.sessions.some((entry) => entry.dirty || Boolean(entry.pending) || Boolean(entry.barcode) || Object.keys(entry.quantityDrafts).length > 0),
    newSale: () => engine.newSale(), selectSale: (target: string) => engine.selectSale(target), closeSale: (target: string) => engine.closeSale(target),
    setLines: (value: typeof active.lines) => engine.edit(id, { lines: value, dirty: true }),
    setPaymentMethod: (value: typeof active.paymentMethod) => engine.setPaymentMethod(id, value),
    setDescription: (value: string) => engine.edit(id, { description: value, dirty: true }),
    setBarcode: (value: string) => engine.edit(id, { barcode: value }),
    setQuantityDrafts: (value: typeof active.quantityDrafts | ((previous: typeof active.quantityDrafts) => typeof active.quantityDrafts)) => engine.setQuantityDrafts(id, value),
    load: (sale: NonNullable<typeof active.sale>) => engine.load(sale), reset: () => engine.reset(id), clearForExit: () => engine.clearForExit(),
    save: () => engine.save(id), checkout: () => engine.checkout(id),
    transition: (operation: "complete" | "cancel" | "discard", reason?: string) => engine.transition(id, operation, reason),
    reconcile: () => engine.reconcile(id), retry: () => engine.retry(id), retryStorage: () => engine.retryStorage(),
  };
}
