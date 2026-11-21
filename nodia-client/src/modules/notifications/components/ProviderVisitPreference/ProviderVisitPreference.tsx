import { useId } from "react";
import { Alert, Box, Button, FormControlLabel, Switch, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import useAuthStore, { hasValidatedSession } from "../../../../store/authStore";
import type { NotificationActor } from "../../infrastructure/services";
import { useProviderVisitPreference } from "./hooks/useProviderVisitPreference";
import { PreferencePanel } from "./styles";

function PreferenceControl({ actor, businessId }: { actor: NotificationActor; businessId: string }) {
  const { t } = useTranslation();
  const descriptionId = useId();
  const { query, mutation } = useProviderVisitPreference(actor, businessId);
  if (query.data === null) return null;
  const busy = query.isFetching || mutation.isPending;
  return (
    <PreferencePanel aria-busy={busy}>
      {query.isError ? (
        <Alert severity="error" action={<Button disabled={busy} onClick={() => void query.refetch()}>
          {t("notifications:retry")}
        </Button>}>
          {t("notifications:business_error")}
        </Alert>
      ) : (
        <>
          <Skeleton loading={query.isLoading} fallback={<Box aria-hidden="true" sx={{ height: 24, width: "75%", borderRadius: 1, bgcolor: "action.hover" }} />}>
            <Typography id={descriptionId} color="text.secondary" variant="body2">
              {t("notifications:business_help")}
            </Typography>
          </Skeleton>
          <FormControlLabel
            label={t("notifications:business_label")}
            labelPlacement="start"
            control={<Switch
              color="success"
              checked={query.data?.enabled ?? false}
              disabled={busy || !query.data}
              onChange={(_, checked) => mutation.mutate(checked)}
              slotProps={{ input: { role: "switch", "aria-describedby": descriptionId } }}
            />}
          />
        </>
      )}
    </PreferencePanel>
  );
}

export default function ProviderVisitPreference({ businessId }: { businessId: string }) {
  const userId = useAuthStore((state) => state.user?.id);
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  const valid = useAuthStore(hasValidatedSession);
  if (!valid || !userId || !businessId) return null;
  return <PreferenceControl actor={{ userId, sessionVersion }} businessId={businessId} />;
}
