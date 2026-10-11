import {
  Alert,
  Button,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Typography,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import type { RentalProperty } from "../../types";
import {
  useRentalBusy,
  useRentalRecord,
} from "../../infrastructure/useServices";
import { formatRentalAmount } from "../../utils/money";
import { PreviewHeader, PreviewStack, AmountRow } from "./styles";
type Props = {
  property: RentalProperty;
  id: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onPayment?: (id: string) => void;
  onTurnover: (id: string) => void;
};
export default function ReservationPreview({
  property,
  id,
  onClose,
  onOpen,
  onPayment,
  onTurnover,
}: Props) {
  const { t, i18n } = useTranslation();
  const query = useRentalRecord("reservations", property.id, id);
  const busy = useRentalBusy(property.id) || query.isFetching;
  const row = query.data;
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const focused = useRef(false);
  useEffect(() => {
    if (!busy && !focused.current) {
      closeButton.current?.focus();
      focused.current = true;
    }
  }, [busy]);
  return (
    <PreviewStack>
      <PreviewHeader>
        <Typography variant="overline">
          {t("rental:reservation_detail")}
        </Typography>
        <IconButton
          ref={closeButton}
          disabled={busy}
          onClick={onClose}
          aria-label={t("rental:close")}
        >
          <CloseOutlined />
        </IconButton>
      </PreviewHeader>
      {query.isFetching && !query.isLoading && (
        <LinearProgress sx={{ height: 2 }} />
      )}
      {query.isError && (
        <Alert
          severity="error"
          action={
            <Button disabled={busy} onClick={() => query.refetch()}>
              {t("rental:retry")}
            </Button>
          }
        >
          {t("rental:load_error")}
        </Alert>
      )}
      <Skeleton loading={query.isLoading}>
        <PreviewStack>
          {row && (
            <>
              <Typography variant="h5" sx={{ overflowWrap: "anywhere" }}>
                {row.guest_name}
              </Typography>
              <Chip
                sx={{ alignSelf: "start" }}
                label={t(`rental:status_${row.status}`)}
              />
              <Typography color="text.secondary">
                {t(`rental:channel_${row.channel}`)} ·{" "}
                {t("rental:guests_count")}: {row.guests_count}
              </Typography>
              <Divider />
              <Typography variant="body2">{t("rental:check_in_on")}</Typography>
              <Typography sx={{ fontWeight: 700 }}>
                {row.check_in_on} · {row.check_in_time}
              </Typography>
              <Typography variant="body2">
                {t("rental:check_out_on")}
              </Typography>
              <Typography sx={{ fontWeight: 700 }}>
                {row.check_out_on} · {row.check_out_time}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("rental:nights_count", { count: row.nights })} ·{" "}
                {property.timezone}
              </Typography>
              <Divider />
              {(
                [
                  "expected_amount",
                  "received_amount",
                  "balance_due_amount",
                  "refund_due_amount",
                ] as const
              ).map((field) => (
                <AmountRow key={field}>
                  <Typography variant="body2">
                    {t(`rental:${field}`)}
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>
                    {formatRentalAmount(row[field], i18n.language)}
                  </Typography>
                </AmountRow>
              ))}
              <Button
                fullWidth
                variant="contained"
                disabled={busy || query.isError}
                onClick={() => onOpen(id)}
              >
                {t("rental:calendar_full_detail")}
              </Button>
              {onPayment && (
                <Button
                  fullWidth
                  variant="outlined"
                  disabled={
                    busy ||
                    query.isError ||
                    BigInt(row.balance_due_amount) <= 0n ||
                    row.status === "cancelled"
                  }
                  onClick={() => onPayment(id)}
                >
                  {t("rental:calendar_register_payment")}
                </Button>
              )}
              {row.turnover_id && (
                <Button
                  fullWidth
                  disabled={busy || query.isError}
                  onClick={() => onTurnover(row.turnover_id!)}
                >
                  {t("rental:preparation")}
                </Button>
              )}
            </>
          )}
          {!row && !query.isLoading && !query.isError && (
            <Alert severity="info">{t("rental:not_found")}</Alert>
          )}
        </PreviewStack>
      </Skeleton>
    </PreviewStack>
  );
}
