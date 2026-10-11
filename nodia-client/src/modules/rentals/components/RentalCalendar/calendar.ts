import type { Palette } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import type { EventInput } from "@fullcalendar/react";
import type { TFunction } from "i18next";
import type { RentalCalendar } from "../../types";
import { addCivilDays, toLocalDateTime } from "../../utils/dates";

export function initialCalendarWindow(date: string) {
  const first = date.slice(0, 7) + "-01";
  const weekday = new Date(first + "T12:00:00Z").getUTCDay();
  const from = addCivilDays(first, -((weekday + 6) % 7));
  const [year, month] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const nextWeekday = new Date(next + "T12:00:00Z").getUTCDay();
  const to = addCivilDays(next, (8 - nextWeekday) % 7);
  return { from, to };
}

export function calendarEvents(
  data: RentalCalendar,
  timezone: string,
  t: TFunction,
  palette: Palette,
): EventInput[] {
  const reservations = data.reservations.map((row): EventInput => {
    const nonOccupying = row.status === "draft" || row.status === "cancelled";
    const color = nonOccupying
      ? palette.warning
      : row.status === "in_progress"
        ? palette.primary
        : palette.success;
    return {
      id: `reservation:${row.id}`,
      title: `${row.guest_name} · ${t(`rental:status_${row.status}`)}${!row.is_active ? ` · ${t("rental:inactive")}` : ""}`,
      start: row.check_in_on,
      end: row.check_out_on,
      allDay: true,
      color: alpha(color.main, palette.mode === "dark" ? 0.22 : 0.12),
      contrastColor: palette.text.primary,
      className: `rental-reservation rental-status-${row.status}${nonOccupying ? " rental-event-muted" : ""}`,
      extendedProps: {
        description: `${row.check_in_on} ${row.check_in_time} → ${row.check_out_on} ${row.check_out_time}`,
      },
    };
  });
  const blocks = data.blocks.map((block): EventInput => {
    const start = toLocalDateTime(block.starts_at, timezone);
    const end = toLocalDateTime(block.ends_at, timezone);
    // A partial final day is blocked too; midnight remains exclusive.
    const endOn =
      end.slice(11) === "00:00"
        ? end.slice(0, 10)
        : addCivilDays(end.slice(0, 10), 1);
    return {
      id: `block:${block.id}`,
      title: `${t("rental:block")}: ${block.reason}`,
      start: start.slice(0, 10),
      end: endOn,
      allDay: true,
      color: palette.text.secondary,
      contrastColor: palette.background.paper,
      extendedProps: { description: `${start} → ${end}` },
    };
  });
  const byId = new Map(data.reservations.map((row) => [row.id, row]));
  const turnovers = data.turnovers.flatMap((row): EventInput[] => {
    const reservation = byId.get(row.incoming_reservation_id);
    if (!reservation) return [];
    return [
      {
        id: `turnover:${row.id}`,
        title: `${t("rental:preparation")} · ${t(`rental:cleaning_${row.cleaning_status}`)}`,
        start: reservation.check_in_on,
        allDay: true,
        color: palette.info.main,
        contrastColor: palette.info.contrastText,
      },
    ];
  });
  return [...reservations, ...blocks, ...turnovers];
}

export function occupiesCivilNight(
  checkIn: string,
  checkOut: string,
  day: string,
) {
  return checkIn <= day && day < checkOut;
}
