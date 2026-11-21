import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import { claimHttpErrorNotification, getHttpErrorMessage } from "../../../../../config/httpFeedback";
import { getServerErrorCode } from "../../../../../config/axiosInstance";
import { activatePushDevice, deactivatePushDevice } from "../../../infrastructure/pushInstallation";
import { isPushStorageChange } from "../../../infrastructure/pushOwnership";
import type { NotificationActor } from "../../../infrastructure/services";
import { pushDeviceQueryOptions } from "../../../infrastructure/useServices";

export function usePushDevice(actor: NotificationActor) {
  const { i18n, t } = useTranslation();
  const client = useQueryClient();
  const queryOptions = pushDeviceQueryOptions(actor, i18n.resolvedLanguage ?? i18n.language);
  const query = useQuery(queryOptions);
  const [changing, setChanging] = useState(false);
  const changingRef = useRef(false);
  const refetch = query.refetch;

  useEffect(() => {
    const refresh = () => {
      if (!changingRef.current) void refetch({ cancelRefetch: false });
    };
    const onStorage = (event: StorageEvent) => {
      if (isPushStorageChange(event.key)) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [refetch]);

  async function change(enable: boolean) {
    if (changingRef.current) return;
    const device = query.data;
    if (!device || (enable && !("activation" in device))) return;
    changingRef.current = true;
    setChanging(true);
    try {
      if (enable && "activation" in device) await activatePushDevice(actor, device.activation);
      else await deactivatePushDevice(actor);
      sileo.success({ title: t(enable ? "notifications:device_enabled" : "notifications:device_disabled") });
    } catch (error) {
      if (claimHttpErrorNotification(error)) {
        const code = getServerErrorCode(error);
        let description = getHttpErrorMessage(error);
        if (code?.startsWith("visit_notifications:")) {
          const key = `notifications:${code.split(":")[1]}`;
          if (i18n.exists(key)) description = t(key);
        } else if (enable && typeof Notification !== "undefined" && Notification.permission === "denied") {
          description = t("notifications:device_denied");
        } else if (enable && error instanceof DOMException && error.name === "NotAllowedError") {
          description = t("notifications:permission_required");
        }
        sileo.error({ title: t(enable ? "notifications:activation_error" : "notifications:deactivation_error"), description });
      }
    } finally {
      await client.invalidateQueries({ queryKey: queryOptions.queryKey, exact: true });
      changingRef.current = false;
      setChanging(false);
    }
  }

  return { query, change, changing };
}
