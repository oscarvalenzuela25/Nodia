import { useCallback } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Stack, Typography } from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import useAuth from "../../../../hooks/useAuth";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import SessionFields from "../../components/SessionForm/SessionFields";
import SelectionPanel from "../../components/SelectionPanel";
import RequestRecovery from "../../components/RequestRecovery";
import { NODIA_TEACHER_ROUTE } from "../../constants/routes";
import { setupSteps, useStudySetup } from "../../hooks/useStudySetup";
import type { Selection } from "../../infrastructure/schemas";
import { Page, Panel, ProductBrand } from "../Teacher/styles";
import { CreateActions, NewPlanForm, SetupLayout, StepButton, StepList, StudyNote, SummaryEntry } from "./styles";

function NewSession() {
  const { t, i18n } = useTranslation();
  const {
    form, values, step, visited, busy, command, formRef, headingRef, goTo,
    contextOpen, setContextOpen, selectionState, setSelectionState, openSession,
    saveDraft, createProposal, blocker, leaveWithoutSaving, canSaveDraft,
  } = useStudySetup(i18n.resolvedLanguage ?? "es");
  const onSelectionChange = useCallback((state: { selection: Selection | null; ready: boolean }) => setSelectionState(state), [setSelectionState]);
  const stepKey = setupSteps[step];
  const summary = <Stack sx={{ gap: 2 }}>
    <Typography variant="body2" sx={{ fontWeight: 700 }}>{values.title?.trim() || values.topic}</Typography>
    <Accordion disableGutters elevation={0} sx={{ background: "transparent", "&::before": { display: "none" } }}>
    <AccordionSummary disabled={busy} expandIcon={<ExpandMoreOutlined />}><Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>{t("teacher:wizard.summary")}</Typography></AccordionSummary>
    <AccordionDetails><Box component="dl" sx={{ m: 0, display: "grid", gap: 2 }}>
      {(["title", "topic", "objective"] as const).map(name => values[name]?.trim() && <SummaryEntry key={name}><Typography component="dt" variant="caption" color="text.secondary">{t(`teacher:fields.${name}`)}</Typography><Typography component="dd" variant="body2">{values[name]}</Typography></SummaryEntry>)}
      <SummaryEntry><Typography component="dt" variant="caption" color="text.secondary">{t("teacher:fields.explanation_language")}</Typography><Typography component="dd" variant="body2">{i18n.exists(`teacher:languages.${values.explanation_language}`) ? t(`teacher:languages.${values.explanation_language}`) : values.explanation_language}</Typography></SummaryEntry>
      <SummaryEntry><Typography component="dt" variant="caption" color="text.secondary">{t("teacher:fields.organization")}</Typography><Typography component="dd" variant="body2">{t(`teacher:organization.${values.organization}`)}{values.organization === "days" && values.day_count !== null && t("teacher:wizard.day_count", { count: values.day_count })}</Typography></SummaryEntry>
      {(["declared_base", "context"] as const).map(name => values[name]?.trim() && <SummaryEntry key={name}><Typography component="dt" variant="caption" color="text.secondary">{t(`teacher:fields.${name}`)}</Typography><Typography component="dd" variant="body2">{values[name]}</Typography></SummaryEntry>)}
    </Box></AccordionDetails></Accordion>
    <Stack sx={{ gap: 1 }}><Button variant="outlined" disabled={busy} onClick={() => void goTo(0)}>{t("teacher:wizard.edit_goal")}</Button><Button variant="outlined" disabled={busy} onClick={() => void goTo(1)}>{t("teacher:wizard.edit_organization")}</Button></Stack>
  </Stack>;

  return <Page>
    <Button variant="outlined" component={Link} to={NODIA_TEACHER_ROUTE} startIcon={<ArrowBackOutlined />} disabled={command.isPending || form.formState.isSubmitting} sx={{ alignSelf: "flex-start", width: { xs: "100%", sm: "auto" } }}>{t("teacher:my_plans")}</Button>
    <Stack sx={{ gap: 1 }}><ProductBrand variant="overline" color="primary">{t("teacher:product")}</ProductBrand><Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>{t("teacher:wizard.title")}</Typography><Typography color="text.secondary">{t("teacher:wizard.intro")}</Typography></Stack>
    <RequestRecovery command={command} onRecovered={openSession} />
    <NewPlanForm ref={formRef} noValidate onSubmit={event => {
      if (step < 2) { event.preventDefault(); void goTo(step + 1); }
      else void createProposal(event);
    }}>
      <StepList aria-label={t("teacher:wizard.steps_label")}>
        {setupSteps.map((key, index) => <li key={key}><StepButton type="button" variant="outlined" aria-current={index === step ? "step" : undefined} aria-label={`${index + 1}. ${t(`teacher:wizard.steps.${key}`)}`} disabled={busy || index > visited} onClick={() => void goTo(index)}><Box component="span" className="step-number">{index < step ? <CheckOutlined fontSize="small" /> : index + 1}</Box><Box component="span" className="step-label">{t(`teacher:wizard.steps.${key}`)}</Box></StepButton></li>)}
      </StepList>
      <Stack sx={{ gap: 1 }}><Typography variant="overline" color="text.secondary">{t("teacher:wizard.step_count", { current: step + 1, total: 3 })}</Typography><Typography ref={headingRef} tabIndex={-1} component="h2" variant="h5" sx={{ fontWeight: 700, scrollMarginBlock: "80px" }}>{t(`teacher:wizard.steps.${stepKey}`)}</Typography><Typography variant="body2" color="text.secondary">{t(`teacher:wizard.descriptions.${stepKey}`)}</Typography></Stack>
      <SetupLayout>
        {step === 2 && <StudyNote sx={{ gridColumn: { lg: 2 }, gridRow: { lg: 1 } }}>{summary}</StudyNote>}
        <Stack sx={{ gap: 3, minWidth: 0, gridColumn: { lg: 1 }, gridRow: { lg: 1 } }}>
          <Panel>
            <Stack sx={{ gap: 3 }}>
              <Box hidden={step !== 0}><SessionFields control={form.control} errors={form.formState.errors} busy={busy} section="goal" /></Box>
              <Stack hidden={step !== 1} sx={{ gap: 3, display: step !== 1 ? "none" : undefined }}>
                <SessionFields control={form.control} errors={form.formState.errors} busy={busy} section="organization" />
                <Accordion expanded={contextOpen} onChange={(_, open) => setContextOpen(open)} disableGutters elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2, "&::before": { display: "none" } }}><AccordionSummary disabled={busy} expandIcon={<ExpandMoreOutlined />}><Typography variant="body2" sx={{ fontWeight: 600 }}>{t("teacher:wizard.add_context")}</Typography></AccordionSummary><AccordionDetails><SessionFields control={form.control} errors={form.formState.errors} busy={busy} section="context" /></AccordionDetails></Accordion>
              </Stack>
              {step === 2 && <Alert severity="info">{t("teacher:wizard.proposal_notice")}</Alert>}
              {visited === 2 && <Box hidden={step !== 2}><SelectionPanel intent="create" initial={null} busy={busy} onSelectionChange={onSelectionChange} /></Box>}
            </Stack>
          </Panel>
          <CreateActions>
            {step > 0 && <Button type="button" variant="outlined" disabled={busy} startIcon={<ArrowBackOutlined />} onClick={() => void goTo(step - 1)}>{t("teacher:wizard.previous")}</Button>}
            {step < 2 ? <Button type="submit" variant="contained" disabled={busy} endIcon={<ArrowForwardOutlined />}>{t("teacher:wizard.next")}</Button> : <>
              <Button type="button" variant="outlined" disabled={busy} onClick={() => void saveDraft()}>{t("teacher:wizard.save_draft")}</Button>
              <Button type="submit" variant="contained" loading={form.formState.isSubmitting || command.isPending} disabled={busy || !selectionState.ready}>{t("teacher:wizard.create_proposal")}</Button>
            </>}
          </CreateActions>
          <Typography variant="caption" color="text.secondary">{t(step === 2 ? "teacher:wizard.save_notice" : "teacher:wizard.local_notice")}</Typography>
        </Stack>
        {step !== 2 && <StudyNote><Stack sx={{ gap: 2 }}><Typography component="h3" variant="h6">{t("teacher:wizard.note_title")}</Typography><Typography variant="body2" color="text.secondary">{t("teacher:wizard.note_body")}</Typography><Typography variant="body2">{t(`teacher:wizard.notes.${stepKey}`)}</Typography></Stack></StudyNote>}
      </SetupLayout>
    </NewPlanForm>
    <ConfirmDialog open={blocker.state === "blocked"} title={t("teacher:wizard.exit_title")} message={t(command.uncertain ? "teacher:wizard.exit_uncertain" : "teacher:wizard.exit_message")} cancelText={t("teacher:wizard.keep_editing")} confirmText={t("teacher:wizard.leave")} onClose={() => blocker.reset?.()} onConfirm={leaveWithoutSaving} isLoading={Boolean(command.isPending || form.formState.isSubmitting)} additionalActions={canSaveDraft ? <Button variant="outlined" onClick={() => void saveDraft()}>{t("teacher:wizard.save_draft")}</Button> : undefined} />
  </Page>;
}

export default function TeacherNew() {
  const { user, sessionVersion } = useAuth();
  return <NewSession key={`${user?.id}:${sessionVersion}`} />;
}
