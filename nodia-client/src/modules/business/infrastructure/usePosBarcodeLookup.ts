import { useLayoutEffect, useRef, useState } from "react";
import axios from "axios";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import { getServerErrorCode } from "../../../config/axiosInstance";
import { getProductByBarcode } from "./salesServices";
import { barcodeValue } from "./salesPolicies";
import type { ProductEntity } from "./types";

type Options = {
  businessId: string;
  context: string;
  enabled: boolean;
  onProduct: (product: ProductEntity) => void;
  onMissing: (barcode: string, scope: string) => void;
  onError: (error: unknown) => void;
  onFinished: () => void;
};

/** One exact lookup per scan, scoped to the actor/session/business/cart on screen. */
export function usePosBarcodeLookup({ businessId, context, enabled, onProduct, onMissing, onError, onFinished }: Options) {
  const actorId = useAuthStore(state => state.user?.id);
  const sessionVersion = useAuthStore(state => state.sessionVersion);
  const baseScope = JSON.stringify([actorId, sessionVersion, businessId, context]);
  const [identity, setIdentity] = useState({ key: baseScope, generation: 0 });
  if (identity.key !== baseScope) setIdentity({ key: baseScope, generation: identity.generation + 1 });
  const scope = JSON.stringify([baseScope, identity.generation]);
  const epoch = useRef(0);
  const current = useRef<{ scope: string; epoch: number } | null>(null);
  const lock = useRef<object | null>(null);
  const suspended = useRef(false);
  const allowed = useRef(enabled);
  const [pending, setPending] = useState<string | null>(null);
  useLayoutEffect(() => { allowed.current = enabled; }, [enabled]);
  useLayoutEffect(() => {
    const token = { scope, epoch: ++epoch.current };
    current.current = token; lock.current = null; suspended.current = false;
    return () => { if (current.current === token) { current.current = null; lock.current = null; } };
  }, [scope]);

  const scan = async (raw: string) => {
    if (!allowed.current || lock.current || suspended.current || !hasActiveSession(useAuthStore.getState()) || current.current?.scope !== scope) return;
    let code: string;
    try { code = barcodeValue(raw); } catch (error) { onError(error); return; }
    const token = current.current;
    const request = {};
    const isCurrent = () => current.current === token && useAuthStore.getState().user?.id === actorId
      && useAuthStore.getState().sessionVersion === sessionVersion && hasActiveSession(useAuthStore.getState());
    lock.current = request; setPending(scope);
    try {
      const product = await getProductByBarcode(businessId, code);
      if (!isCurrent()) return;
      if (!product || typeof product.id !== "string" || !product.id.trim() || product.business_id !== businessId || product.barcode !== code) throw new Error("invalid_barcode_response");
      onProduct(product);
    } catch (error) {
      if (!isCurrent()) return;
      if (axios.isAxiosError<{ message?: unknown }>(error) && error.response?.status === 404 && (getServerErrorCode(error) ?? error.response.data?.message) === "product:not_found") {
        suspended.current = true;
        onMissing(code, scope);
      }
      else onError(error);
    } finally {
      if (isCurrent() && lock.current === request) { lock.current = null; setPending(null); onFinished(); }
    }
  };
  const resume = () => { if (current.current?.scope === scope) suspended.current = false; };
  const isCurrent = () => current.current?.scope === scope && useAuthStore.getState().user?.id === actorId
    && useAuthStore.getState().sessionVersion === sessionVersion && hasActiveSession(useAuthStore.getState());
  return { busy: pending === scope, scan, scope, resume, isCurrent };
}
