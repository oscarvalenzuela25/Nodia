import { Box, Chip, LinearProgress, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import ViewListOutlined from "@mui/icons-material/ViewListOutlined";
import CalendarViewMonthOutlined from "@mui/icons-material/CalendarViewMonthOutlined";
import { useTranslation } from "react-i18next";
import { calendarDayLabel, calendarWeeks, formatCalendarDate, type CalendarDaySummary, type CalendarPlan } from "../../infrastructure/studyCalendar";
import { calendarChipColors, CalendarDayButton, CalendarDayGrid, CalendarDayListButton, CalendarPanel } from "./styles";

export type CalendarView = "grid" | "list";

type Props = {
  plan: CalendarPlan;
  view: CalendarView;
  onView: (view: CalendarView) => void;
  onDay: (day: CalendarDaySummary) => void;
  disabled: boolean;
};

export default function CalendarBoard({ plan, view, onView, onDay, disabled }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const completedPercent = Math.round(100 * plan.completed_count / plan.day_count);
  const next = plan.days.find(day => !day.completed)?.id;
  const dayLabel = (day: CalendarDaySummary) => calendarDayLabel(day, language, ordinal => t("teacher:calendar.number_label", { ordinal }));
  const dateShort = (value: string) => formatCalendarDate(value, language, { month: "short", day: "numeric" });
  return (
    <CalendarPanel variant="outlined">
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", lg: "row" }} sx={{ alignItems: { xs: "flex-start", lg: "center" }, justifyContent: "space-between", gap: 1, minWidth: 0 }}>
          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="h3">{plan.title}</Typography>
            {plan.categories.length > 0 && (
              <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap" }}>
                {plan.categories.map(category => <Chip key={category.id} label={category.name} size="small" variant="outlined" color={calendarChipColors[category.color]} />)}
              </Stack>
            )}
            <Typography variant="body2" color="text.secondary">
              {plan.schedule.kind === "numbered"
                ? t("teacher:calendar.numbered_count", { count: plan.day_count })
                : t("teacher:calendar.date_range", { start: dateShort(plan.schedule.start), end: dateShort(plan.schedule.end) })}
            </Typography>
          </Stack>
          <ToggleButtonGroup exclusive value={view} size="small" aria-label={t("teacher:calendar.view")}
            disabled={disabled} onChange={(_, value: CalendarView | null) => { if (value) onView(value); }}
            sx={{ maxWidth: "100%", "& > button": { minHeight: 44, gap: 0.5 } }}>
            <ToggleButton value="grid"><CalendarViewMonthOutlined fontSize="small" />{t("teacher:calendar.grid")}</ToggleButton>
            <ToggleButton value="list"><ViewListOutlined fontSize="small" />{t("teacher:calendar.day_by_day")}</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Stack spacing={0.5}>
          <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="body2">{t("teacher:calendar.completed_days")}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{t("teacher:calendar.plan_progress", {
              done: plan.completed_count, total: plan.day_count, percentage: completedPercent,
            })}</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={completedPercent} aria-label={t("teacher:calendar.completed_days")}
            sx={{ height: 6, borderRadius: 999 }} />
        </Stack>
        {plan.schedule.kind === "dated" && view === "grid" && (
          <CalendarDayGrid aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => formatCalendarDate("2026-06-0" + (index + 1), language, { weekday: "short" })).map(label => (
              <Typography key={label} variant="caption" align="center" color="text.secondary">{label}</Typography>
            ))}
          </CalendarDayGrid>
        )}
        {calendarWeeks(plan.days).map(({ key, days }, index) => {
          const firstDate = days.at(0)?.day.date;
          const lastDate = days.at(-1)?.day.date;
          const title = firstDate && lastDate
            ? t("teacher:calendar.date_range", { start: dateShort(firstDate), end: dateShort(lastDate) })
            : t("teacher:calendar.week", { week: index + 1 });
          const weekComplete = days.filter(({ day }) => day.completed).length;
          return (
            <Stack key={key} spacing={0.75}>
              <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                <Typography variant="subtitle2" component="h4">{title}</Typography>
                <Typography variant="body2" color="text.secondary">{t("teacher:calendar.week_progress", { done: weekComplete, total: days.length })}</Typography>
              </Stack>
              {view === "grid" ? <CalendarDayGrid>
                {days.map(({ day, column }) => (
                  <CalendarDayButton key={day.id} variant="outlined" color="inherit" disabled={disabled} data-done={day.completed} data-next={next === day.id}
                    sx={{ gridColumn: column }} onClick={() => onDay(day)}
                    aria-label={t("teacher:calendar.day_button", { day: dayLabel(day), title: day.title ?? t("teacher:calendar.empty_day"), state: t(day.completed ? "teacher:calendar.day_complete" : "teacher:calendar.day_pending") })}>
                    {day.date ? Number(day.date.slice(-2)) : day.ordinal}
                    {day.completed && <CheckOutlined aria-hidden sx={{ fontSize: 12, position: "absolute", insetInlineEnd: 2, top: 2 }} />}
                  </CalendarDayButton>
                ))}
              </CalendarDayGrid> : <Stack spacing={0.5}>
                {days.map(({ day }) => (
                  <CalendarDayListButton key={day.id} variant="outlined" color="inherit" disabled={disabled} data-done={day.completed}
                    onClick={() => onDay(day)}>
                    <Box sx={{ minWidth: 0, textAlign: "start" }}>
                      <Typography variant="caption" color="text.secondary">{dayLabel(day)}</Typography>
                      <Typography variant="body2">{day.title ?? t("teacher:calendar.empty_day")}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t("teacher:calendar.activity_progress", { done: day.completed_activity_count, count: day.activity_count })}
                    </Typography>
                  </CalendarDayListButton>
                ))}
              </Stack>}
            </Stack>
          );
        })}
      </Stack>
    </CalendarPanel>
  );
}
