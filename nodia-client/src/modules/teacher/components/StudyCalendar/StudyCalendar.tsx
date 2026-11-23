import { useEffect, useRef, useState } from "react";
import { Alert, Button, Chip, LinearProgress, Pagination, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import ContentPasteOutlined from "@mui/icons-material/ContentPasteOutlined";
import LabelOutlined from "@mui/icons-material/LabelOutlined";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import TeacherLoading from "../TeacherLoading";
import { StudyCalendarImportDrawer } from "../StudyCalendarImportDrawer/StudyCalendarImportDrawer";
import {
  useStudyCalendarCategories, useStudyCalendarDay, useStudyCalendarPlan, useStudyCalendarPlans, useStudyCalendarWrites,
} from "../../infrastructure/useStudyCalendar";
import {
  calendarDayLabel, type CalendarDaySummary, type CalendarPlan, type CalendarPlanStatus,
  type CalendarPlanUpdate, type CalendarSummary, type DayUpdate,
} from "../../infrastructure/studyCalendar";
import type { StudyCalendarImportPlan } from "../../infrastructure/studyCalendarImport";
import CalendarBoard, { type CalendarView } from "./CalendarBoard";
import CalendarCategoryDrawer from "./CalendarCategoryDrawer";
import CalendarCreateForm from "./CalendarCreateForm";
import CalendarDayEditor from "./CalendarDayEditor";
import CalendarDrawer from "./CalendarDrawer";
import CalendarPlanCard, { type CalendarPlanAction } from "./CalendarPlanCard";
import CalendarPlanUpdateForm from "./CalendarPlanUpdateForm";
import { calendarChipColors, CalendarActions, CalendarPanel, CalendarWorkspace } from "./styles";

type DrawerView =
  | { kind: "create" | "categories" | "import" }
  | { kind: "plan-edit"; plan: CalendarSummary }
  | { kind: "day"; plan: CalendarPlan; day: CalendarDaySummary };

type Confirmation = { action: "toggle" | "delete"; plan: CalendarSummary };
const statuses = ["all", "active", "inactive"] satisfies CalendarPlanStatus[];

export default function StudyCalendar({ active }: { active: boolean }) {
  const { t, i18n } = useTranslation();
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<CalendarPlanStatus>("active");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
  const [view, setView] = useState<CalendarView>("grid");
  const [drawer, setDrawer] = useState<DrawerView>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const filterGroup = useRef<HTMLDivElement>(null);
  const restoreFilterFocus = useRef(false);
  const plans = useStudyCalendarPlans(page, category, status, active);
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

  useEffect(() => {
    if (!restoreFilterFocus.current || !active || busy || drawer || confirmation) return;
    filterGroup.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();
    restoreFilterFocus.current = false;
  }, [active, busy, drawer, confirmation]);

  const settleCreated = (result: CalendarPlan | null) => {
    if (!result) return;
    setCategory("");
    setStatus("active");
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
  const removeFromView = (id: string) => {
    restoreFilterFocus.current = true;
    if (page > 1 && plans.data?.data.length === 1) {
      setPage(1);
      setSelected(undefined);
      return;
    }
    setSelected(current => current === id ? undefined : current);
  };
  const savePlan = async (entry: CalendarSummary, update: CalendarPlanUpdate) => {
    try {
      if (!await mutations.patchPlan(entry.id, update)) return;
      if (category && update.category_ids && !update.category_ids.includes(category)) removeFromView(entry.id);
      onClose();
    } catch {
      // The shared HTTP layer presents the error. Keep the drawer and draft.
    }
  };
  const selectPlanAction = (entry: CalendarSummary, action: CalendarPlanAction) => {
    if (action === "edit") setDrawer({ kind: "plan-edit", plan: entry });
    else setConfirmation({ action, plan: entry });
  };
  const confirmPlanAction = async () => {
    if (!confirmation) return;
    const { plan: entry, action } = confirmation;
    try {
      const activeAfter = !entry.active;
      const saved = action === "delete"
        ? await mutations.deletePlan(entry.id)
        : await mutations.patchPlan(entry.id, { active: activeAfter });
      if (!saved) return;
      if (action === "delete" || (status !== "all" && (status === "active") !== activeAfter)) removeFromView(entry.id);
      setConfirmation(undefined);
    } catch {
      // Preserve the confirmation until a successful response or explicit cancellation.
    }
  };
  const confirmationLabel = confirmation?.action === "delete"
    ? "delete_plan"
    : confirmation?.plan.active ? "deactivate_plan" : "activate_plan";
  const confirmationQuestion = confirmation?.action === "delete"
    ? "delete_plan_question"
    : confirmation?.plan.active ? "deactivate_plan_question" : "activate_plan_question";
  const emptyPlanMessage = category ? "empty_filtered"
    : status === "inactive" ? "empty_inactive_plans" : status === "all" ? "empty_all_plans" : "empty_plans";
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
      <ToggleButtonGroup ref={filterGroup} size="small" exclusive value={status} disabled={busy}
        aria-label={t("teacher:calendar.plan_status_filter")} onChange={(_, value: CalendarPlanStatus | null) => {
          if (!value) return;
          setStatus(value);
          setPage(1);
          setSelected(undefined);
        }} sx={{
          alignSelf: { xs: "stretch", sm: "flex-start" },
          "& > .MuiToggleButton-root": { flex: { xs: 1, sm: "unset" }, minHeight: 44, textTransform: "none" },
        }}>
        {statuses.map(value => <ToggleButton key={value} value={value}>{t("teacher:calendar.plan_status." + value)}</ToggleButton>)}
      </ToggleButtonGroup>
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
          <CalendarPanel variant="outlined"><Typography color="text.secondary">{t("teacher:calendar." + emptyPlanMessage)}</Typography></CalendarPanel>
        )}
        {(plans.data?.data.length || plan.data) ? (
          <CalendarWorkspace>
            <Stack component="section" aria-label={t("teacher:calendar.my_calendars")} spacing={1} sx={{ minWidth: 0 }}>
              <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 650 }}>{t("teacher:calendar.my_calendars")}</Typography>
              <Stack component="ul" role="list" spacing={1} sx={{ p: 0, m: 0, listStyle: "none", minWidth: 0 }}>
                {plans.data?.data.map(entry => <CalendarPlanCard key={entry.id} plan={entry} selected={entry.id === chosenId}
                  disabled={busy} onSelect={() => setSelected(entry.id)} onAction={action => selectPlanAction(entry, action)} />)}
              </Stack>
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
      {drawer?.kind === "plan-edit" && <CalendarDrawer title={t("teacher:calendar.update_plan_title")} busy={mutations.busy} onClose={onClose}>
        <Stack spacing={2}>
          <QueryErrorAlert isError={categories.isError} isFetching={categories.isFetching} onRetry={categories.refetch} retryVariant="outlined" />
          <CalendarPlanUpdateForm plan={drawer.plan} categories={categories.data ?? []}
            busy={mutations.busy || categories.isFetching || !categories.isSuccess}
            onSave={update => savePlan(drawer.plan, update)} onCancel={onClose} />
        </Stack>
      </CalendarDrawer>}
      {confirmation && <ConfirmDialog open title={t("teacher:calendar." + confirmationLabel)}
        message={t("teacher:calendar." + confirmationQuestion, { name: confirmation.plan.title })}
        confirmText={t("teacher:calendar." + confirmationLabel)}
        isLoading={mutations.busy} onConfirm={() => { void confirmPlanAction(); }} onClose={() => setConfirmation(undefined)} />}
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
