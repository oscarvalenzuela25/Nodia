import { useEffect, useId, useRef, useState } from "react";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, IconButton, Pagination, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import TextInput from "../../../../components/inputs/TextInput";
import {
  classifyStudyCalendarImportCategories,
  fitsStudyCalendarImportRequest,
  parseStudyCalendarImport,
  type StudyCalendarImportPlan,
  type StudyCalendarImportResult,
} from "../../infrastructure/studyCalendarImport";
import { AdaptiveDrawer, DrawerHeader } from "../AdaptiveWorkspace/styles";
import { Actions, ActivityList, CopyFallback, ReviewContent, Tools } from "./styles";

type Props = {
  open: boolean;
  onClose: () => void;
  categories: readonly { name: string; active: boolean }[];
  categoriesReady?: boolean;
  isBusy: boolean;
  uncertain?: boolean;
  onConfirm: (plan: StudyCalendarImportPlan, newCategories: string[]) => void;
  onRetry?: () => void;
};

type ImportReview = Extract<StudyCalendarImportResult, { ok: true }> & {
  categories: ReturnType<typeof classifyStudyCalendarImportCategories>;
};
type ImportIssue = Extract<StudyCalendarImportResult, { ok: false }>["issue"];

const namespace = "teacher_study_calendar_import";
const pageSize = 8;

export function StudyCalendarImportDrawer({ open, onClose, ...props }: Props) {
  const { t } = useTranslation(namespace);
  const titleId = useId();
  const close = () => { if (!props.isBusy) onClose(); };

  return <AdaptiveDrawer anchor="right" open={open} onClose={close}
    slotProps={{ paper: { role: "dialog", "aria-modal": true, "aria-labelledby": titleId } }}>
    <DrawerHeader>
      <Typography id={titleId} variant="h6" component="h2">{t("title")}</Typography>
      <IconButton aria-label={t("core:close")} onClick={close} disabled={props.isBusy}><CloseOutlined /></IconButton>
    </DrawerHeader>
    <ImportEditor {...props} onClose={close} />
  </AdaptiveDrawer>;
}

function ImportEditor({
  categories, categoriesReady = true, isBusy, uncertain = false, onConfirm, onRetry, onClose,
}: Omit<Props, "open">) {
  const { t } = useTranslation(namespace);
  const inputId = useId();
  const errorId = useId();
  const helpId = useId();
  const reviewTitleId = useId();
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const copying = useRef(false);
  const [input, setInput] = useState("");
  const [review, setReview] = useState<ImportReview | null>(null);
  const [issue, setIssue] = useState<ImportIssue | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);

  useEffect(() => {
    if (review) reviewTitle.current?.focus();
  }, [review]);

  const example = JSON.stringify({
    version: 1,
    title: t("example.title"),
    categories: [t("example.category")],
    schedule: { kind: "numbered", days: 2 },
    days: [{
      day: 1,
      title: t("example.day"),
      minutes: 30,
      activities: [{
        text: t("example.lesson"),
        source: { label: t("example.lesson_source"), url: "https://www.pacho8a.com/cursoinglesdesdeceroleccion1/" },
      }, {
        text: t("example.exercise"),
        source: { label: t("example.exercise_source"), url: "https://www.curso-ingles.com/practicar/ejercicios/to-be" },
      }, { text: t("example.practice") }],
    }],
  }, null, 2);
  const currentCategories = review && classifyStudyCalendarImportCategories(review.plan.categories ?? [], categories);
  const categoriesChanged = review && JSON.stringify(currentCategories) !== JSON.stringify(review.categories);
  const tooLarge = review && !fitsStudyCalendarImportRequest(review.plan, review.categories.newCategories);
  const writeLocked = isBusy || uncertain;
  const canConfirm = review && categoriesReady && !writeLocked && !categoriesChanged && !tooLarge && review.categories.inactive.length === 0;

  function changeInput(value: string) {
    setInput(value);
    setIssue(null);
    setReview(null);
  }

  function reviewPlan() {
    const parsed = parseStudyCalendarImport(input);
    if (!parsed.ok) {
      setIssue(parsed.issue);
      setReview(null);
      document.getElementById(inputId)?.focus();
      return;
    }
    setIssue(null);
    setReview({ ...parsed, categories: classifyStudyCalendarImportCategories(parsed.plan.categories ?? [], categories) });
  }

  async function copyTemplate() {
    if (copying.current) return;
    const template = t("agent_template", { example });
    copying.current = true;
    setCopyBusy(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(template);
      setCopyFallback(null);
      sileo.success({ title: t("copied") });
    } catch {
      setCopyFallback(template);
      sileo.error({ title: t("copy_failed"), description: t("copy_manual") });
    } finally {
      copying.current = false;
      setCopyBusy(false);
    }
  }

  const issueMessage = issue && t("errors." + issue.code, { field: issue.field });
  const activityMessage = issue?.activityIndex && issueMessage
    ? t("activity_problem", { index: issue.activityIndex, message: issueMessage })
    : issueMessage;
  const errorMessage = issue?.dayIndex && activityMessage
    ? t("day_problem", { index: issue.dayIndex, message: activityMessage })
    : activityMessage;

  return <Stack spacing={2}>
    <Typography id={helpId} variant="body2" color="text.secondary">{t("instructions")}</Typography>
    {uncertain && <Alert severity="warning" action={onRetry && (
      <Button variant="outlined" color="inherit" disabled={isBusy} onClick={onRetry}>{t("retry_creation")}</Button>
    )}>{t("uncertain")}</Alert>}
    <Tools>
      <Button variant="outlined" startIcon={<ContentCopyOutlined />} loading={copyBusy} disabled={isBusy}
        onClick={() => void copyTemplate()}>{t("copy_template")}</Button>
      <Button variant="outlined" disabled={writeLocked} onClick={() => changeInput(example)}>{t("load_example")}</Button>
    </Tools>
    {copyFallback && <Stack spacing={1}>
      <Typography variant="body2">{t("copy_manual")}</Typography>
      <CopyFallback tabIndex={0} aria-label={t("copy_template")}>{copyFallback}</CopyFallback>
    </Stack>}
    <TextInput id={inputId} label={t("input_label")} value={input} multiline minRows={7} maxRows={14}
      disabled={writeLocked} error={Boolean(issue)} aria-describedby={issue ? errorId : helpId}
      onChange={(event) => changeInput(event.target.value)} />
    {errorMessage && <Alert id={errorId} severity="error">{errorMessage}</Alert>}
    {review && <ReviewContent aria-labelledby={reviewTitleId}>
      <Typography id={reviewTitleId} ref={reviewTitle} variant="subtitle1" component="h3" tabIndex={-1}>
        {t("review_title")}
      </Typography>
      <Typography variant="body2" role="status">
        {t("review_summary", { title: review.plan.title, count: review.dayCount, prepared: review.plan.days?.length ?? 0 })}
      </Typography>
      <CategoryGroup label={t("existing_categories")} names={review.categories.reused} />
      <CategoryGroup label={t("new_categories")} names={review.categories.newCategories} />
      {review.categories.inactive.length > 0 && <Alert severity="warning">
        {t("inactive_categories", { names: review.categories.inactive.join(", ") })}
      </Alert>}
      {categoriesChanged && <Alert severity="warning">{t("categories_changed")}</Alert>}
      {tooLarge && <Alert severity="error">{t("errors.payload_size")}</Alert>}
      <DayPreviews days={review.plan.days ?? []} disabled={isBusy} />
    </ReviewContent>}
    <Actions>
      <Button variant="outlined" disabled={isBusy} onClick={onClose}>{t("core:cancel")}</Button>
      <Button variant={review ? "outlined" : "contained"} disabled={writeLocked || !categoriesReady} onClick={reviewPlan}>{t("review")}</Button>
      {review && <Button variant="contained" loading={isBusy} disabled={!canConfirm}
        onClick={() => { if (canConfirm) onConfirm(review.plan, review.categories.newCategories); }}>
        {t("confirm")}
      </Button>}
    </Actions>
  </Stack>;
}

