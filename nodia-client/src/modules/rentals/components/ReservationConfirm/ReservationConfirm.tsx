import { useState } from "react";
import { Alert, Button, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import type { RentalProperty, RentalReservation } from "../../types";
import {
  useRentalAvailability,
  useRentalBusy,
  useRentalMutation,
} from "../../infrastructure/useServices";
import RentalIntentReview from "../RentalIntentReview";
import SameDayReview from "../SameDayReview";
import { useBookingSubmit } from "../ReservationModal/hooks/useBookingSubmit";
import { ReviewContainer, ModalActions } from "./styles";
export type ReservationConfirmProps = {
  property: RentalProperty;
  reservation: RentalReservation;
  open: boolean;
  onClose: () => void;
  onOpenTurnover: (id: string) => void;
};
export default function ReservationConfirm({
  property,
  reservation,
  open,
  onClose,
  onOpenTurnover,
}: ReservationConfirmProps) {
  const { t } = useTranslation();
  const mutation = useRentalMutation(property.id);
  const commonBusy = useRentalBusy(property.id);
  const [selected, setSelected] = useState<string[]>([]);
  const [reference, setReference] = useState(
    reservation.external_reference ?? "",
  );
  const [description, setDescription] = useState("");
  const [approvalVersion, setApprovalVersion] = useState<string>();
  const availability = useRentalAvailability(
    property.id,
    {
      check_in_on: reservation.check_in_on,
      check_out_on: reservation.check_out_on,
      check_in_time: reservation.check_in_time,
      check_out_time: reservation.check_out_time,
      exclude_reservation_id: reservation.id,
    },
    open,
  );
  const requirements = availability.data?.turnover_requirements ?? [];
  const version = availability.data?.checked_at;
  const consent = approvalVersion === version ? selected : [];
  const platform = reservation.channel === "airbnb";
  const needsPlatform = platform && reservation.policy_snapshot === null;
  const directReady =
    platform ||
    (reservation.cancellation_policy_id !== null &&
      BigInt(reservation.deposit_amount) > 0n &&
      BigInt(reservation.received_amount) >=
        BigInt(reservation.deposit_amount));
  const allApproved = requirements
    .filter((r) => r.needs_approval)
    .every((r) => r.turnover_id !== null && consent.includes(r.turnover_id));
  const busy = commonBusy || mutation.isPending || mutation.isUncertain;
  const blocked =
    (platform && !reservation.external_reference?.trim()) ||
    busy ||
    !availability.data ||
    availability.isError ||
    availability.data.conflicts.length > 0 ||
    !allApproved ||
    !directReady ||
    (needsPlatform && (!reference.trim() || !description.trim())) ||
    !property.is_active ||
    !reservation.is_active;
  const submit = useBookingSubmit(
    async () => {
      const ack = await mutation.execute({
        operation: "reservation.confirm",
        id: reservation.id,
        data: {
          same_day_approvals: consent,
          ...(needsPlatform
            ? {
                platform_policy: {
                  reference: reference.trim(),
                  description: description.trim(),
                },
              }
            : {}),
        },
      });
      if (!ack) {
        setSelected([]);
        setApprovalVersion(undefined);
        void availability.refetch();
      }
      return ack;
    },
    () => onClose(),
  );
  const confirm = async () => {
    if (!blocked) await submit(undefined);
  };
  return (
    <BaseModal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      disableEscapeKeyDown={busy}
      title={t("rental:confirm_reservation")}
      size="lg"
      actions={
        <ModalActions>
          <Button disabled={busy} onClick={onClose}>
            {t("rental:close")}
          </Button>
          <Button disabled={blocked} variant="contained" onClick={confirm}>
            {t("rental:confirm_reservation")}
          </Button>
        </ModalActions>
      }
    >
      <ReviewContainer>
        {platform && !reservation.external_reference?.trim() && (
          <Alert severity="warning">
            {t("rental:airbnb_reference_required")}
          </Alert>
        )}
        <Alert severity="info">{t("rental:availability_not_hold")}</Alert>
        {!directReady && (
          <Alert severity="warning">
            {t("rental:direct_deposit_required")}
          </Alert>
        )}
        {availability.isError && (
          <Alert
            severity="error"
            action={
              <Button
                disabled={availability.isFetching}
                onClick={() => availability.refetch()}
              >
                {t("rental:retry")}
              </Button>
            }
          >
            {t("rental:load_error")}
          </Alert>
        )}
        <Skeleton loading={availability.isLoading}>
          <Typography>{t("rental:availability_review")}</Typography>
          {availability.data?.conflicts.map((conflict) => (
            <Alert
              severity="warning"
              key={`${conflict.resource_type}:${conflict.id}`}
            >
              {t("rental:occupancy_conflict", {
                type: t(`rental:resource_${conflict.resource_type}`),
                id: conflict.id,
              })}
            </Alert>
          ))}
        </Skeleton>
        <Button
          disabled={busy}
          onClick={() => {
            setSelected([]);
            setApprovalVersion(undefined);
            void availability.refetch();
          }}
        >
          {t("rental:refresh_availability")}
        </Button>
        <SameDayReview
          requirements={requirements}
          selected={consent}
          onChange={(ids) => {
            setApprovalVersion(version);
            setSelected(ids);
          }}
          onOpenTurnover={onOpenTurnover}
          disabled={busy}
        />
        {needsPlatform && (
          <>
            <TextInput
              label={t("rental:platform_reference")}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={busy}
            />
            <TextInput
              label={t("rental:platform_description")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
              multiline
            />
            <Alert severity="info">
              {t("rental:platform_manual_explanation")}
            </Alert>
          </>
        )}
        <RentalIntentReview mutation={mutation} onResolved={onClose} />
      </ReviewContainer>
    </BaseModal>
  );
}
