import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Typography,
} from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import type { RentalProperty } from "../../types";
import {
  useRentalCalendar,
  useRentalBusy,
} from "../../infrastructure/useServices";
import {
  addCivilDays,
  countNights,
  todayInZone,
  formatRentalInstant,
  toLocalDateTime,
} from "../../utils/dates";
import { occupiesCivilNight } from "./calendar";
import { CalendarGrid, DayPanel, Toolbar, Wrapper, Agenda } from "./styles";
export type RentalCalendarProps = {
  property: RentalProperty;
  onOpenReservation: (id: string) => void;
  onOpenTurnover: (id: string) => void;
  onManageBlocks: () => void;
};

function monthAfter(on: string, offset: number) {
  const [y, m] = on.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 10);
}
export default function RentalCalendar({
  property,
  onOpenReservation,
  onOpenTurnover,
  onManageBlocks,
}: RentalCalendarProps) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<"month" | "week">("month");
  const [from, setFrom] = useState(
    () => `${todayInZone(property.timezone).slice(0, 7)}-01`,
  );
  const [agenda, setAgenda] = useState(false);
  const [nonOccupying, setNonOccupying] = useState(false);
  const to = mode === "month" ? monthAfter(from, 1) : addCivilDays(from, 7);
  const days = Array.from({ length: countNights(from, to) }, (_, index) =>
    addCivilDays(from, index),
  );
  const query = useRentalCalendar(property.id, {
    from_on: from,
    to_on: to,
    include_non_occupying: nonOccupying,
  });
  const busy = useRentalBusy(property.id);
  const data = query.data;
  const navigate = (direction: number) =>
    setFrom(
      mode === "month"
        ? monthAfter(from, direction)
        : addCivilDays(from, direction * 7),
    );
  const reservationButton = (
    r: NonNullable<typeof data>["reservations"][number],
  ) => (
    <Button key={r.id} disabled={busy} onClick={() => onOpenReservation(r.id)}>
      {r.guest_name} · {t(`rental:status_${r.status}`)} · {r.check_in_on}{" "}
      {r.check_in_time} → {r.check_out_on} {r.check_out_time}
      {!r.is_active ? ` · ${t("rental:inactive")}` : ""}
    </Button>
  );
  return (
    <Wrapper>
      <Toolbar>
        <Button disabled={busy} onClick={() => navigate(-1)}>
          {t("rental:previous_window")}
        </Button>
        <Typography>
          {from} → {to} · {property.timezone}
        </Typography>
        <Button disabled={busy} onClick={() => navigate(1)}>
          {t("rental:next_window")}
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            setMode(mode === "month" ? "week" : "month");
            setFrom(mode === "week" ? `${from.slice(0, 7)}-01` : from);
          }}
        >
          {t(mode === "month" ? "rental:show_week" : "rental:show_month")}
        </Button>
        <Button disabled={busy} onClick={() => setAgenda(!agenda)}>
          {t(agenda ? "rental:show_calendar" : "rental:show_agenda")}
        </Button>
        <Button disabled={busy} onClick={onManageBlocks}>
          {t("rental:manage_blocks")}
        </Button>
      </Toolbar>
      <FormControlLabel
        label={t("rental:include_non_occupying")}
        control={
          <Checkbox
            disabled={busy}
            checked={nonOccupying}
            onChange={(_, checked) => setNonOccupying(checked)}
          />
        }
      />
      <Alert severity="info">{t("rental:calendar_legend")}</Alert>
      {query.isFetching && !query.isLoading && <LinearProgress />}
      {query.isError && (
        <Alert
          severity="error"
          action={
            <Button disabled={query.isFetching} onClick={() => query.refetch()}>
              {t("rental:retry")}
            </Button>
          }
        >
          {t("rental:calendar_window_error")}
          <Button disabled={query.isFetching} onClick={() => setMode("week")}>
            {t("rental:reduce_window")}
          </Button>
        </Alert>
      )}
      <Skeleton loading={query.isLoading}>
        <>
          {data &&
            data.reservations.length +
              data.blocks.length +
              data.turnovers.length ===
              0 && <Typography>{t("rental:empty_calendar")}</Typography>}
          {!agenda && (
            <CalendarGrid>
              {days.map((day) => (
                <DayPanel key={day}>
                  <Typography component="h3" variant="subtitle2">
                    {day}
                  </Typography>
                  {data?.reservations
                    .filter((r) =>
                      occupiesCivilNight(r.check_in_on, r.check_out_on, day),
                    )
                    .map(reservationButton)}
                  {data?.blocks
                    .filter((block) => {
                      const start = toLocalDateTime(
                        block.starts_at,
                        property.timezone,
                      );
                      const end = toLocalDateTime(
                        block.ends_at,
                        property.timezone,
                      );
                      return (
                        start.slice(0, 10) <= day &&
                        (end.slice(0, 10) > day ||
                          (end.slice(0, 10) === day &&
                            end.slice(11) !== "00:00"))
                      );
                    })
                    .map((block) => (
                      <Typography key={block.id}>
                        {t("rental:block")}: {block.reason}
                      </Typography>
                    ))}
                  {data?.turnovers
                    .filter((turnover) =>
                      data.reservations.some(
                        (r) =>
                          r.id === turnover.incoming_reservation_id &&
                          r.check_in_on === day,
                      ),
                    )
                    .map((turnover) => (
                      <Button
                        key={turnover.id}
                        disabled={busy}
                        onClick={() => onOpenTurnover(turnover.id)}
                      >
                        {t("rental:preparation")} #{turnover.id} ·{" "}
                        {t(`rental:cleaning_${turnover.cleaning_status}`)}
                      </Button>
                    ))}
                </DayPanel>
              ))}
            </CalendarGrid>
          )}
          {agenda && (
            <Agenda>
              {data?.reservations.map(reservationButton)}
              {data?.blocks.map((block) => (
                <Typography key={block.id}>
                  {t("rental:block")}: {block.reason} ·{" "}
                  {formatRentalInstant(
                    block.starts_at,
                    property.timezone,
                    i18n.language,
                  )}{" "}
                  →{" "}
                  {formatRentalInstant(
                    block.ends_at,
                    property.timezone,
                    i18n.language,
                  )}
                </Typography>
              ))}
              {data?.turnovers.map((turnover) => (
                <Button
                  key={turnover.id}
                  disabled={busy}
                  onClick={() => onOpenTurnover(turnover.id)}
                >
                  {t("rental:preparation")} #{turnover.id} ·{" "}
                  {t(`rental:cleaning_${turnover.cleaning_status}`)}
                </Button>
              ))}
            </Agenda>
          )}
        </>
      </Skeleton>
    </Wrapper>
  );
}
