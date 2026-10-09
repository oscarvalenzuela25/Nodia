import { useEffect, useState } from "react";
import { useBlocker, useSearchParams } from "react-router";
import { Alert, Button, LinearProgress, Typography } from "@mui/material";
import HolidayVillageOutlined from "@mui/icons-material/HolidayVillageOutlined";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import useAuthStore from "../../../../store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  rentalKeys,
  useRentalBusy,
  useRentalPendingCount,
  useRentalProperty,
} from "../../infrastructure/useServices";
import { idSchema } from "../../infrastructure/schemas";
import PropertyModal from "../../components/PropertyModal";
import RentalPropertySelect from "../../components/RentalPropertySelect";
import RentalWorkspace from "../../components/RentalWorkspace";
import { PageHeader, PageStack, PageTitle } from "./styles";

export default function RentalReservations() {
  const actor = useAuthStore(
    (state) => `${state.user?.id}:${state.sessionVersion}`,
  );
  return <RentalPage key={actor} />;
}
function RentalPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const rawId = params.get("property");
  const propertyId = idSchema.safeParse(rawId).success ? rawId! : undefined;
  const property = useRentalProperty(propertyId);
  const busy = useRentalBusy();
  const pending = useRentalPendingCount();
  const accessRejected =
    property.isError &&
    isAxiosError(property.error) &&
    [401, 403, 404].includes(property.error.response?.status ?? 0);
  const [creating, setCreating] = useState(false);
  const client = useQueryClient();
  const actorId = useAuthStore((state) => state.user?.id);
  const blocker = useBlocker(pending > 0);
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);
  useEffect(() => {
    if (blocker.state === "blocked" && !pending) blocker.proceed();
  }, [blocker, pending]);
  const select = (id: string | null) => {
    if (busy || pending) return;
    if (propertyId)
      void client.cancelQueries({
        queryKey: rentalKeys.scope(actorId, propertyId),
      });
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (id) next.set("property", id);
      else next.delete("property");
      next.delete("reservation");
      return next;
    });
  };
  return (
    <PageStack>
      <PageHeader>
        <PageTitle variant="h1">
          <HolidayVillageOutlined color="primary" />
          {t("rental:title")}
        </PageTitle>
        <Typography color="text.secondary">{t("rental:subtitle")}</Typography>
      </PageHeader>
      <RentalPropertySelect
        value={propertyId ?? null}
        label={property.data?.name}
        onChange={select}
        onCreate={() => setCreating(true)}
        disabled={busy || creating}
      />
      {pending > 0 && (
        <Alert severity="warning">{t("rental:pending_navigation")}</Alert>
      )}
      {blocker.state === "blocked" && (
        <Alert
          severity="warning"
          action={
            <Button onClick={() => blocker.reset()}>{t("rental:close")}</Button>
          }
        >
          {t("rental:pending_navigation")}
        </Alert>
      )}
      {rawId && !propertyId && (
        <Alert severity="warning">{t("rental:invalid_input")}</Alert>
      )}
      {property.isError && (
        <Alert
          severity="error"
          action={
            <Button
              disabled={property.isFetching}
              onClick={() => void property.refetch()}
            >
              {t("rental:retry")}
            </Button>
          }
        >
          {t(
            accessRejected
              ? "rental:property_inaccessible"
              : "rental:load_error",
          )}
        </Alert>
      )}
      {property.isFetching && !property.isLoading && <LinearProgress />}
      <Skeleton loading={property.isLoading}>
        {property.data && (!accessRejected || pending > 0) ? (
          <RentalWorkspace
            key={property.data.id}
            property={property.data}
            accessible={!accessRejected && !creating}
          />
        ) : (
          <Typography color="text.secondary">
            {t("rental:select_property_help")}
          </Typography>
        )}
      </Skeleton>
      {creating && (
        <PropertyModal
          open
          onClose={() => setCreating(false)}
          onSaved={(ack) => {
            setCreating(false);
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              next.set("property", ack.resource_id);
              next.set("tab", "configuration");
              return next;
            });
          }}
        />
      )}
    </PageStack>
  );
}
