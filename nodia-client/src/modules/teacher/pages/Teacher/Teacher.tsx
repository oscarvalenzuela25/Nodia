import AdaptiveWorkspace from "../../components/AdaptiveWorkspace/AdaptiveWorkspace";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, LinearProgress, Menu, MenuItem, Pagination, Stack, Switch, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import AutoStoriesOutlined from "@mui/icons-material/AutoStoriesOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import LessonTopics from "../../components/LessonTopics";
import useAuth from "../../../../hooks/useAuth";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import InputSearch from "../../../../components/inputs/InputSearch";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import BaseModal from "../../../../components/BaseModal";
import RequestRecovery from "../../components/RequestRecovery";
import NewMaterialVersion from "../../components/NewMaterialVersion";
import SessionForm from "../../components/SessionForm";
import SelectionPanel from "../../components/SelectionPanel";
import PlanReview from "../../components/PlanReview";
import QuestionCard from "../../components/QuestionCard";
import { JobStatus } from "../../components/JobPanel";
import { useJobStatus } from "../../components/JobPanel/useJobStatus";
import TeacherLoading from "../../components/TeacherLoading";
import StudyJourney from "../../components/StudyJourney";
import SetupConversation from "../../components/SetupConversation";
import StudyContinuation from "../../components/StudyContinuation";
import DiagnosticEntry from "../../components/DiagnosticEntry/DiagnosticEntry";
import { lessonPreparationState, studyContinuation } from "../../infrastructure/studyContinuation";
import ReinforcementPanel from "../../components/ReinforcementPanel";
import { useReinforcementNavigation } from "../../infrastructure/useReinforcementNavigation";
import { useTeacherAttempt, useTeacherCommand, useTeacherMaterial, useTeacherMessages, useTeacherProposal, useTeacherQuestion, useTeacherSession, useTeacherSessions } from "../../infrastructure/useServices";
import { cursorBody, enabled, hasPreparingJob, nextAttemptId, readyJobResult, restoreAttempt, restoreJob, resultNotice } from "../../infrastructure/presentation";
import { setupDraftReceiptSchema, type Answer, type CommandResult, type Cursor, type Job, type Session } from "../../infrastructure/schemas";
import { useSetupDraft } from "../../hooks/useSetupDraft";
import { TEACHER_NEW_ROUTE } from "../../constants/routes";
import { SESSION_JOB_COLORS } from "../../infrastructure/sessionList";
import { Actions, ArchivedFilter, Header, LessonHeader, Page, Panel, PlanFilters, PlanGrid, PlanSearch, ProductBrand, SessionActions, SessionPage, SessionTitleRow, StateChip, Workspace } from "./styles";

const SESSION_STATE_COLORS = {
  draft: "default",
  active: "info",
  paused: "warning",
  completed: "success",
  archived: "error",
} as const;

