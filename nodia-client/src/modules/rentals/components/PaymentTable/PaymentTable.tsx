import { Skeleton } from "boneyard-js/react";
import { useState } from "react";
import { Alert, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import BaseModal from "../../../../components/BaseModal";
import type { RentalPayment, RentalProperty, RentalQuery } from "../../types";
import {
  useRentalBusy,
  useRentalList,
  useRentalRecord,
} from "../../infrastructure/useServices";
import { formatRentalAmount } from "../../utils/money";

import RentalTable from "../RentalTable";
import RentalFilters from "../RentalFilters";

import PaymentModal from "../PaymentModal";
import PaymentVoid from "../PaymentVoid";
import { DetailFields, FilterRow } from "./styles";
export type PaymentTableProps = {
  property: RentalProperty;
  reservationId?: string;
  onOpenReservation?: (id: string) => void;
};
function PaymentHistory({
  property,
  reservationId,
  onOpenReservation,
}: PaymentTableProps) {
  const { t, i18n } = useTranslation();
  const globalBusy = useRentalBusy(property.id);
  const [params, setParams] = useState<RentalQuery>({
    page: 1,
    limit: 10,
    ...(reservationId ? { reservation_id: reservationId } : {}),
  });
  const page = params.page ?? 1,
    limit = params.limit ?? 10,
    search = params.q?.reference_cont ?? "";
  const update = (changes: Partial<RentalQuery>) =>
    setParams((previous) => ({ ...previous, ...changes }));
  const [capture, setCapture] = useState<"payment" | "refund" | null>(null);
  const [voided, setVoided] = useState<RentalPayment | null>(null);
  const [detailId, setDetailId] = useState<string>();
  const list = useRentalList("payments", property.id, params);
  const busy = globalBusy || list.isFetching;
  const detail = useRentalRecord(
    "payments",
    property.id,
    detailId,
    Boolean(detailId),
  );
  return (
    <>
      <FilterRow>
        <RentalFilters
          resource="payments"
          property={property}
          query={params}
          onApply={setParams}
          disabled={busy}
        />
        <Button
          variant="outlined"
          disabled={busy}
          onClick={() => setCapture("refund")}
        >
          {t("rental:create_refund")}
        </Button>
      </FilterRow>
      <Typography sx={{ mb: 2 }} variant="body2" color="text.secondary">
        {t("rental:immutable_payment_hint")}
      </Typography>
      <RentalTable
        title={t("rental:tabs.payments")}
        rows={list.data?.data ?? []}
        columns={[
          {
            key: "date",
            label: t("rental:occurred_on"),
            render: (row) => row.occurred_on,
          },
          {
            key: "reservation",
            label: t("rental:reservation"),
            render: (row) => row.reservation_id,
          },
          {
            key: "type",
            label: t("rental:type"),
            render: (row) => t(`rental:${row.type}`),
          },
          {
            key: "amount",
            label: t("rental:amount"),
            render: (row) => formatRentalAmount(row.amount, i18n.language),
          },
          {
            key: "status",
            label: t("rental:status"),
            render: (row) => t(`rental:${row.status}`),
          },
          {
            key: "reference",
            label: t("rental:reference"),
            render: (row) => row.reference ?? "—",
          },
        ]}
        meta={list.data?.meta}
        page={page}
        limit={limit}
        onPageChange={(value) => update({ page: value })}
        onLimitChange={(value) => update({ page: 1, limit: value })}
        query={list}
        busy={globalBusy}
        search={search}
        onSearchChange={(value) =>
          update({ page: 1, q: value ? { reference_cont: value } : undefined })
        }
        onCreate={() => setCapture("payment")}
        actions={(row) => [
          {
            key: "detail",
            label: t("rental:detail"),
            onClick: () => setDetailId(row.id),
          },
          ...(onOpenReservation
            ? [
                {
                  key: "reservation",
                  label: t("rental:open_reservation"),
                  onClick: () => onOpenReservation(row.reservation_id),
                },
              ]
            : []),
          ...(row.status === "confirmed"
            ? [
                {
                  key: "void",
                  label: t("rental:void"),
                  onClick: () => setVoided(row),
                },
              ]
            : []),
        ]}
      />
      {capture && (
        <PaymentModal
          open
          property={property}
          reservationId={reservationId}
          initialType={capture}
          onClose={() => setCapture(null)}
        />
      )}{" "}
      {voided && (
        <PaymentVoid
          open
          property={property}
          payment={voided}
          onClose={() => setVoided(null)}
        />
      )}
      <BaseModal
        open={Boolean(detailId)}
        title={t("rental:detail")}
        onClose={() => setDetailId(undefined)}
      >
        <DetailFields>
          {detail.isError && (
            <Alert
              severity="error"
              action={
                <Button
                  disabled={detail.isFetching}
                  onClick={() => void detail.refetch()}
                >
                  {t("rental:retry")}
                </Button>
              }
            >
              {t("rental:load_error")}
            </Alert>
          )}
          <Skeleton loading={detail.isLoading}>
            {detail.data &&
              [
                "id",
                "reservation_id",
                "occurred_on",
                "method",
                "reference",
                "notes",
              ].map((key) => (
                <Typography key={key}>
                  {t(`rental:${key}`)}:{" "}
                  {String(detail.data[key as keyof RentalPayment] ?? "—")}
                </Typography>
              ))}
          </Skeleton>
        </DetailFields>
      </BaseModal>
    </>
  );
}
export default function PaymentTable(props: PaymentTableProps) {
  return (
    <PaymentHistory
      key={`${props.property.id}:${props.reservationId ?? "all"}`}
      {...props}
    />
  );
}