function CategoryGroup({ label, names }: { label: string; names: string[] }) {
  if (!names.length) return null;
  return <Stack spacing={0.5}>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
    <Stack direction="row" useFlexGap spacing={0.5} sx={{ flexWrap: "wrap" }}>
      {names.map((name) => <Chip key={name} size="small" label={name} />)}
    </Stack>
  </Stack>;
}

function DayPreviews({ days, disabled }: { days: NonNullable<StudyCalendarImportPlan["days"]>; disabled: boolean }) {
  const { t } = useTranslation(namespace);
  const [page, setPage] = useState(1);
  const pageCount = Math.ceil(days.length / pageSize);
  const orderedDays = [...days].sort((first, second) => (
    "day" in first && "day" in second ? first.day - second.day
      : "date" in first && "date" in second ? first.date.localeCompare(second.date)
        : 0
  ));
  if (!days.length) return null;

  return <Box>
    {orderedDays.slice((page - 1) * pageSize, page * pageSize).map((day) => {
      const key = "day" in day ? day.day : day.date;
      const label = "day" in day ? t("numbered_day", { index: day.day }) : t("dated_day", { date: day.date });
      const title = day.title ? t("day_with_title", { label, title: day.title }) : label;
      return <Accordion key={key} disabled={disabled} disableGutters
        slotProps={{ transition: { unmountOnExit: true } }}>
        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
          <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{title}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
            {day.minutes !== undefined && <Typography variant="body2">{t("minutes", { count: day.minutes })}</Typography>}
            {day.notes && <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{day.notes}</Typography>}
            {day.activities?.length ? <ActivityList>
              {day.activities.map((activity, index) => <li key={index}>
                <Typography variant="body2">{activity.text}</Typography>
                {activity.source && <Typography variant="caption" component="div" color="text.secondary">
                  {t("source", { label: activity.source.label, url: activity.source.url })}
                </Typography>}
              </li>)}
            </ActivityList> : <Typography variant="body2" color="text.secondary">{t("no_activities")}</Typography>}
          </Stack>
        </AccordionDetails>
      </Accordion>;
    })}
    {pageCount > 1 && <Pagination count={pageCount} page={page} disabled={disabled}
      size="small" siblingCount={0} boundaryCount={1} onChange={(_event, next) => setPage(next)}
      aria-label={t("pagination")} getItemAriaLabel={(type, value) => t("pagination_" + type, { page: value })}
      sx={{ mt: 1, "& .MuiPaginationItem-root": { minWidth: 44, minHeight: 44 } }} />}
  </Box>;
}
