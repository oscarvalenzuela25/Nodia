import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import BusinessOutlined from "@mui/icons-material/BusinessOutlined";
import NotificationsOutlined from "@mui/icons-material/NotificationsOutlined";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import useAuthStore, { hasValidatedSession } from "../../../../store/authStore";
import { useCanAccessModule } from "../../../../store/generalSettings/useGeneralSettings";
import { PageSubtitle, PageTitle, PageTitleContainer } from "../../../generalSettings/styles";
import type { NotificationActor } from "../../infrastructure/services";
import { usePushDevice } from "./hooks/usePushDevice";
import { DeviceActions, SectionCard, SectionHeading, SettingsLayout, StatusChip } from "./styles";

function DeviceSettings({ actor }: { actor: NotificationActor }) {
  const { t } = useTranslation();
  const { query, change, changing } = usePushDevice(actor);
  const device = query.data;
  const state = device?.state;
  const busy = query.isFetching || changing;
  const canActivate = state === "ready" || state === "reactivate";
  const canDeactivate = state === "active" || state === "pending" || device?.canDeactivate;
  return (
    <SectionCard aria-labelledby="notification-device" aria-busy={busy}>
      <SectionHeading>
        <NotificationsOutlined aria-hidden="true" />
        <Typography component="h2" variant="h6" id="notification-device">
          {t("notifications:device_title")}
        </Typography>
        {state && <StatusChip
          size="small"
          variant="outlined"
          color={state === "active" ? "success" : state === "pending" || state === "reactivate" ? "warning" : "default"}
          label={t(`notifications:status_${state}`)}
        />}
      </SectionHeading>
      <Skeleton loading={query.isLoading} fallback={<Box aria-hidden="true" sx={{ height: 28, width: "75%", borderRadius: 1, bgcolor: "action.hover" }} />}>
        <Box role="status">
          {state && <Typography color="text.secondary">{t(`notifications:device_${state}`)}</Typography>}
        </Box>
      </Skeleton>
      {query.isError && <Alert severity="error">{t("notifications:device_error")}</Alert>}
      <DeviceActions>
        {(canActivate || query.isLoading) && <Button
          variant="contained"
          disabled={busy || !canActivate || query.isError}
          onClick={() => void change(true)}
        >{t(`notifications:${state === "reactivate" ? "reactivate" : "activate"}`)}</Button>}
        {canDeactivate && <Button
          variant="outlined"
          disabled={busy || query.isError}
          onClick={() => void change(false)}
        >{t(`notifications:${state === "pending" ? "retry_revocation" : "deactivate"}`)}</Button>}
        {(query.isError || state === "denied" || state === "unavailable") && <Button
          variant={canDeactivate ? "text" : "outlined"}
          disabled={busy}
          onClick={() => void query.refetch()}
        >{t(`notifications:${query.isError ? "retry" : "check_again"}`)}</Button>}
      </DeviceActions>
    </SectionCard>
  );
}

export default function NotificationSettings() {
  const { t } = useTranslation();
  const userId = useAuthStore((state) => state.user?.id);
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  const valid = useAuthStore(hasValidatedSession);
  const canAccessBusiness = useCanAccessModule("/business");
  return (
    <SettingsLayout>
      <Stack component="header" sx={{ gap: 1 }}>
        <PageTitleContainer><PageTitle>{t("notifications:title")}</PageTitle></PageTitleContainer>
        <PageSubtitle>{t("notifications:subtitle")}</PageSubtitle>
      </Stack>
      {valid && userId && <DeviceSettings key={`${userId}:${sessionVersion}`} actor={{ userId, sessionVersion }} />}
      {canAccessBusiness && <SectionCard aria-labelledby="notification-business">
        <SectionHeading>
          <BusinessOutlined aria-hidden="true" />
          <Typography component="h2" variant="h6" id="notification-business">
            {t("notifications:business_title")}
          </Typography>
        </SectionHeading>
        <Typography color="text.secondary">{t("notifications:business_settings_help")}</Typography>
        <DeviceActions>
          <Button component={Link} to="/business" variant="text">{t("notifications:open_businesses")}</Button>
        </DeviceActions>
      </SectionCard>}
    </SettingsLayout>
  );
}
