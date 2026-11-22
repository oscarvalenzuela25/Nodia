import { useCallback, useId, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import { useCalendarController } from "@fullcalendar/react";
import type { DatesSetInfo } from "@fullcalendar/react";
import EventCalendarViews from "@fullcalendar/mui/monarch/EventCalendarViews";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import esLocale from "@fullcalendar/react/locales/es";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/mui/monarch/theme.css";
import type { RentalProperty } from "../../types";
import {
  useRentalCalendar,
  useRentalBusy,
} from "../../infrastructure/useServices";
import {
  addCivilDays,
  todayInZone,
  formatRentalInstant,
} from "../../utils/dates";
import {
  calendarAgenda,
  calendarEvents,
  calendarWeekWindow,
  initialCalendarWindow,
} from "./calendar";
import ReservationPreview from "../ReservationPreview";
import {
  CalendarLayout,
  CalendarPanel,
  Toolbar,
  Wrapper,
  Agenda,
  AgendaCard,
  ContextPanel,
  Legend,
  CalendarViewControls,
  PeriodNavigation,
} from "./styles";

export type RentalCalendarProps = {
  property: RentalProperty;
  onOpenReservation: (id: string) => void;
  onOpenTurnover: (id: string) => void;
  onManageBlocks: () => void;
  onCreateReservation?: (stay: {
    check_in_on: string;
    check_out_on: string;
  }) => void;
  onQuickPayment?: (id: string) => void;
  selectedReservationId?: string;
  onSelectReservation?: (id: string | undefined) => void;
};
const plugins = [dayGridPlugin, interactionPlugin];
const locales = [esLocale];
export default function RentalCalendar({
  property,
  onOpenReservation,
  onOpenTurnover,
  onManageBlocks,
  onCreateReservation,
  onQuickPayment,
  selectedReservationId,
  onSelectReservation,
}: RentalCalendarProps) {
  const { t, i18n } = useTranslation();
  const agendaId = useId();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const today = todayInZone(property.timezone);
  const [date, setDate] = useState(() => today);
  const [mode, setMode] = useState<"month" | "week" | "agenda">("month");
  const [range, commitRange] = useState(() => initialCalendarWindow(today));
  const rangeRef = useRef(range);
  const setRange = useCallback((next: typeof range) => {
    if (rangeRef.current.from === next.from && rangeRef.current.to === next.to)
      return;
    rangeRef.current = next;
    commitRange(next);
  }, []);
  const [internalSelection, setInternalSelection] = useState<string>();
  const selected = onSelectReservation
    ? selectedReservationId
    : internalSelection;
  const setSelected = onSelectReservation ?? setInternalSelection;
  const [lastSelection, setLastSelection] = useState<string>();
  const selectReservation = (id: string) => {
    setLastSelection(id);
    setSelected(id);
  };
  const [nonOccupying, setNonOccupying] = useState(false);
  const controller = useCalendarController();
  const datesSet = useCallback(
    (info: DatesSetInfo) => {
      const from = info.startStr.slice(0, 10),
        to = info.endStr.slice(0, 10);
      setRange({ from, to });
    },
    [setRange],
  );
  const query = useRentalCalendar(property.id, {
    from_on: range.from,
    to_on: range.to,
    include_non_occupying: nonOccupying,
  });
  const busy = useRentalBusy(property.id) || query.isFetching;
  const data = query.data;
  const list = mode === "agenda" || mobile;
  const navigate = (offset: number) => {
    if (list) {
      const [year, month] = date.split("-").map(Number);
      const next =
        mode === "month"
          ? new Date(Date.UTC(year, month - 1 + offset, 1))
              .toISOString()
              .slice(0, 10)
          : addCivilDays(range.from, offset * 7);
      setDate(next);
      setRange(
        mode === "month"
          ? initialCalendarWindow(next)
          : calendarWeekWindow(next),
      );
    } else {
      if (offset < 0) controller.prev();
      else controller.next();
      const next = controller.getDate();
      if (next) setDate(next.toISOString().slice(0, 10));
    }
  };
  const changeMode = (next: typeof mode) => {
    if (next === mode) return;
    setMode(next);
    setRange(
      next === "month" ? initialCalendarWindow(date) : calendarWeekWindow(date),
    );
  };
  const monthTitle = new Intl.DateTimeFormat(i18n.language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const visibleDates = dateFormatter.formatRange(
    new Date(range.from + "T12:00:00Z"),
    new Date(addCivilDays(range.to, -1) + "T12:00:00Z"),
  );
  const displayDate = (day: string) =>
    dateFormatter.format(new Date(day + "T12:00:00Z"));
  const events = useMemo(
    () => data && !list
      ? calendarEvents(data, property.timezone, t, theme.palette)
      : [],
    [data, list, property.timezone, t, theme.palette],
  );
  const agenda = useMemo(
    () => (data && list ? calendarAgenda(data, property.timezone) : []),
    [data, list, property.timezone],
  );
  return (
    <Wrapper>
      <CalendarLayout>
        {(!mobile || !selected) && (
          <CalendarPanel>
            <Toolbar>
              <PeriodNavigation>
                <IconButton
                  sx={{ minWidth: 44, minHeight: 44 }}
                  aria-label={t("rental:previous_window")}
                  disabled={busy}
                  onClick={() => navigate(-1)}
                >
                  <ChevronLeft />
                </IconButton>
                <Typography component="h2" variant="h6" aria-live="polite">
                  {mode === "month" ? monthTitle : visibleDates}
                </Typography>
                <IconButton
                  sx={{ minWidth: 44, minHeight: 44 }}
                  aria-label={t("rental:next_window")}
                  disabled={busy}
                  onClick={() => navigate(1)}
                >
                  <ChevronRight />
                </IconButton>
              </PeriodNavigation>
              <CalendarViewControls>
                <Button
                  variant="outlined"
                  disabled={busy}
                  onClick={() => {
                    setDate(today);
                    if (list)
                      setRange(
                        mode === "month"
                          ? initialCalendarWindow(today)
                          : calendarWeekWindow(today),
                      );
                    else controller.gotoDate(today);
                  }}
                >
                  {t("rental:calendar_today")}
                </Button>
                <ToggleButtonGroup
                  exclusive
                  value={mobile && mode === "agenda" ? "week" : mode}
                  size="small"
                  aria-label={t("rental:calendar_view")}
                  onChange={(_, next: typeof mode | null) => {
                    if (next) changeMode(next);
                  }}
                >
                  <ToggleButton value="month" disabled={busy}>
                    {t("rental:calendar_month")}
                  </ToggleButton>
                  <ToggleButton value="week" disabled={busy}>
                    {t("rental:calendar_week")}
                  </ToggleButton>
                  {!mobile && (
                    <ToggleButton value="agenda" disabled={busy}>
                      {t("rental:show_agenda")}
                    </ToggleButton>
                  )}
                </ToggleButtonGroup>
              </CalendarViewControls>
            </Toolbar>
            {mode === "month" && (
              <Typography variant="body2" color="text.secondary">
                {visibleDates}
              </Typography>
            )}
            {query.isFetching && !query.isLoading && (
              <LinearProgress
                aria-label={t("rental:calendar_refreshing")}
                sx={{ height: 2 }}
              />
            )}
            {query.isError && (
              <Alert
                severity="error"
                action={
                  <Button
                    disabled={query.isFetching}
                    onClick={() => query.refetch()}
                  >
                    {t("rental:retry")}
                  </Button>
                }
              >
                {t(mode === "month" ? "rental:calendar_window_error" : "rental:load_error")}
                {mode === "month" && (
                  <Button
                    disabled={query.isFetching}
                    onClick={() => changeMode("week")}
                  >
                    {t("rental:reduce_window")}
                  </Button>
                )}
              </Alert>
            )}
            <Skeleton loading={query.isLoading}>
              <Box sx={{ minWidth: 0 }}>
                {data && !query.isError &&
                  (list ? agenda.length === 0 : events.length === 0) && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      {t("rental:empty_calendar")}
                    </Alert>
                  )}
                {!list && (
                  <EventCalendarViews
                    key={mode}
                    controller={controller}
                    plugins={plugins}
                    initialDate={date}
                    initialView={
                      mode === "week" ? "dayGridWeek" : "dayGridMonth"
                    }
                    timeZone="UTC"
                    now={today + "T12:00:00Z"}
                    firstDay={1}
                    locales={locales}
                    locale={i18n.language.startsWith("es") ? "es" : "en"}
                    eventDidMount={(info) => {
                      info.el.title = [
                        info.event.title,
                        info.event.extendedProps.description,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                    }}
                    height="auto"
                    fixedWeekCount={false}
                    dayMaxEvents={4}
                    events={events}
                    editable={false}
                    eventInteractive={!busy}
                    selectable={!busy && !query.isError && property.is_active}
                    datesSet={datesSet}
                    dateClick={(info) => {
                      if (!busy && !query.isError && property.is_active)
                        onCreateReservation?.({
                          check_in_on: info.dateStr,
                          check_out_on: addCivilDays(info.dateStr, 1),
                        });
                    }}
                    select={(info) => {
                      if (!busy && !query.isError && property.is_active)
                        onCreateReservation?.({
                          check_in_on: info.startStr,
                          check_out_on: info.endStr,
                        });
                    }}
                    eventClick={(info) => {
                      if (busy) return;
                      const [kind, id] = info.event.id.split(":");
                      if (kind === "reservation") selectReservation(id);
                      else if (kind === "turnover") onOpenTurnover(id);
                      else onManageBlocks();
                    }}
                  />
                )}
                {list && (
                  <Agenda>
                    {query.isLoading && <Box sx={{ minHeight: 160 }} />}
                    {agenda.map((entry) => {
                      if (entry.kind === "reservation") {
                        const row = entry.row;
                        const datesId = `${agendaId}-${row.id}`;
                        return (
                          <AgendaCard
                            key={row.id}
                            disabled={busy}
                            autoFocus={mobile && row.id === lastSelection}
                            onClick={() => selectReservation(row.id)}
                            aria-describedby={datesId}
                            aria-label={
                              row.guest_name +
                              " · " +
                              t("rental:status_" + row.status)
                            }
                          >
                            <Box>
                              <Typography
                                component="span"
                                variant="subtitle1"
                                sx={{ fontWeight: 700 }}
                              >
                                {row.guest_name}
                              </Typography>
                              <Typography
                                id={datesId}
                                component="span"
                                variant="body2"
                                sx={{ display: "block", color: "text.secondary" }}
                              >
                                <Box
                                  component="time"
                                  dateTime={`${row.check_in_on}T${row.check_in_time}`}
                                  sx={{ display: "inline-block" }}
                                >
                                  {displayDate(row.check_in_on)} {row.check_in_time}
                                </Box>
                                {" → "}
                                <Box
                                  component="time"
                                  dateTime={`${row.check_out_on}T${row.check_out_time}`}
                                  sx={{ display: "inline-block" }}
                                >
                                  {displayDate(row.check_out_on)} {row.check_out_time}
                                </Box>
                              </Typography>
                            </Box>
                            <Chip
                              component="span"
                              size="small"
                              label={
                                t("rental:status_" + row.status) +
                                (!row.is_active ? " · " + t("rental:inactive") : "")
                              }
                            />
                          </AgendaCard>
                        );
                      }
                      if (entry.kind === "block") {
                        const block = entry.row;
                        return (
                          <AgendaCard
                            key={"b" + block.id}
                            disabled={busy}
                            onClick={onManageBlocks}
                          >
                            <Box>
                              <Typography component="span" sx={{ display: "block" }}>
                                {t("rental:block")}: {block.reason}
                              </Typography>
                              <Typography component="span" variant="body2">
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
                            </Box>
                          </AgendaCard>
                        );
                      }
                      const row = entry.row;
                      return (
                        <AgendaCard
                          key={"t" + row.id}
                          disabled={busy}
                          onClick={() => onOpenTurnover(row.id)}
                        >
                          {t("rental:preparation")} · {entry.guestName ?? `#${row.id}`} ·{" "}
                          {t("rental:cleaning_" + row.cleaning_status)}
                        </AgendaCard>
                      );
                    })}
                  </Agenda>
                )}
              </Box>
            </Skeleton>
            <Legend>
              {["confirmed", "in_progress", "draft", "cancelled"].map(
                (status) => (
                  <Chip
                    key={status}
                    size="small"
                    variant="outlined"
                    label={t("rental:status_" + status)}
                  />
                ),
              )}
              <Chip size="small" variant="outlined" label={t("rental:block")} />
            </Legend>
            <Typography variant="caption" color="text.secondary">
              {t("rental:calendar_legend")}
            </Typography>
            <Toolbar>
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
              <Button disabled={busy} onClick={onManageBlocks}>
                {t("rental:manage_blocks")}
              </Button>
            </Toolbar>
          </CalendarPanel>
        )}
        <ContextPanel>
          {selected ? (
            <ReservationPreview
              key={selected}
              property={property}
              id={selected}
              onClose={() => setSelected(undefined)}
              onOpen={onOpenReservation}
              onPayment={onQuickPayment}
              onTurnover={onOpenTurnover}
            />
          ) : (
            <>
              <Typography variant="overline" color="text.secondary">
                {t("rental:calendar_context")}
              </Typography>
              <Typography variant="h5">
                {new Intl.DateTimeFormat(i18n.language, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "UTC",
                }).format(new Date(today + "T12:00:00Z"))}
              </Typography>
              <Typography color="text.secondary">
                {t("rental:calendar_select_hint")}
              </Typography>
              {data &&
                range.from <= today &&
                today < range.to &&
                data.reservations
                  .filter(
                    (row) =>
                      row.check_in_on === today || row.check_out_on === today,
                  )
                  .map((row) => (
                    <Button
                      key={row.id}
                      disabled={busy}
                      onClick={() => selectReservation(row.id)}
                    >
                      {t(
                        row.check_in_on === today
                          ? "rental:check_in_on"
                          : "rental:check_out_on",
                      )}{" "}
                      · {row.guest_name}
                    </Button>
                  ))}
              {onCreateReservation && (
                <Button
                  fullWidth
                  variant="contained"
                  disabled={busy || !property.is_active}
                  onClick={() =>
                    onCreateReservation({
                      check_in_on: today,
                      check_out_on: addCivilDays(today, 1),
                    })
                  }
                >
                  {t("rental:new_reservation_today")}
                </Button>
              )}
            </>
          )}
        </ContextPanel>
      </CalendarLayout>
    </Wrapper>
  );
}
