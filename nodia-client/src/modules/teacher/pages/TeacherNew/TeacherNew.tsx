import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Button, Stack, Typography } from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import useAuth from "../../../../hooks/useAuth";
import SessionFields from "../../components/SessionForm/SessionFields";
import { sessionFormDefaults, sessionPayload } from "../../components/SessionForm/formValues";
import SelectionPanel from "../../components/SelectionPanel";
import RequestRecovery from "../../components/RequestRecovery";
import { NODIA_TEACHER_ROUTE } from "../../constants/routes";
import { createSessionSchema, type CommandResult, type CreateSession, type Selection } from "../../infrastructure/schemas";
import { useTeacherCommand } from "../../infrastructure/useServices";
import { Header, Page, Panel, ProductBrand } from "../Teacher/styles";
import { CreateActions, NewPlanForm } from "./styles";

function NewSession() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const command = useTeacherCommand();
  const [selectionState, setSelectionState] = useState<{ selection: Selection | null; ready: boolean }>({ selection: null, ready: false });
  const onSelectionChange = useCallback((state: { selection: Selection | null; ready: boolean }) => setSelectionState(state), []);
  const { control, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<CreateSession>({
    resolver: zodResolver(createSessionSchema),
    defaultValues: sessionFormDefaults(i18n.resolvedLanguage ?? "es"),
  });
  useEffect(() => {
    if (!isDirty && !isSubmitting) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty, isSubmitting]);
  const busy = command.blocked || isSubmitting;
  const openSession = (result: CommandResult) => {
    if (result.session_id) void navigate(`${NODIA_TEACHER_ROUTE}/${result.session_id}`);
  };
  const createPlan = async (value: CreateSession) => {
    if (command.blocked || !selectionState.ready || !selectionState.selection) return;
    const result = await command.execute("sessions", { ...sessionPayload(value), selection: selectionState.selection, start_plan: true });
    if (result) openSession(result);
  };
  const saveDraft = async (value: CreateSession) => {
    if (command.blocked) return;
    const result = await command.execute("sessions", { ...sessionPayload(value), ...(selectionState.selection ? { selection: selectionState.selection } : {}), start_plan: false });
    if (result) openSession(result);
  };
  return <Page>
    <Button variant="contained" component={Link} to={NODIA_TEACHER_ROUTE} startIcon={<ArrowBackOutlined />} disabled={busy} sx={{ alignSelf: "flex-start", width: { xs: "100%", sm: "auto" } }}>{t("teacher:my_plans")}</Button>
    <Header><Box><ProductBrand variant="overline" color="primary">{t("teacher:product")}</ProductBrand><Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>{t("teacher:new_session")}</Typography><Typography color="text.secondary">{t("teacher:new_session_description")}</Typography></Box></Header>
    <RequestRecovery command={command} onRecovered={openSession} />
    <NewPlanForm onSubmit={handleSubmit(createPlan)}>
      <Panel><Stack sx={{ gap: 2 }}><SessionFields control={control} errors={errors} busy={busy} /></Stack></Panel>
      <Panel><SelectionPanel intent="create" initial={null} busy={busy} onSelectionChange={onSelectionChange} /></Panel>
      <CreateActions><Button type="button" variant="contained" disabled={busy} onClick={handleSubmit(saveDraft)}>{t("teacher:save_draft")}</Button><Button type="submit" variant="contained" disabled={busy || !selectionState.ready}>{t("teacher:create_plan")}</Button></CreateActions>
    </NewPlanForm>
  </Page>;
}

export default function TeacherNew() {
  const { user, sessionVersion } = useAuth();
  return <NewSession key={`${user?.id}:${sessionVersion}`} />;
}