function Plans() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const sessions = useTeacherSessions(page, search, archived);
  const command = useTeacherCommand();
  const openResult = (result: CommandResult) => { if (result.session_id) void navigate(`/nodia-teacher/${result.session_id}`); };
  return <Page>
    <Header><Box><ProductBrand variant="overline" color="primary">{t("teacher:product")}</ProductBrand><Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>{t("teacher:my_plans")}</Typography><Typography color="text.secondary">{t("teacher:plans_description")}</Typography></Box><Button variant="contained" startIcon={<AddOutlined />} disabled={command.blocked || sessions.isFetching} component={Link} to={TEACHER_NEW_ROUTE}>{t("teacher:new_session")}</Button></Header>
    <RequestRecovery command={command} onRecovered={openResult} />
    <PlanFilters>
      <PlanSearch><InputSearch value={search} onChange={value => { setSearch(value); setPage(1); }} placeholder={t("teacher:search")} disabled={command.blocked || sessions.isFetching} /></PlanSearch>
      <ArchivedFilter control={<Switch checked={archived} disabled={command.blocked || sessions.isFetching} onChange={(_, value) => { setArchived(value); setPage(1); }} />} label={t("teacher:show_archived")} />
    </PlanFilters>
    <QueryErrorAlert retryVariant="outlined" isError={sessions.isError} isFetching={sessions.isFetching} onRetry={sessions.refetch} />
    {sessions.isFetching && !sessions.isLoading && <LinearProgress />}
    <TeacherLoading loading={sessions.isLoading && !sessions.data}>
      {!sessions.isError && !sessions.data?.data.length ? <Panel sx={{ py: 6, textAlign: "center" }}><AutoStoriesOutlined sx={{ fontSize: 48, color: "primary.main", mb: 2 }} /><Typography variant="h6">{t("teacher:empty_title")}</Typography><Typography color="text.secondary" sx={{ mb: 3 }}>{t("teacher:empty_description")}</Typography><Button variant="outlined" disabled={command.blocked || sessions.isFetching} component={Link} to={TEACHER_NEW_ROUTE}>{t("teacher:new_session")}</Button></Panel> : <PlanGrid>{sessions.data?.data.map(session => <Panel key={session.id} sx={{ display: "flex", flexDirection: "column", gap: 2 }}><Box><Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", mb: 2 }}><StateChip label={t(`teacher:states.${session.state}`)} color={SESSION_STATE_COLORS[session.state]} size="small" />{session.latest_job && <StateChip label={t(`teacher:jobs.${session.latest_job.state}`)} color={SESSION_JOB_COLORS[session.latest_job.state]} variant="outlined" size="small" sx={{ maxWidth: "100%", height: "auto", minHeight: 24, "& .MuiChip-label": { whiteSpace: "normal", py: 0.5 } }} />}</Stack>{sessions.isError && session.latest_job && <Typography variant="caption" color="text.secondary">{t("teacher:job_last_known_state")}</Typography>}<Typography variant="h6" component="h2">{session.title || session.topic}</Typography></Box><Typography color="text.secondary">{session.objective}</Typography><Button component={Link} to={`/nodia-teacher/${session.id}`} variant="contained" disabled={command.blocked || sessions.isFetching} sx={{ mt: "auto", minHeight: 44 }}>{t("teacher:open_plan")}</Button></Panel>)}</PlanGrid>}
    </TeacherLoading>
    {sessions.data && sessions.data.meta.total_pages > 1 && <Pagination variant="outlined" page={page} count={sessions.data.meta.total_pages} disabled={sessions.isFetching || command.blocked} onChange={(_, value) => setPage(value)} />}
  </Page>;
}

function TeacherSession({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const session = useTeacherSession(sessionId);
  const command = useTeacherCommand();
  return <SessionPage>
    <Button variant="contained" component={Link} to="/nodia-teacher" startIcon={<ArrowBackOutlined />} sx={{ alignSelf: "flex-start", minHeight: 44 }}>{t("teacher:my_plans")}</Button>
    {!session.data && <RequestRecovery command={command} onRecovered={() => { void session.refetch(); }} />}
    <QueryErrorAlert retryVariant="outlined" isError={session.isError} isFetching={session.isFetching} onRetry={session.refetch} />
    {session.isFetching && !session.isLoading && <LinearProgress />}
    <TeacherLoading loading={session.isLoading && !session.data}>
      {session.data && <SessionWorkspace key={sessionId} session={session.data} busy={session.isFetching || command.blocked} fetching={session.isFetching} command={command} />}
    </TeacherLoading>
  </SessionPage>;
}

type WorkspaceProps = { session: Session; busy: boolean; fetching: boolean; command: ReturnType<typeof useTeacherCommand> };
function SessionWorkspace({ session, busy, fetching, command }: WorkspaceProps) {
  const { t } = useTranslation();
  const [messagePage, setMessagePage] = useState(1);
  const [selectionReady, setSelectionReady] = useState(false);
  const [selectionDirty, setSelectionDirty] = useState(false);
  const [recordingMessage, setRecordingMessage] = useState(false);
  const [jobSelection, setJobSelection] = useState(() => restoreJob(session));
  const jobId = jobSelection.jobId;
  const [proposalId, setProposalId] = useState<string | null>(session.latest_proposal?.id ?? null);
  const [unitId, setUnitId] = useState<string | null>(session.cursor.unit_id);
  const initialAttempt = restoreAttempt(session.cursor, session.active_attempts);
  const [attemptId, setAttemptId] = useState<string | null>(initialAttempt.attemptId);
  const [questionId, setQuestionId] = useState<string | null>(initialAttempt.questionId);
  const [draftAnswer, setDraftAnswer] = useState<Answer | null>(null);
  const [draftConflict, setDraftConflict] = useState(false);
  const [localCursor, setLocalCursor] = useState<Cursor>(session.cursor);
  const initialReadingPoint = useRef<Cursor | null>(session.cursor);
  const [helpOpen, setHelpOpen] = useState(false);
  const [adaptiveOpen, setAdaptiveOpen] = useState(false);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const lessonHeading = useRef<HTMLHeadingElement>(null);
  const assessmentHeading = useRef<HTMLHeadingElement>(null);
  const [archiving, setArchiving] = useState(false);
  const [editingSession, setEditingSession] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [revising, setRevising] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [outlineExpanded, setOutlineExpanded] = useState(!session.cursor.unit_id && !session.cursor.attempt_id);
  const messages = useTeacherMessages(session.id, messagePage);
  const proposal = useTeacherProposal(session.id, proposalId ?? session.latest_proposal?.id ?? null);
  const plan = session.current_plan;
  const materialPlanId = localCursor.plan_revision_id && localCursor.plan_revision_id !== plan?.id ? null : plan?.id ?? null;
  const material = useTeacherMaterial(session.id, unitId, materialPlanId);
  const lesson = material.data;
  const attempt = useTeacherAttempt(session.id, attemptId);
  const question = useTeacherQuestion(session.id, attemptId, questionId ?? attempt.data?.questions[0]?.question_id ?? null);
  const proposalView = proposal.data ?? session.latest_proposal ?? (revising ? plan : null);
  const baseProposal = useTeacherProposal(session.id, proposalView?.state === "candidate" ? proposalView.base_revision_id ?? null : null);
  const comparing = Boolean(proposalView?.state === "candidate" && proposalView.base_revision_id);
  const active = session.state !== "paused" && session.state !== "archived";
  const reinforcementNavigation = useReinforcementNavigation(session.id, `${plan?.id}:${attemptId}:${attempt.data?.state}:${attempt.data?.result}:${session.state}`);
  const locked = busy || !active || reinforcementNavigation.pending;
  const preparing = hasPreparingJob(session.active_jobs);
  const archiveOnly = enabled(session.allowed_actions, "archive")
    && !enabled(session.allowed_actions, "edit")
    && !(plan && enabled(session.allowed_actions, "activate_revision"))
    && !enabled(session.allowed_actions, "start_diagnostic")
    && !enabled(session.allowed_actions, "unarchive");
  const refreshTeacher = command.refresh;

  const applyResult = useCallback((result: CommandResult) => {
    if (result.job_id) setJobSelection({ jobId: result.job_id, followResult: true });
    if (result.proposal_revision_id) setProposalId(result.proposal_revision_id);
    if (result.attempt_id && result.attempt_id !== attemptId) { setAttemptId(result.attempt_id); setQuestionId(null); }
  }, [attemptId]);
  const onTerminal = useCallback((job: Job) => {
    void refreshTeacher(`jobs/${job.job_id}`);
  }, [refreshTeacher]);
  const onReady = useCallback((job: Job) => {
    const ref = readyJobResult(job, jobSelection);
    if (ref && typeof ref.proposal_revision_id === "string") setProposalId(ref.proposal_revision_id);
    const nextAttempt = nextAttemptId(ref, attemptId);
    if (nextAttempt) { setAttemptId(nextAttempt); setQuestionId(null); }
    void refreshTeacher(ref && typeof ref.attempt_id === "string" ? `sessions/${session.id}/attempts/${ref.attempt_id}` : `jobs/${job.job_id}`);
  }, [jobSelection, attemptId, session.id, refreshTeacher]);
  const jobStatus = useJobStatus(jobId, !active, { onReady, onTerminal });
  const execute = async (path: string, body: Record<string, unknown>, method: "POST" | "PATCH" = "POST") => {
    const result = await command.execute(path, body, method);
    if (result) applyResult(result);
    return result;
  };
  const messageDraft = useSetupDraft({ text: session.setup_draft_text, revision: session.setup_draft_revision, busy: busy || recordingMessage, editable: active,
    onSave: async (text, revision) => {
      const result = await execute(`sessions/${session.id}/setup-draft`, { expected_draft_revision: revision, text }, "PATCH");
      const receipt = setupDraftReceiptSchema.safeParse(result);
      return receipt.success ? receipt.data : null;
    },
  });
  const stateCommand = async (state: "pause" | "resume" | "archive" | "unarchive") => {
    if (state === "pause" && (draftConflict || messageDraft.conflict || !messageDraft.valid)) return;
    const body: Record<string, unknown> = { expected_session_revision: session.revision };
    if (state === "pause") {
      if (messageDraft.pending) body.pending_setup_draft = messageDraft.pending;
      body.expected_cursor_revision = session.cursor.revision;
      body.cursor = cursorBody(studyCursor());
      if (draftAnswer && attempt.data && question.data) {
        body.attempt_id = attempt.data.attempt_id;
        body.expected_attempt_revision = attempt.data.revision;
        body.pending_responses = [{ question_id: question.data.question_id, expected_response_revision: question.data.response_revision, answer: draftAnswer }];
      }
    }
    const result = await execute(`sessions/${session.id}/${state}`, body);
    if (result) setDraftAnswer(null);
    return result;
  };
  const saveCursor = async (cursor: Cursor) => {
    const result = await execute(`sessions/${session.id}/cursor`, { expected_cursor_revision: session.cursor.revision, ...cursorBody(cursor) }, "PATCH");
    if (result) setLocalCursor(cursor);
    return result;
  };
  const studyCursor = (): Cursor => attempt.data && attemptId ? { ...localCursor, phase: attempt.data.scope === "section_final" ? "final" : attempt.data.scope === "diagnostic" ? "review" : "practice", plan_revision_id: attempt.data.plan_revision_id ?? null, section_id: attempt.data.section_id ?? null, unit_id: attempt.data.unit_id ?? null, content_version_id: attempt.data.scope === "unit_practice" && material.data?.kind === "material" ? material.data.content_version_id : null, attempt_id: attemptId, item_id: question.data?.question_id ?? null, block_id: null } : localCursor;
  const startAttempt = async (kind: "units" | "sections", id: string, newAttempt = false, route: "direct" | "after_study" = "direct") => {
    setHint(null); setOutlineExpanded(false); const result = await execute(`sessions/${session.id}/${kind}/${id}/attempts`, { plan_revision_id: plan?.id, expected_session_revision: session.revision, entry_route: kind === "units" ? "practice" : route, new_attempt: newAttempt });
    if (result?.attempt_id) { setLocalCursor({ ...localCursor, phase: kind === "units" ? "practice" : "final", plan_revision_id: plan?.id ?? null, attempt_id: result.attempt_id, section_id: kind === "sections" ? id : localCursor.section_id, unit_id: kind === "sections" ? null : id, content_version_id: null, item_id: null, block_id: null }); }
  };
  useEffect(() => {
    const saved = initialReadingPoint.current;
    if (!saved?.block_id) return;
    if (saved.unit_id !== unitId || attemptId || (material.data && material.data.kind !== "material")) {
      initialReadingPoint.current = null;
      return;
    }
    if (material.data?.kind !== "material") return;
    initialReadingPoint.current = null;
    if (material.data.content_version_id === saved.content_version_id) {
      document.getElementById(`teacher-block-${saved.block_id}`)?.scrollIntoView({ block: "start" });
    }
  }, [material.data, unitId, attemptId]);
  const saveAnswer = async (answer: Answer, expectedRevision: number) => {
    if (!attempt.data || !question.data) return null;
    const result = await execute(`sessions/${session.id}/attempts/${attempt.data.attempt_id}/responses`, { expected_attempt_revision: attempt.data.revision, responses: [{ question_id: question.data.question_id, expected_response_revision: expectedRevision, answer }] }, "PATCH");
    return result?.responses?.find(response => response.question_id === question.data?.question_id)?.response_revision ?? null;
  };

  const openReinforcement = async (targetUnitId: string) => {
    const projection = attempt.data?.reinforcement;
    if (locked || draftAnswer || !projection) return;
    const cursor = await reinforcementNavigation.open({ projection, currentPlanId: plan?.id ?? null, unitId: targetUnitId, cursor: session.cursor },
      value => command.execute(`sessions/${session.id}/cursor`, { expected_cursor_revision: value.revision, ...cursorBody(value) }, "PATCH"));
    if (cursor) { setLocalCursor(cursor); setUnitId(cursor.unit_id); setAttemptId(null); setQuestionId(null); setHint(null); setOutlineExpanded(false); }
  };
  const chooseTheoryUnit = async () => {
    if (locked || draftAnswer) return;
    const cursor: Cursor = { ...session.cursor, phase: "setup", plan_revision_id: plan?.id ?? null, section_id: null, unit_id: null, content_version_id: null, attempt_id: null, item_id: null, block_id: null };
    const saved = await reinforcementNavigation.choose(cursor, value => command.execute(`sessions/${session.id}/cursor`, { expected_cursor_revision: value.revision, ...cursorBody(value) }, "PATCH"));
    if (saved) { setLocalCursor(saved); setUnitId(null); setAttemptId(null); setQuestionId(null); setOutlineExpanded(true); }
  };

  const selectUnit = async (sectionId: string, nextUnitId: string) => {
    if (locked || draftAnswer || draftConflict || recordingMessage || !plan?.outline.sections.some(section => section.id === sectionId && section.units.some(unit => unit.id === nextUnitId))) return;
    const cursor: Cursor = { ...session.cursor, phase: "setup", plan_revision_id: plan.id, section_id: sectionId, unit_id: nextUnitId, content_version_id: null, attempt_id: null, item_id: null, block_id: null };
    const saved = await reinforcementNavigation.choose(cursor, value => command.execute(`sessions/${session.id}/cursor`, { expected_cursor_revision: value.revision, ...cursorBody(value) }, "PATCH"));
    if (saved) { setLocalCursor(saved); setUnitId(nextUnitId); setAttemptId(null); setQuestionId(null); setHint(null); setOutlineExpanded(false); }
  };
  const continuationContext = plan ? { plan, cursor: localCursor, selectedUnitId: unitId, attemptId,
    attemptPlanRevisionId: attempt.data?.attempt_id === attemptId ? attempt.data?.plan_revision_id : undefined,
    material: material.data, allowedActions: session.allowed_actions, paused: !active } : null;
  const continuation = continuationContext ? studyContinuation(continuationContext) : null;
  const lessonJobId = continuation?.jobId ?? null;
  // A different session job can still be in progress while this lesson is open.
  const otherLessonJobId = active && lessonJobId !== jobId && material.data?.kind === "availability"
    && material.data.state === "preparing" ? lessonJobId : null;
  const otherLessonJob = useJobStatus(otherLessonJobId, !active, { onReady: onTerminal, onTerminal });
  const lessonJob = otherLessonJobId ? otherLessonJob : jobStatus;
  const preparationState = lessonPreparationState(continuation, lessonJob.data, !active);
  const prepareLesson = async (targetUnitId: string) => {
    if (locked || material.isFetching || !continuationContext) return;
    if (continuation?.kind !== "prepare" || !continuation.canPrepare || continuation.target?.unitId !== targetUnitId) return;
    await execute(`sessions/${session.id}/units/${targetUnitId}/material`, { plan_revision_id: plan?.id, expected_session_revision: session.revision, variant: "current" });
  };
  const focusStudy = () => {
    const block = material.data?.kind === "material" && material.data.content_version_id === localCursor.content_version_id && localCursor.block_id
      ? document.getElementById(`teacher-block-${localCursor.block_id}`) : null;
    const target = attemptId ? assessmentHeading.current : block ?? lessonHeading.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start" });
  };

  const assessmentView = attemptId ? <Panel><QueryErrorAlert retryVariant="outlined" isError={attempt.isError || question.isError} isFetching={attempt.isFetching || question.isFetching} onRetry={() => { void attempt.refetch(); void question.refetch(); }} />
          <TeacherLoading loading={attempt.isLoading && !attempt.data}>
            {attempt.data && <Stack sx={{ gap: 3 }}>
              <Typography ref={assessmentHeading} tabIndex={-1} variant="h5" component="h2">{t(attempt.data.scope === "section_final" ? "teacher:final_assessment" : attempt.data.scope === "diagnostic" ? "teacher:diagnostic" : "teacher:practice")}</Typography>
              <Box component="nav" aria-label={t("teacher:assessment_navigation")} sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(44px,1fr))", gap: 1, "& > button": { minHeight: 44, minWidth: 44, px: 0, whiteSpace: "nowrap" } }}>{attempt.data.questions.map((item, index) => <Button key={item.question_id} variant={question.data?.question_id === item.question_id ? "contained" : "outlined"} disabled={locked || attempt.isFetching || question.isFetching || (attempt.data?.scope !== "section_final" && attempt.data.state === "in_progress" && attempt.data.questions.findIndex(item => item.answer_status !== "submitted") >= 0 && index > attempt.data.questions.findIndex(item => item.answer_status !== "submitted"))} aria-label={t("teacher:question_number", { number: index + 1 })} onClick={() => { if (draftAnswer) return; setQuestionId(item.question_id); setHint(null); void saveCursor({ ...studyCursor(), item_id: item.question_id }); }}>{index + 1}</Button>)}</Box>
              {question.isLoading && !question.data && <TeacherLoading loading />}
              {question.data && <QuestionCard key={question.data.question_id} question={question.data} busy={locked || attempt.isFetching || question.isFetching} canSave={enabled(attempt.data.allowed_actions, "save_answers")} canSubmit={enabled(attempt.data.allowed_actions, "submit_question")} final={attempt.data.scope === "section_final"} delivered={attempt.data.state !== "in_progress"} onDraft={setDraftAnswer} onConflictChange={setDraftConflict} onSave={saveAnswer} onReflectionSave={async metadata => { if (!question.data?.response_id) return false; const result = await execute(`sessions/${session.id}/learning/response-metadata`, { expected_session_revision: session.revision, response_id: question.data.response_id, expected_response_revision: question.data.response_revision, ...metadata }); return result !== null; }} onSubmit={async answer => { const result = await execute(`sessions/${session.id}/attempts/${attemptId}/responses/${question.data!.question_id}/submit`, { expected_attempt_revision: attempt.data!.revision, expected_response_revision: question.data!.response_revision, answer }); if (result) setDraftAnswer(null); }} />}
              {draftAnswer && <Alert severity="warning">{t("teacher:save_before_navigation")}</Alert>}
              {enabled(attempt.data.allowed_actions, "request_help") && <Button variant="outlined" disabled={locked || Boolean(draftAnswer)} onClick={() => setHelpOpen(true)}>{t("teacher:request_help")}</Button>}
              {hint && <Alert severity="info"><Typography variant="subtitle2">{t("teacher:hint")}</Typography>{hint}</Alert>}
              <ConfirmDialog open={helpOpen} onClose={() => { if (!busy) setHelpOpen(false); }} title={t("teacher:request_help")} message={t("teacher:assisted_final_notice")} confirmText={t("teacher:accept_help")} isLoading={busy} onConfirm={async () => { if (!question.data) return; const result = await execute(`sessions/${session.id}/attempts/${attemptId}/help`, { expected_attempt_revision: attempt.data!.revision, question_id: question.data.question_id, accept_assisted_attempt: true }); if (result) { setHelpOpen(false); setHint(result.hint ?? null); } }}><RequestRecovery command={command} onRecovered={result => { applyResult(result); setHelpOpen(false); setHint(result.hint ?? null); }} /></ConfirmDialog>
              {enabled(attempt.data.allowed_actions, "submit_attempt") && <Button variant="contained" disabled={locked || Boolean(draftAnswer)} onClick={() => void execute(`sessions/${session.id}/attempts/${attemptId}/submit`, { expected_attempt_revision: attempt.data!.revision })}>{t(attempt.data.scope === "section_final" ? "teacher:submit_final" : "teacher:finish_practice")}</Button>}
              {attempt.data.state !== "in_progress" && <Alert severity={attempt.data.result === "passed" ? "success" : attempt.data.result === "not_passed" ? "warning" : "info"}><Typography variant="h6">{t(`teacher:results.${resultNotice(attempt.data)}`)}</Typography>{attempt.data.earned_points !== null && attempt.data.earned_points !== undefined && attempt.data.denominator_points && <Typography>{t("teacher:points", { earned: attempt.data.earned_points, possible: attempt.data.denominator_points })}</Typography>}</Alert>}
              {attempt.data.result === "not_passed" && <><ReinforcementPanel projection={attempt.data.reinforcement} currentPlanId={plan?.id ?? null} busy={locked || attempt.isFetching || Boolean(draftAnswer)} failed={reinforcementNavigation.failed} onOpen={id => void openReinforcement(id)} onChooseUnit={() => void chooseTheoryUnit()} /><Actions>{enabled(attempt.data.allowed_actions, "new_attempt") && attempt.data.section_id && <Button variant="contained" disabled={locked} onClick={() => void startAttempt("sections", attempt.data!.section_id!, true)}>{t("teacher:retry_final")}</Button>}</Actions></>}
              {enabled(attempt.data.allowed_actions, "close_pending") && attempt.data.close_pending_reason && <Button variant="outlined" disabled={locked} onClick={() => void execute(`sessions/${session.id}/attempts/${attemptId}/close-pending`, { expected_attempt_revision: attempt.data!.revision, reason: attempt.data!.close_pending_reason })}>{t("teacher:close_pending")}</Button>}
            </Stack>}
          </TeacherLoading>
        </Panel> : null;

  return <SessionPage>
    {!editingSession && !selecting && !helpOpen && !archiving && !adaptiveOpen && !diagnosticOpen && <RequestRecovery command={command} onRecovered={result => {
      if (!result.thread_id) applyResult(result);
    }} />}
    <Header><Box sx={{ width: "100%", minWidth: 0 }}><ProductBrand variant="overline" color="primary">{t("teacher:product")}</ProductBrand><SessionTitleRow><Typography variant="h4" component="h1" sx={{ fontSize: { xs: "1.5rem", sm: "2.125rem" }, fontWeight: 700 }}>{session.title || session.topic}</Typography><StateChip label={t(`teacher:states.${session.state}`)} color={SESSION_STATE_COLORS[session.state]} /></SessionTitleRow><Typography color="text.secondary">{session.objective}</Typography></Box></Header>
    <SessionActions>
      {enabled(session.allowed_actions, "pause") && <Button disabled={busy || draftConflict || messageDraft.saving || messageDraft.conflict || !messageDraft.valid} variant="contained" onClick={() => void stateCommand("pause")}>{t("teacher:pause")}</Button>}
      {enabled(session.allowed_actions, "resume") && <Button disabled={busy} variant="contained" onClick={() => void stateCommand("resume")}>{t("teacher:resume")}</Button>}
      <Button variant="outlined" startIcon={<SchoolOutlined />} disabled={busy || recordingMessage || reinforcementNavigation.pending} aria-haspopup="dialog" aria-expanded={adaptiveOpen} onClick={() => setAdaptiveOpen(true)}>{t("teacher:adaptive.workspace")}</Button>
      {archiveOnly ? <Button variant="outlined" disabled={busy} onClick={() => setArchiving(true)}>{t("teacher:archive")}</Button> : <Button variant="outlined" disabled={busy} aria-haspopup="menu" aria-expanded={Boolean(optionsAnchor)} onClick={event => setOptionsAnchor(event.currentTarget)}>{t("teacher:session_options")}</Button>}
      {jobId && !(preparationState && lessonJobId === jobId) && <JobStatus presentation="inline" query={jobStatus} paused={!active} busy={busy} onContinue={async job => { await execute(`jobs/${jobId}/continue-before-dispatch`, { expected_session_revision: session.revision, expected_job_fence: job.fence }); }} onNew={async job => { await execute(`jobs/${jobId}/new-generation`, { expected_session_revision: session.revision, expected_job_fence: job.fence }); }} />}
    </SessionActions>
    <Menu anchorEl={optionsAnchor} open={Boolean(optionsAnchor)} onClose={() => setOptionsAnchor(null)} slotProps={{ list: { "aria-label": t("teacher:session_options") } }}>
      {enabled(session.allowed_actions, "edit") && <MenuItem disabled={busy} sx={{ minHeight: 44 }} onClick={() => { setOptionsAnchor(null); setEditingSession(true); }}>{t("teacher:edit_session")}</MenuItem>}
      {plan && enabled(session.allowed_actions, "edit") && <MenuItem disabled={busy} sx={{ minHeight: 44 }} onClick={() => { setOptionsAnchor(null); setSelecting(true); }}>{t("teacher:ai_selection")}</MenuItem>}
      {plan && enabled(session.allowed_actions, "activate_revision") && <MenuItem disabled={busy} sx={{ minHeight: 44 }} onClick={() => { setOptionsAnchor(null); setRevising(value => !value); }}>{t(revising ? "teacher:close_plan_review" : "teacher:review_plan")}</MenuItem>}
      {enabled(session.allowed_actions, "start_diagnostic") && <MenuItem disabled={busy || recordingMessage || reinforcementNavigation.pending || Boolean(draftAnswer) || draftConflict} sx={{ minHeight: 44 }} onClick={() => { setOptionsAnchor(null); setDiagnosticOpen(true); }}>{t("teacher:diagnostic")}</MenuItem>}
      {enabled(session.allowed_actions, "archive") && <MenuItem disabled={busy} sx={{ minHeight: 44 }} onClick={() => { setOptionsAnchor(null); setArchiving(true); }}>{t("teacher:archive")}</MenuItem>}
      {enabled(session.allowed_actions, "unarchive") && <MenuItem disabled={busy} sx={{ minHeight: 44 }} onClick={() => { setOptionsAnchor(null); void stateCommand("unarchive"); }}>{t("teacher:unarchive")}</MenuItem>}
    </Menu>
    <ConfirmDialog open={archiving} onClose={() => { if (!busy) setArchiving(false); }} title={t("teacher:archive")} message={session.title || session.topic} confirmText={t("teacher:archive")} isLoading={busy} onConfirm={async () => { const result = await stateCommand("archive"); if (result) setArchiving(false); }}><RequestRecovery command={command} onRecovered={result => { applyResult(result); setArchiving(false); }} /></ConfirmDialog>
    {editingSession && <SessionForm open initial={session} recovery={<RequestRecovery command={command} onRecovered={result => { applyResult(result); setEditingSession(false); }} />} busy={busy} onClose={() => setEditingSession(false)} onSave={async value => { const result = await execute(`sessions/${session.id}`, { ...value, title: value.title?.trim() || undefined, context: value.context || null, declared_base: value.declared_base || null, day_count: value.organization === "days" ? value.day_count : null, expected_session_revision: session.revision }, "PATCH"); if (result) setEditingSession(false); }} />}
    {selecting && <BaseModal open title={t("teacher:ai_selection")} onClose={() => { if (!busy) setSelecting(false); }}><RequestRecovery command={command} onRecovered={result => { applyResult(result); setSelecting(false); }} /><SelectionPanel initial={session.selection} busy={busy} onSave={async selection => { const result = await execute(`sessions/${session.id}`, { expected_session_revision: session.revision, selection }, "PATCH"); if (result) setSelecting(false); }} /></BaseModal>}
    {session.state === "paused" && <Alert severity="info">{t("teacher:paused_notice")}</Alert>}
    <Typography variant="body2" color="text.secondary">{t("teacher:budget", { used: session.dispatches_used, limit: session.dispatch_limit })}</Typography>
    {diagnosticOpen && <DiagnosticEntry session={session} open onClose={() => setDiagnosticOpen(false)} busy={busy || recordingMessage || reinforcementNavigation.pending}
      recovery={<RequestRecovery command={command} onRecovered={result => { applyResult(result); setDiagnosticOpen(false); }} />}
      onStart={async () => { if (locked || recordingMessage || draftAnswer || draftConflict) return false; return Boolean(await execute(`sessions/${session.id}/diagnostic-attempts`, { expected_session_revision: session.revision, entry_route: "diagnostic", new_attempt: false })); }} />}
    <AdaptiveWorkspace open={adaptiveOpen} onClose={() => setAdaptiveOpen(false)} session={session} command={command} busy={busy || reinforcementNavigation.pending} onResult={applyResult} onPractice={id => void startAttempt("units", id)} />
    {(!plan || revising) && <>
      {comparing && proposalView && <Panel><Stack sx={{ gap: 2 }}><Alert severity="info">{t("teacher:candidate_notice")}</Alert><PlanGrid>{[{ title: t("teacher:previous_proposal"), plan: baseProposal.data }, { title: t("teacher:candidate_proposal"), plan: proposalView }].map(item => <Box key={item.title}><Typography variant="subtitle1">{item.title}</Typography>{item.plan?.outline.sections.map(section => <Box key={section.id} sx={{ my: 2 }}><Typography variant="subtitle2">{section.title}</Typography>{section.units.map(unit => <Typography key={unit.id} variant="body2">{unit.title}</Typography>)}</Box>)}</Box>)}</PlanGrid><Actions><Button variant="contained" disabled={locked || !baseProposal.data} onClick={() => void execute(`sessions/${session.id}/plan-proposals/${proposalView.base_revision_id}/apply-candidate`, { candidate_id: proposalView.id, expected_base_revision_id: proposalView.base_revision_id, expected_base_hash: proposalView.base_hash, expected_session_revision: session.revision })}>{t("teacher:apply_candidate")}</Button><Button variant="outlined" disabled={locked || !baseProposal.data} onClick={() => setProposalId(proposalView.base_revision_id ?? null)}>{t("teacher:keep_previous")}</Button></Actions></Stack></Panel>}
      {proposal.isLoading && !proposalView && <TeacherLoading loading />}
      {proposalView && <Panel><PlanReview key={proposalView.id} plan={proposalView} busy={locked || comparing || preparing || Boolean(draftAnswer) || draftConflict || recordingMessage} futureRevision={Boolean(plan)} canAdjust={selectionReady && !selectionDirty} canAccept={!comparing && (plan ? proposalView.id !== plan.id && enabled(session.allowed_actions, "activate_revision") : enabled(session.allowed_actions, "accept_plan"))} onSave={async outline => { await execute(`sessions/${session.id}/plan-proposals/${proposalView.id}`, { expected_session_revision: session.revision, expected_proposal_hash: proposalView.content_hash, outline }, "PATCH"); }} onAccept={async () => { if (locked || draftAnswer || draftConflict || recordingMessage) return; const result = await execute(plan ? `sessions/${session.id}/plan-revisions/${proposalView.id}/activate` : `sessions/${session.id}/plan-proposals/${proposalView.id}/accept`, { expected_session_revision: session.revision, proposal_revision_id: proposalView.id, proposal_hash: proposalView.content_hash, ...(plan ? { expected_current_plan_revision_id: plan.id } : {}) }); if (result) { setRevising(false); setUnitId(null); setAttemptId(null); setQuestionId(null); setLocalCursor({ ...session.cursor, phase: "setup", plan_revision_id: proposalView.id, section_id: null, unit_id: null, content_version_id: null, attempt_id: null, item_id: null, block_id: null }); } }} onAdjust={async text => { if (locked || preparing || selectionDirty || !selectionReady) return; await execute(`sessions/${session.id}/plan-proposals`, { expected_session_revision: session.revision, base_proposal_id: proposalView.id, base_hash: proposalView.content_hash, adjustment_text: text, organization: proposalView.outline.organization, day_count: proposalView.outline.day_count }); }} /></Panel>}
    </>}
    {(!plan || revising) && proposalView && <Actions><Button variant="outlined" disabled={busy || recordingMessage} aria-expanded={planningOpen} aria-controls="teacher-planning-conversation" onClick={() => setPlanningOpen(value => !value)}>{t(planningOpen ? "teacher:review_ui.hide_conversation" : "teacher:review_ui.show_conversation")}</Button></Actions>}
    {(!plan || revising) && <Panel id="teacher-planning-conversation" hidden={Boolean(proposalView) && !planningOpen && !messageDraft.text.trim()} sx={{ p: { xs: 0, sm: 0 } }}><SetupConversation messages={messages} draft={messageDraft} showConversation={!plan || revising} scopeKey={session.id} contextKey={`${session.revision}:${JSON.stringify(session.selection)}`} page={messagePage} busy={locked} generating={preparing} hasSelection={Boolean(session.selection) && selectionReady && !selectionDirty} canPropose={enabled(session.allowed_actions, "propose_plan")} onPage={setMessagePage} onRecordingChange={setRecordingMessage}
        onDiagnostic={enabled(session.allowed_actions, "start_diagnostic") ? () => setDiagnosticOpen(true) : undefined} diagnosticDisabled={Boolean(draftAnswer) || draftConflict}
        footer={<SelectionPanel presentation="composer" initial={session.selection} busy={locked || preparing || recordingMessage || messageDraft.saving} onDirtyChange={setSelectionDirty} onReadyChange={setSelectionReady} onSave={async selection => { const result = await execute(`sessions/${session.id}`, { expected_session_revision: session.revision, selection }, "PATCH"); if (!result) throw new Error("Teacher selection was not confirmed"); }} />}
        onSend={() => { if (locked || preparing || recordingMessage || selectionDirty || !selectionReady) return; const text = messageDraft.text; void messageDraft.save().then(async saved => { if (!saved) return; const result = await execute(`sessions/${session.id}/messages`, { expected_session_revision: session.revision, expected_draft_revision: saved.setup_draft_revision, text, generate_reply: true }); const receipt = setupDraftReceiptSchema.safeParse(result); if (result) messageDraft.sent(text, receipt.success ? receipt.data : null); }); }}
        onPropose={async () => { if (locked || preparing || recordingMessage || selectionDirty || !selectionReady || messageDraft.text.trim()) return false; const saved = await messageDraft.save(); if (!saved) return false; return Boolean(await execute(`sessions/${session.id}/plan-proposals`, { expected_session_revision: session.revision, organization: session.requested_organization, day_count: session.requested_day_count })); }}
      /></Panel>}
    {!plan && assessmentView}
    {plan && <Workspace>
      <Panel><StudyJourney key={plan.id} outline={plan.outline} sectionStates={session.section_states} selectedUnitId={unitId} expanded={outlineExpanded} onExpandedChange={setOutlineExpanded} busy={locked || Boolean(draftAnswer) || draftConflict || recordingMessage}
        onSelectUnit={(sectionId, nextUnitId) => { void selectUnit(sectionId, nextUnitId); }}
        onStartFinal={sectionId => { void startAttempt("sections", sectionId); }} /></Panel>
      <Stack sx={{ gap: 3, minWidth: 0 }}>
        {continuation && <TeacherLoading loading={Boolean(unitId && !attemptId && materialPlanId && material.isLoading && !material.data)}><StudyContinuation view={continuation} paused={!active} preparationState={preparationState}
          jobReadError={lessonJob.isError ? { busy: lessonJob.isFetching, onRetry: lessonJob.refetch } : undefined}
          busy={busy || reinforcementNavigation.pending || recordingMessage || material.isFetching || attempt.isFetching || question.isFetching}
          onSelectUnit={(sectionId, nextUnitId) => { void selectUnit(sectionId, nextUnitId); }} onPrepare={id => { void prepareLesson(id); }} onOpen={focusStudy} onContinue={focusStudy}
          onInspectJob={id => { setJobSelection({ jobId: id, followResult: false }); }} onRefresh={() => { void material.refetch(); }} /></TeacherLoading>}
        {unitId && !attemptId && materialPlanId && (material.isError || lesson?.kind === "material") && <Panel>
          <QueryErrorAlert retryVariant="outlined" isError={material.isError} isFetching={material.isFetching} onRetry={material.refetch} />
          <TeacherLoading loading={material.isLoading && !material.data}>
            {lesson?.kind === "material" && <Stack sx={{ gap: 3 }}>
              <LessonHeader>
                <Typography variant="overline">{t("teacher:theory")}</Typography>
                <Typography ref={lessonHeading} tabIndex={-1} variant="h5" component="h2">
                  {plan.outline.sections.flatMap(section => section.units).find(unit => unit.id === unitId)?.title}
                </Typography>
              </LessonHeader>
              <LessonTopics blocks={lesson.blocks} contentVersionId={lesson.content_version_id} history={lesson.lesson_interactions}
                session={session} busy={locked || material.isFetching} command={command} onResult={applyResult}
                savedBlockId={session.cursor.content_version_id === lesson.content_version_id ? session.cursor.block_id : null}
                onSaveReadingPoint={blockId => saveCursor({
                  ...localCursor, phase: "theory", plan_revision_id: plan.id, unit_id: unitId,
                  content_version_id: lesson.content_version_id, block_id: blockId,
                })} />
              <Actions>
                {session.state === "active" && enabled(lesson.allowed_actions, "prepare_material") &&
                  <NewMaterialVersion sessionId={session.id} planRevisionId={plan.id} unitId={unitId} contentVersionId={lesson.content_version_id} sessionRevision={session.revision}
                    busy={fetching || material.isFetching || reinforcementNavigation.pending} command={command} onQueued={applyResult} />}
                <Button variant="contained" disabled={locked || !enabled(lesson.allowed_actions, "start_practice")} onClick={() => void startAttempt("units", unitId)}>
                  {t("teacher:start_practice")}
                </Button>
                <Button variant="outlined" disabled={locked || !enabled(session.allowed_actions, "start_section_final")} onClick={() => {
                  const section = plan.outline.sections.find(section => section.units.some(unit => unit.id === unitId));
                  if (section) void startAttempt("sections", section.id, false, "after_study");
                }}>{t("teacher:after_study_final")}</Button>
              </Actions>
            </Stack>}
          </TeacherLoading>
        </Panel>}
        {assessmentView}
      </Stack>
    </Workspace>}
  </SessionPage>;
}

export default function Teacher() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, sessionVersion } = useAuth();
  const scope = `${user?.id}:${sessionVersion}`;
  return sessionId ? <TeacherSession key={`${scope}:${sessionId}`} sessionId={sessionId} /> : <Plans key={scope} />;
}
