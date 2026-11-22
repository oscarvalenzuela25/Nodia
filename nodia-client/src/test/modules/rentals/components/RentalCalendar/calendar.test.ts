import { expect, it } from "vitest";
import { createTheme, alpha } from "@mui/material/styles";
import { calendar, example, turnover } from "../../infrastructure/fixtures";
import { blockSchema } from "../../../../../modules/rentals/infrastructure/schemas";
import {
  calendarAgenda,
  calendarEvents,
  calendarWeekWindow,
  initialCalendarWindow,
} from "../../../../../modules/rentals/components/RentalCalendar/calendar";
import i18n from "../../../../../translate";
it("uses complete Monday-to-Sunday month windows within the backend limit", () => {
  expect(initialCalendarWindow("2026-11-08")).toEqual({ from: "2026-10-26", to: "2026-12-07" });
  expect(initialCalendarWindow("2021-02-09")).toEqual({ from: "2021-02-01", to: "2021-03-01" });
});
it("uses the same Monday-to-Sunday week when the selection falls on Sunday", () => {
  expect(calendarWeekWindow("2027-01-03")).toEqual({
    from: "2026-12-28",
    to: "2027-01-04",
  });
});
it("represents each stay once with exclusive civil checkout and the v7 theme colors", () => {
  const palette = createTheme().palette;
  const events = calendarEvents(calendar, "America/Santiago", i18n.t, palette);
  const row = calendar.reservations[0];
  const event = events.find((item) => item.id === `reservation:${row.id}`)!;
  expect(events.filter((item) => item.id === event.id)).toHaveLength(1);
  expect(event).toMatchObject({ start: row.check_in_on, end: row.check_out_on, allDay: true, color: alpha(palette.success.main, 0.12), contrastColor: palette.text.primary });
  expect(event.title).toContain(i18n.t(`rental:status_${row.status}`));
});
it("projects blocks in the resource timezone, including partial final days but excluding midnight", () => {
  const block = blockSchema.parse(example("/{propertyId}/blocks/{id}"));
  const data = { ...calendar, reservations: [], turnovers: [], blocks: [{ ...block, starts_at: "2026-10-02T18:00:00Z", ends_at: "2026-10-04T14:00:00Z" }] };
  const palette = createTheme().palette;
  expect(calendarEvents(data, "America/Santiago", i18n.t, palette)[0]).toMatchObject({ start: "2026-10-02", end: "2026-10-05" });
  data.blocks[0].ends_at = "2026-10-04T03:00:00Z";
  expect(calendarEvents(data, "America/Santiago", i18n.t, palette)[0]).toMatchObject({ start: "2026-10-02", end: "2026-10-04" });
});

it("orders agenda entries by the property's local date and keeps unmatched preparation visible", () => {
  const reservation = {
    ...calendar.reservations[0],
    check_in_on: "2026-11-08",
    check_in_time: "15:00",
  };
  const block = blockSchema.parse(example("/{propertyId}/blocks/{id}"));
  const entries = calendarAgenda({
    ...calendar,
    reservations: [reservation],
    blocks: [
      { ...block, id: "91", starts_at: "2026-11-08T19:00:00Z" },
      { ...block, id: "92", starts_at: "2026-11-08T16:00:00Z" },
    ],
    turnovers: [
      { ...turnover, id: "93", incoming_reservation_id: "94" },
      { ...turnover, id: "95", incoming_reservation_id: reservation.id },
    ],
  }, "America/Santiago");
  expect(entries.map(({ kind, row }) => [kind, row.id])).toEqual([
    ["block", "92"],
    ["reservation", reservation.id],
    ["turnover", "95"],
    ["block", "91"],
    ["turnover", "93"],
  ]);
});
