import { useState } from "react";
import { Alert, Button, LinearProgress, Typography } from "@mui/material";
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
import { formatRentalInstant } from "../../utils/dates";
import { formatRentalAmount } from "../../utils/money";
import RentalIntentReview from "../RentalIntentReview";
import SameDayReview from "../SameDayReview";
import { useBookingSubmit } from "../ReservationModal/hooks/useBookingSubmit";
import {
  ModalActions,
  ReviewContainer,
  ReviewFacts,
  ReviewHeader,
  ReviewPanel,
  ReviewSkeleton,
} from "./styles";
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
  const { t, i18n } = useTranslation();
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
  const review = availability.isPlaceholderData ? undefined : availability.data;
  const requirements = review?.turnover_requirements ?? [];
  const version = review?.checked_at;
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
  const busy =
    commonBusy || availability.isFetching || mutation.isPending || mutation.isUncertain;
  const blocked =
    (platform && !reservation.external_reference?.trim()) ||
    busy ||
    !review ||
    availability.isError ||
    review.conflicts.length > 0 ||
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
  const refresh = () => {
    setSelected([]);
    setApprovalVersion(undefined);
    void availability.refetch();
  };
  const formatInstant = (instant: string) =>
    formatRentalInstant(instant, property.timezone, i18n.language);
  const formatAmount = (amount: string) =>
    formatRentalAmount(amount, i18n.language);
  return (
    <BaseModal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      disableEscapeKeyDown={busy}
      title={t("rental:confirm_reservation")}
      subtitle={t("rental:reservation_action_context", {
        guest: reservation.guest_name,
        property: property.name,
      })}
      size="lg"
      actions={
        <ModalActions>
          <Button variant="outlined" color="inherit" disabled={busy} onClick={onClose}>
            {t("rental:close")}
          </Button>
          <Button
            disabled={blocked}
            loading={mutation.isPending}
            variant="contained"
            onClick={confirm}
          >
            {t("rental:confirm_reservation")}
          </Button>
        </ModalActions>
      }
    >
      <ReviewContainer>
        <ReviewPanel>
          <ReviewFacts>
            <div>
              <dt>{t("rental:check_in_on")}</dt>
              <dd>{formatInstant(reservation.check_in_at)}</dd>
            </div>
            <div>
              <dt>{t("rental:check_out_on")}</dt>
              <dd>{formatInstant(reservation.check_out_at)}</dd>
            </div>
          </ReviewFacts>
          <Typography variant="body2" color="text.secondary">
            {t("rental:nights_count", { count: reservation.nights })} · {property.timezone}
          </Typography>
        </ReviewPanel>
        {platform && !reservation.external_reference?.trim() && (
          <Alert severity="warning">
            {t("rental:airbnb_reference_required")}
          </Alert>
        )}
        {!platform && (
          <ReviewPanel>
            <ReviewFacts>
              <div>
                <dt>{t("rental:deposit_amount")}</dt>
                <dd>{formatAmount(reservation.deposit_amount)}</dd>
              </div>
              <div>
                <dt>{t("rental:received_amount")}</dt>
                <dd>{formatAmount(reservation.received_amount)}</dd>
              </div>
            </ReviewFacts>
            {!directReady && (
              <Alert severity="warning">{t("rental:direct_deposit_required")}</Alert>
            )}
          </ReviewPanel>
        )}
        <ReviewPanel>
          <ReviewHeader>
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
              {t("rental:availability_review")}
            </Typography>
            <Button variant="outlined" disabled={busy} onClick={refresh}>
              {t(availability.isError ? "rental:retry" : "rental:refresh_availability")}
            </Button>
          </ReviewHeader>
          <Typography variant="body2" color="text.secondary">
            {t("rental:availability_not_hold")}
          </Typography>
          {availability.isFetching && !availability.isLoading && (
            <LinearProgress aria-label={t("rental:availability_checking")} />
          )}
          {availability.isLoading && (
            <Typography role="status" variant="body2">
              {t("rental:availability_checking")}
            </Typography>
          )}
          {availability.isError && (
            <Alert severity="error">{t("rental:load_error")}</Alert>
          )}
          <Skeleton loading={availability.isLoading && !review}>
            {availability.isLoading && !review && <ReviewSkeleton aria-hidden />}
            {review && !availability.isError && (
              <>
                {review.conflicts.length === 0 && (
                  <Alert severity="success" role="status">
                    {t("rental:availability_no_conflicts")}
                  </Alert>
                )}
                {review.conflicts.map((conflict) => (
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
              </>
            )}
          </Skeleton>
          {review && !availability.isError && (
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
          )}
        </ReviewPanel>
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
