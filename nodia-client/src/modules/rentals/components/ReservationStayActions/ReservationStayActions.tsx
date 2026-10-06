import { useEffect, useState } from "react";
import { Alert, Button, Typography } from "@mui/material";
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
import { Information } from "./styles";
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
    open && command === "start",
  );
  const ready =
    turnover.data?.linen_ready === true &&
    turnover.data.cleaning_status === "completed" &&
    !!turnover.data.ready_at &&
    Date.parse(turnover.data.ready_at) <= now;
  const expired =
    command === "start" && Date.parse(reservation.check_out_at) <= now;
  const busy = commonBusy || mutation.isPending || mutation.isUncertain;
  const tooEarly =
    Date.parse(
      command === "start" ? reservation.check_in_at : reservation.check_out_at,
    ) > now;
  const disabled =
    busy ||
    tooEarly ||
    (command === "start" && (!ready || expired || turnover.isError));
  const submit = useBookingSubmit(
    () =>
      mutation.execute({
        operation:
          command === "start" ? "reservation.start" : "reservation.complete",
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
      title={t(
        command === "start" ? "rental:start_stay" : "rental:complete_stay",
      )}
    >
      <Information>
        <Typography>
          {formatRentalInstant(
            command === "start"
              ? reservation.check_in_at
              : reservation.check_out_at,
            property.timezone,
            i18n.language,
          )}
        </Typography>
        <Alert severity="info">
          {t(
            command === "start"
              ? "rental:start_requirements"
              : "rental:complete_requirements",
          )}
        </Alert>
        {expired && (
          <Alert severity="warning">{t("rental:expired_unstarted_stay")}</Alert>
        )}
        {command === "start" && !ready && (
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
