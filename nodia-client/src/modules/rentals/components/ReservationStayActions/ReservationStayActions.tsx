import { useEffect, useState } from "react";
import { Alert, Button, LinearProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import type { RentalProperty, RentalReservation } from "../../types";
import {
  useRentalBusy,
  useRentalMutation,
  useRentalRecord,
} from "../../infrastructure/useServices";
import { formatRentalInstant } from "../../utils/dates";
import RentalIntentReview from "../RentalIntentReview";
import { useBookingSubmit } from "../ReservationModal/hooks/useBookingSubmit";
import { Information, StaySchedule } from "./styles";
export type ReservationStayActionsProps = {
  property: RentalProperty;
  reservation: RentalReservation;
  open: boolean;
  onClose: () => void;
  command: "start" | "complete";
};
export default function ReservationStayActions({
  property,
  reservation,
  open,
  onClose,
  command,
}: ReservationStayActionsProps) {
  const { t, i18n } = useTranslation();
  const starting = command === "start";
  const actionLabel = t(starting ? "rental:start_stay" : "rental:complete_stay");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const mutation = useRentalMutation(property.id);
  const commonBusy = useRentalBusy(property.id);
  const turnover = useRentalRecord(
    "turnovers",
    property.id,
    reservation.turnover_id ?? undefined,
    open && starting,
  );
  const ready =
    turnover.data?.linen_ready === true &&
    turnover.data.cleaning_status === "completed" &&
    !!turnover.data.ready_at &&
    Date.parse(turnover.data.ready_at) <= now;
  const expired =
    starting && Date.parse(reservation.check_out_at) <= now;
  const busy = commonBusy || mutation.isPending || mutation.isUncertain;
  const scheduledAt = starting ? reservation.check_in_at : reservation.check_out_at;
  const tooEarly = Date.parse(scheduledAt) > now;
  const disabled =
    busy ||
    tooEarly ||
    (starting && (!ready || expired || turnover.isError || turnover.isFetching));
  const submit = useBookingSubmit(
    () =>
      mutation.execute({
        operation:
          starting ? "reservation.start" : "reservation.complete",
        id: reservation.id,
        data: {},
      }),
    () => onClose(),
  );
  return (
    <ConfirmDialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      onConfirm={() => {
        if (!disabled) return submit(undefined);
      }}
      isLoading={busy}
      confirmDisabled={disabled}
      disableEscapeKeyDown={busy}
      title={actionLabel}
      confirmText={actionLabel}
      message={t("rental:reservation_action_context", {
        guest: reservation.guest_name,
        property: property.name,
      })}
    >
      <Information>
        <StaySchedule>
          <dt>{t(starting ? "rental:check_in_on" : "rental:check_out_on")}</dt>
          <dd>{formatRentalInstant(scheduledAt, property.timezone, i18n.language)}</dd>
          <dd>{property.timezone}</dd>
        </StaySchedule>
        <Typography variant="body2" color="text.secondary">
          {t(starting ? "rental:start_requirements" : "rental:complete_requirements")}
        </Typography>
        {tooEarly && (
          <Alert severity="info">{t("rental:stay_action_too_early")}</Alert>
        )}
        {expired && (
          <Alert severity="warning">{t("rental:expired_unstarted_stay")}</Alert>
        )}
        {starting && turnover.isFetching && (
          <LinearProgress aria-label={t("rental:preparation_checking")} />
        )}
        {starting && !ready && !turnover.isLoading && !turnover.isError && (
          <Alert severity="warning">
            {t("rental:actual_preparation_required")}
          </Alert>
        )}
        {turnover.isError && (
          <Alert
            severity="error"
            action={
              <Button disabled={busy} onClick={() => void turnover.refetch()}>
                {t("rental:retry")}
              </Button>
            }
          >
            {t("rental:load_error")}
          </Alert>
        )}
        <RentalIntentReview mutation={mutation} onResolved={onClose} />
      </Information>
    </ConfirmDialog>
  );
}
