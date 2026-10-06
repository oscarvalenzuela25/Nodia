import { isAxiosError } from "axios";
import { getServerErrorCode } from "../../../config/axiosInstance";
import useAuthStore from "../../../store/authStore";
import type { RentalCommand } from "../types";
import { RentalClientValidationError } from "./services";

export type RentalIntent = {
  key: string;
  actorId: string;
  sessionVersion: number;
  propertyId?: string;
  command: RentalCommand;
  phase: "sending" | "uncertain" | "recovering";
};
const pending = new Map<string, RentalIntent>();
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((listener) => listener());
}
export const subscribeRentalIntents = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function rentalPendingCount(
  actorId?: string,
  propertyId?: string,
): number {
  return [...pending.values()].filter(
    (intent) =>
      intent.actorId === actorId &&
      (propertyId === undefined || intent.propertyId === propertyId),
  ).length;
}
export function setRentalIntent(intent: RentalIntent) {
  pending.set(intent.key, intent);
  emit();
}
export function removeRentalIntent(key: string) {
  pending.delete(key);
  emit();
}
export function clearRentalIntents() {
  pending.clear();
  emit();
}
useAuthStore.subscribe((state, previous) => {
  if (
    state.user?.id !== previous.user?.id ||
    state.sessionVersion !== previous.sessionVersion ||
    state.sessionStatus === "anonymous"
  )
    clearRentalIntents();
});
export function rentalIntentSessionValid(intent: RentalIntent): boolean {
  const actor = useAuthStore.getState();
  return (
    actor.user?.id === intent.actorId &&
    actor.sessionVersion === intent.sessionVersion &&
    actor.sessionStatus === "authenticated"
  );
}
export function rentalRequestKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
/** Only documented pre-commit rejections authorize a fresh edited intention. */
export function isRentalWriteUncertain(error: unknown): boolean {
  if (error instanceof RentalClientValidationError) return false;
  if (!isAxiosError(error)) return true;
  const status = error.response?.status;
  if (status === undefined) return true;
  const code: unknown =
    getServerErrorCode(error) ?? error.response?.data?.message;
  if (status === 409 && code === "rental:idempotency_conflict") return true;
  return ![400, 401, 403, 404, 409, 413, 429].includes(status);
}
