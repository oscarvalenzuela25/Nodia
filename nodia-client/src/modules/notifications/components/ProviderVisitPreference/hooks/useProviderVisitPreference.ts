import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import { notifyHttpError } from "../../../../../config/httpFeedback";
import {
  readProviderVisitPreference,
  saveProviderVisitPreference,
  type NotificationActor,
} from "../../../infrastructure/services";

function isUnavailablePreference(error: unknown) {
  return isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0);
}

export function useProviderVisitPreference(actor: NotificationActor, businessId: string) {
  const client = useQueryClient();
  const { t } = useTranslation();
  const key = ["provider-visit-preference", actor, businessId];
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      try {
        return await readProviderVisitPreference(actor, businessId, signal);
      } catch (error) {
        // View-only global authority does not grant the personal preference.
        if (isUnavailablePreference(error)) return null;
        throw error;
      }
    },
  });
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => saveProviderVisitPreference(actor, businessId, enabled),
    onSuccess: (value) => {
      client.setQueryData(key, value);
      sileo.success({ title: t(value.enabled ? "notifications:business_enabled" : "notifications:business_disabled") });
    },
    onError: (error) => {
      notifyHttpError(error);
      if (isUnavailablePreference(error)) void client.invalidateQueries({ queryKey: key, exact: true });
    },
  });
  return { query, mutation };
}
