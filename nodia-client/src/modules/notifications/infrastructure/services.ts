import { CanceledError } from "axios";
import { mainInstance } from "../../../config/api";
import { apiPath } from "../../../config/apiPath";
import useAuthStore, { hasValidatedSession } from "../../../store/authStore";

export type NotificationActor = { userId: string; sessionVersion: number };

type PushConfig = { enabled: boolean; public_key: string | null; key_id: string | null };
export type InstallationStatus = {
  installation_id: string;
  state: "unregistered" | "active" | "revoked" | "expired";
  revision: number;
  updated_at: string | null;
};

export function assertNotificationActor(actor: NotificationActor) {
  const session = useAuthStore.getState();
  if (session.user?.id !== actor.userId || session.sessionVersion !== actor.sessionVersion ||
      !hasValidatedSession(session)) {
    throw new CanceledError("Notification session changed");
  }
}

const installationPath = (installationId: string) =>
  apiPath(`/notifications/web-push/installations/${encodeURIComponent(installationId)}`);
const preferencePath = (businessId: string) =>
  apiPath(`/businesses/${encodeURIComponent(businessId)}/notification-preferences/provider-visits`);

function scopedRequest(actor: NotificationActor, signal?: AbortSignal) {
  assertNotificationActor(actor);
  // Axios schedules its authentication interceptor after this caller returns.
  return { expectedAuthSessionVersion: actor.sessionVersion, signal };
}

export async function readPushConfig(actor: NotificationActor, signal?: AbortSignal) {
  return (await mainInstance.get<PushConfig>(
    apiPath("/notifications/web-push/config"), scopedRequest(actor, signal),
  )).data;
}

export async function readInstallation(
  actor: NotificationActor,
  installationId: string,
  signal?: AbortSignal,
) {
  return (await mainInstance.get<InstallationStatus>(installationPath(installationId), scopedRequest(actor, signal))).data;
}

export async function registerInstallation(
  actor: NotificationActor,
  status: InstallationStatus,
  keyId: string,
  subscription: PushSubscription,
) {
  const { endpoint, expirationTime, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error("Incomplete PushSubscription");
  return (await mainInstance.put<InstallationStatus>(installationPath(status.installation_id), {
    expected_revision: status.revision,
    key_id: keyId,
    subscription: { endpoint, expirationTime, keys: { p256dh: keys.p256dh, auth: keys.auth } },
  }, scopedRequest(actor))).data;
}

export async function revokeInstallation(actor: NotificationActor, status: InstallationStatus) {
  return (await mainInstance.delete<InstallationStatus>(installationPath(status.installation_id), {
    ...scopedRequest(actor),
    params: { expected_revision: status.revision },
  })).data;
}

export async function readProviderVisitPreference(actor: NotificationActor, businessId: string, signal: AbortSignal) {
  return (await mainInstance.get<{ enabled: boolean }>(preferencePath(businessId), scopedRequest(actor, signal))).data;
}

export async function saveProviderVisitPreference(actor: NotificationActor, businessId: string, enabled: boolean) {
  return (await mainInstance.put<{ enabled: boolean }>(preferencePath(businessId), { enabled }, scopedRequest(actor))).data;
}
