import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CanceledError } from "axios";
import { useRef, useState } from "react";
import { sileo } from "sileo";
import { notifyHttpError } from "../../../../../../config/httpFeedback";
import i18n from "../../../../../../translate";
import {
  createList,
  isUncertainListWrite,
  readListReceipt,
  shoppingListHttpStatus,
  updateList,
} from "./infrastructure/services";
import type { ShoppingListCreate, ShoppingListDraft } from "./infrastructure/services";
import { shoppingListKeys, useListScopeGuard } from "./infrastructure/useServices";
import type { ShoppingListScope } from "./infrastructure/useServices";

type Write =
  | { kind: "create"; command: ShoppingListCreate }
  | { kind: "receipt"; command: ShoppingListCreate }
  | { kind: "edit"; id: string; version: number; draft: ShoppingListDraft };

export function useListEditor(scope: ShoppingListScope, onSaved: () => void) {
  const canUseResult = useListScopeGuard(scope);
  const client = useQueryClient();
  const inFlight = useRef(false);
  const [pendingCreate, setPendingCreate] = useState<ShoppingListCreate>();
  const [receiptMissing, setReceiptMissing] = useState(false);
  const [needsCurrent, setNeedsCurrent] = useState(false);
  const [accessLost, setAccessLost] = useState(false);

  const mutation = useMutation({
    retry: false,
    mutationFn: (write: Write) => {
      if (!canUseResult()) throw new CanceledError("Shopping list scope changed");
      switch (write.kind) {
        case "create": return createList(scope.businessId, write.command);
        case "receipt": return readListReceipt(scope.businessId, write.command.request_key);
        case "edit": return updateList(scope.businessId, write.id, { ...write.draft, version: write.version });
      }
    },
  });

  const perform = async (write: Write) => {
    if (inFlight.current || !canUseResult()) return;
    inFlight.current = true;
    try {
      const result = await mutation.mutateAsync(write);
      if (!canUseResult()) return;
      if (!result) {
        setReceiptMissing(true);
        return;
      }
      void client.invalidateQueries({ queryKey: shoppingListKeys.list(scope) });
      if (write.kind === "edit") {
        void client.invalidateQueries({ queryKey: shoppingListKeys.detail(scope, write.id) });
      }
      sileo.success({ title: i18n.t("business:market_lists.saved") });
      onSaved();
    } catch (error) {
      if (!canUseResult()) return;
      notifyHttpError(error);
      const status = shoppingListHttpStatus(error);
      if (status === 401 || status === 403 || status === 404) {
        setAccessLost(true);
        void client.invalidateQueries({ queryKey: shoppingListKeys.list(scope) });
      }
      if (write.kind === "create") {
        setPendingCreate(isUncertainListWrite(error) ? write.command : undefined);
        setReceiptMissing(false);
      }
      if (write.kind === "edit" && (status === 409 || isUncertainListWrite(error))) {
        setNeedsCurrent(true);
      }
    } finally {
      inFlight.current = false;
    }
  };

  return {
    isPending: mutation.isPending,
    pendingCreate: Boolean(pendingCreate),
    receiptMissing,
    needsCurrent,
    accessLost,
    acceptCurrent: () => setNeedsCurrent(false),
    save: (draft: ShoppingListDraft, edit?: { id: string; version: number }) => {
      if (pendingCreate || needsCurrent) return;
      const write: Write = edit
        ? { kind: "edit", ...edit, draft }
        : {
            kind: "create",
            command: {
              request_key: crypto.randomUUID(), name: draft.name,
              items: draft.items.map(({ product_id, quantity }) => ({ product_id, quantity })),
            },
          };
      void perform(write);
    },
    verify: () => {
      if (pendingCreate) void perform({ kind: "receipt", command: pendingCreate });
    },
    retryCreate: () => {
      if (pendingCreate && receiptMissing) void perform({ kind: "create", command: pendingCreate });
    },
  };
}
