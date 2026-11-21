import { queryOptions } from "@tanstack/react-query";
import { inspectPushDevice } from "./pushInstallation";
import type { NotificationActor } from "./services";

export function pushDeviceQueryOptions(actor: NotificationActor, locale: string) {
  return queryOptions({
    queryKey: ["push-device", actor, locale],
    queryFn: ({ signal }) => inspectPushDevice(actor, locale, signal),
    // This is device-local state. Never reuse it as authority after an account change.
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
}
