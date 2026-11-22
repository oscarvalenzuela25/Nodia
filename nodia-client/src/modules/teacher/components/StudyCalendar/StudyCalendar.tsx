import { useState } from "react";
import { Alert, Button, Chip, LinearProgress, Pagination, Stack, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import ContentPasteOutlined from "@mui/icons-material/ContentPasteOutlined";
import LabelOutlined from "@mui/icons-material/LabelOutlined";
import { useTranslation } from "react-i18next";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import TeacherLoading from "../TeacherLoading";
import { StudyCalendarImportDrawer } from "../StudyCalendarImportDrawer/StudyCalendarImportDrawer";
import {
  useStudyCalendarCategories, useStudyCalendarDay, useStudyCalendarPlan, useStudyCalendarPlans, useStudyCalendarWrites,
} from "../../infrastructure/useStudyCalendar";
import { calendarDayLabel, type CalendarDaySummary, type CalendarPlan, type DayUpdate } from "../../infrastructure/studyCalendar";
import type { StudyCalendarImportPlan } from "../../infrastructure/studyCalendarImport";
import CalendarBoard, { type CalendarView } from "./CalendarBoard";
import CalendarCategoryDrawer from "./CalendarCategoryDrawer";
import CalendarCreateForm from "./CalendarCreateForm";
import CalendarDayEditor from "./CalendarDayEditor";
import CalendarDrawer from "./CalendarDrawer";
import { calendarChipColors, CalendarActions, CalendarPanel, CalendarWorkspace } from "./styles";

type DrawerView =
  | { kind: "create" | "categories" | "import" }
  | { kind: "day"; plan: CalendarPlan; day: CalendarDaySummary };

export default function StudyCalendar({ active }: { active: boolean }) {
  const { t, i18n } = useTranslation();
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
  const [view, setView] = useState<CalendarView>("grid");
  const [drawer, setDrawer] = useState<DrawerView>();
  const plans = useStudyCalendarPlans(page, category, active);
  const chosenId = selected ?? plans.data?.data[0]?.id;
  const plan = useStudyCalendarPlan(chosenId, active);
  const categories = useStudyCalendarCategories(active);
  const dayDrawer = drawer?.kind === "day" ? drawer : undefined;
  const day = useStudyCalendarDay(dayDrawer?.plan.id, dayDrawer?.day.id, active);
  const mutations = useStudyCalendarWrites();
  const fetching = plans.isFetching || categories.isFetching || plan.isFetching;
  const busy = mutations.busy || fetching;
  const blockCreate = busy || categories.isError || !categories.data || mutations.uncertain;
  const language = i18n.resolvedLanguage ?? i18n.language;
  const onClose = () => setDrawer(undefined);

  const settleCreated = (result: CalendarPlan | null) => {
    if (!result) return;
    setCategory("");
    setPage(1);
    setSelected(result.id);
    setView("grid");
    onClose();
  };
  const create = async (entry: StudyCalendarImportPlan, newCategories?: string[]) => {
    try {
      settleCreated(await mutations.create(entry, newCategories));
    } catch {
      // Keep the form while the transport reports the error.
    }
  };
  const retryCreate = async () => {
    try {
      settleCreated(await mutations.retryCreate());
    } catch {
      // Transient errors keep the original request available.
    }
  };
  const saveDay = async (update: DayUpdate) => {
    if (!dayDrawer) return;
    const saved = await mutations.updateDay(dayDrawer.plan.id, dayDrawer.day.id, update);
    if (saved) onClose();
  };
  const setFilter = (id: string) => { setPage(1); setSelected(undefined); setCategory(id); };
  return (
    <Stack spacing={3} sx={{ minWidth: 0 }}>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 2 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{t("teacher:calendar.heading")}</Typography>
        <CalendarActions>
          <Button variant="outlined" startIcon={<ContentPasteOutlined />} disabled={blockCreate} onClick={() => setDrawer({ kind: "import" })}>
            {t("teacher:calendar.paste")}
          </Button>
          <Button variant="contained" startIcon={<AddOutlined />} disabled={blockCreate} onClick={() => setDrawer({ kind: "create" })}>
            {t("teacher:calendar.new")}
          </Button>
        </CalendarActions>
      </Stack>
      <QueryErrorAlert isError={categories.isError} isFetching={categories.isFetching} onRetry={categories.refetch} retryVariant="outlined" />
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, gap: 1 }}>
        <Stack direction="row" role="group" aria-label={t("teacher:calendar.filter_categories")} sx={{ gap: 1, flexWrap: "wrap" }}>
          <Chip label={t("teacher:calendar.all_categories")} variant={category === "" ? "filled" : "outlined"} color={category === "" ? "primary" : "default"}
            aria-pressed={category === ""} disabled={busy} onClick={() => setFilter("")} sx={{ minHeight: 44 }} />
          {categories.data?.map(item => (
            <Chip key={item.id} label={item.name} color={calendarChipColors[item.color]} variant={category === item.id ? "filled" : "outlined"}
              aria-pressed={category === item.id} disabled={busy} onClick={() => setFilter(item.id)} sx={{ minHeight: 44 }} />
          ))}
        </Stack>
        <Button variant="outlined" startIcon={<LabelOutlined />} disabled={busy || categories.isError || !categories.data}
          onClick={() => setDrawer({ kind: "categories" })} sx={{ minHeight: 44, width: { xs: "100%", sm: "auto" }, flexShrink: 0 }}>
          {t("teacher:calendar.categories")}
        </Button>
      </Stack>
      {mutations.uncertain && !drawer && <Alert severity="warning" action={
        <Button variant="outlined" color="inherit" disabled={mutations.busy} onClick={() => { void retryCreate(); }}>{t("core:retry")}</Button>
      }>{t("teacher:calendar.uncertain")}</Alert>}
      <QueryErrorAlert isError={plans.isError} isFetching={plans.isFetching} onRetry={plans.refetch} retryVariant="outlined" />
      {fetching && !plans.isLoading && <LinearProgress aria-label={t("core:loading_route")} sx={{ height: 2 }} />}
      <TeacherLoading loading={plans.isLoading && !plans.data}>
        {plans.data?.data.length === 0 && (
          <CalendarPanel variant="outlined"><Typography color="text.secondary">{t(category ? "teacher:calendar.empty_filtered" : "teacher:calendar.empty_plans")}</Typography></CalendarPanel>
        )}
        {(plans.data?.data.length || plan.data) ? (
          <CalendarWorkspace>
            <Stack component="section" aria-label={t("teacher:calendar.my_calendars")} spacing={1} sx={{ minWidth: 0 }}>
              <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 650 }}>{t("teacher:calendar.my_calendars")}</Typography>
              {plans.data?.data.map(entry => (
                <Button key={entry.id} type="button" variant="outlined" color={entry.id === chosenId ? "primary" : "inherit"}
                  onClick={() => setSelected(entry.id)} aria-pressed={entry.id === chosenId} disabled={busy}
                  sx={{ justifyContent: "flex-start", textAlign: "start", p: 1.25, textTransform: "none", minWidth: 0, borderColor: "divider",
                    "&[aria-pressed='true']": { borderColor: "primary.main", bgcolor: "action.selected" } }}>
                  <Stack component="span" spacing={0.5} sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    <Typography variant="subtitle2">{entry.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("teacher:calendar.week_progress", { done: entry.completed_count, total: entry.day_count })}
                    </Typography>
                    {!!entry.categories.length && <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap" }}>
                      {entry.categories.map(item => <Chip key={item.id} label={item.name} size="small" variant="outlined" color={calendarChipColors[item.color]} />)}
                    </Stack>}
                  </Stack>
                </Button>
              ))}
              {plans.data && plans.data.meta.total_pages > 1 && (
                <Pagination page={page} count={plans.data.meta.total_pages} disabled={busy} onChange={(_, value) => {
                  setSelected(undefined); setPage(value);
                }} />
              )}
            </Stack>
            <Stack spacing={1} sx={{ minWidth: 0 }}>
              <QueryErrorAlert isError={plan.isError} isFetching={plan.isFetching} onRetry={plan.refetch} retryVariant="outlined" />
              <TeacherLoading loading={plan.isLoading && !plan.data}>
                {plan.data && <CalendarBoard plan={plan.data} view={view} onView={setView} disabled={busy}
                  onDay={value => { if (plan.data) setDrawer({ kind: "day", plan: plan.data, day: value }); }} />}
              </TeacherLoading>
            </Stack>
          </CalendarWorkspace>
        ) : null}
      </TeacherLoading>
      {drawer?.kind === "create" && <CalendarDrawer title={t("teacher:calendar.new")} busy={mutations.busy} onClose={onClose}>
        <CalendarCreateForm categories={categories.data ?? []} busy={mutations.busy || categories.isFetching} uncertain={mutations.uncertain}
          onSave={entry => { void create(entry); }} onRetry={() => { void retryCreate(); }} onCancel={onClose} />
      </CalendarDrawer>}
      {drawer?.kind === "import" && <StudyCalendarImportDrawer open onClose={onClose}
        categories={categories.data ?? []} categoriesReady={categories.isSuccess && !categories.isFetching}
        uncertain={mutations.uncertain} onRetry={() => { void retryCreate(); }}
        isBusy={mutations.busy} onConfirm={(entry, newCategories) => { void create(entry, newCategories); }} />}
      {drawer?.kind === "categories" && <CalendarCategoryDrawer categories={categories.data ?? []}
        busy={mutations.busy || categories.isFetching} onClose={onClose} onSave={mutations.saveCategory} onToggle={mutations.setCategoryActive} />}
      {dayDrawer && <CalendarDrawer
        title={calendarDayLabel(dayDrawer.day, language, ordinal => t("teacher:calendar.number_label", { ordinal }))}
        description={dayDrawer.plan.title} busy={mutations.busy} onClose={onClose}>
        <Stack spacing={1.5}>
          <QueryErrorAlert isError={day.isError} isFetching={day.isFetching} onRetry={day.refetch} retryVariant="outlined" />
          <TeacherLoading loading={day.isLoading && !day.data}>
            {day.data && <CalendarDayEditor key={day.data.id} day={day.data} busy={mutations.busy || day.isFetching}
              onCancel={onClose} onSave={saveDay} onReload={async () => {
                const fresh = await day.refetch();
                return fresh.isSuccess ? fresh.data : undefined;
              }} />}
          </TeacherLoading>
        </Stack>
      </CalendarDrawer>}
    </Stack>
  );
}
