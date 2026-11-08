import { nodiaAiProviderResources, nodiaAiProviderRoute, nodiaAiProviderErrorKey } from "../../infrastructure/aiProviderPresentation";
import { nodiaAiCoreResources, nodiaAiCoreRoute, nodiaAiCoreErrorKey } from "../../infrastructure/corePresentation";
import { nodiaAiBusinessResources } from "../../infrastructure/businessPresentation";
import { Alert, Box, Button, LinearProgress, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import useAuth from "../../../../hooks/useAuth";
import { useNodiaAiExecution } from "../../infrastructure/useExecution";
import { Actions, Panel } from "./styles";
import { nodiaAiFinanceResources } from "../../infrastructure/financePresentation";
import { nodiaAiRentalResources, nodiaAiRentalErrorKey } from "../../infrastructure/rentalPresentation";
import { RENTAL_RESERVATIONS_ROUTE } from "../../../rentals/constants/routes";
import SecureInteraction from "../SecureInteraction";

export default function ConfirmedExecution(props: { conversationId: string; executionId: string; observed?: boolean }) {
  const { user, sessionVersion } = useAuth();
  return <ExecutionPanel key={JSON.stringify([user?.id, sessionVersion, props.conversationId, props.executionId])} {...props} />;
}
function ExecutionPanel({ conversationId, executionId, observed = true }: { conversationId: string; executionId: string; observed?: boolean }) {
  const { t } = useTranslation("nodiaAi");
  const query = useNodiaAiExecution(conversationId, executionId, observed);
  const execution = query.data;
  const busy = query.busy || query.isFetching;
  const canCancel = execution && (["queued", "running", "waiting_for_user"].includes(execution.state)
    || ["failed", "partially_completed"].includes(execution.state)
      && execution.steps.some(step => !["completed", "cancelled", "skipped"].includes(step.state)));
  return <Panel aria-label={t("execution.title")}>
    <Typography component="h5" variant="subtitle2">{t("execution.title")}</Typography>
    {query.isFetching && !query.isLoading && <LinearProgress aria-label={t("refreshing")} />}
    {query.isError && <Alert severity="error">{t("execution.load_error")}</Alert>}
    {query.uncertain && <Alert severity="warning">{t("execution.uncertain")}</Alert>}
    <Skeleton loading={query.isLoading}>
      {execution && <>
        <Typography role="status">{t("proposal.execution_status", { state: t(`proposal.execution_states.${execution.state}`) })}</Typography>
        {execution.state === "waiting_for_user" && !query.readOnly && <SecureInteraction conversationId={conversationId} executionId={executionId} disabled={busy || query.isError} />}
        {execution.state === "unknown" && <Alert severity="warning">{t("execution.unknown")}</Alert>}
        {execution.steps.length > 1 && execution.steps.some(step => step.state === "completed") && execution.state !== "completed" && <Alert severity="info">{t("execution.partial_effects")}</Alert>}
        {execution.steps.map((step, index) => <Box key={step.step_id}>
          <Typography variant="body2">{t("execution.step", { position: index + 1, state: t(`execution.step_states.${step.state}`) })}</Typography>
          {step.state === "completed" && step.result_refs.some(ref => ref.resource_key === "nodia_ai_preferences") && <Typography variant="body2">{t("preferences.receipt")}</Typography>}
          {step.error && <Typography color="error" variant="body2">{t(step.error.code === "nodia_ai:preconditions_changed" ? "proposal.preconditions_changed" : nodiaAiProviderErrorKey(step.error.code) ?? nodiaAiCoreErrorKey(step.error.code) ?? nodiaAiRentalErrorKey(step.error.code) ?? "execution.step_error")}</Typography>}
          {step.state === "completed" && step.result_refs.filter(ref => ref.resource_key === "secure_flows").map(ref => <Box key={ref.id}>
            <Typography variant="body2">{t("secure.receipt", { id: ref.id })}</Typography>
            <Typography variant="caption" component="p">{t("execution.historical_receipt")}</Typography>
          </Box>)}
          {step.state === "completed" && step.result_refs.filter(ref => nodiaAiProviderResources.some(resource => ref.resource_key === resource)).map(ref => <Box key={`${ref.resource_key}:${ref.id}`}>
            <Typography variant="body2">{t("execution.ai_provider_receipt", { id: ref.id, resource: t(`execution.ai_provider_resources.${ref.resource_key}`) })}</Typography>
            <Typography variant="caption" component="p">{t("execution.historical_receipt")}</Typography>
            <Typography variant="caption" component="p">{t("proposal.ai_provider_configuration_note")}</Typography>
            <Actions><Button variant="contained" component={Link} to={nodiaAiProviderRoute(ref.resource_key, ref.id)!} disabled={busy}>{t("execution.open_ai_providers")}</Button></Actions>
          </Box>)}
          {step.state === "completed" && step.result_refs.filter(ref => nodiaAiCoreResources.some(resource => ref.resource_key === resource)).map(ref => <Box key={`${ref.resource_key}:${ref.id}`}>
            <Typography variant="body2">{t("execution.core_receipt", { id: ref.id, resource: t(`execution.core_resources.${ref.resource_key}`) })}</Typography>
            <Typography variant="caption" component="p">{t("execution.historical_receipt")}</Typography>
            <Actions><Button variant="contained" component={Link} to={nodiaAiCoreRoute(ref.resource_key)!} disabled={busy}>{t("execution.open_core")}</Button></Actions>
          </Box>)}
          {step.state === "completed" && step.result_refs.filter(ref => nodiaAiFinanceResources.some(resource => ref.resource_key === resource)).map(ref => <Box key={`${ref.resource_key}:${ref.id}`}>
            <Typography variant="body2">{t("execution.financial_receipt", { id: ref.id, resource: t(`execution.financial_resources.${ref.resource_key}`) })}</Typography>
            <Typography variant="caption" component="p">{t("execution.historical_receipt")}</Typography>
            <Actions><Button variant="contained" component={Link} to="/finances-personal" disabled={busy}>{t("execution.open_finances")}</Button></Actions>
          </Box>)}
          {step.state === "completed" && step.result_refs.filter(ref => nodiaAiBusinessResources.some(resource => ref.resource_key === resource)).map(ref => <Box key={`${ref.resource_key}:${ref.id}`}>
            <Typography variant="body2">{t("execution.business_receipt", { id: ref.id, resource: t(`execution.business_resources.${ref.resource_key}`) })}</Typography>
            <Typography variant="caption" component="p">{t("execution.historical_receipt")}</Typography>
            <Actions><Button variant="contained" component={Link} to="/business" disabled={busy}>{t("execution.open_business")}</Button></Actions>
          </Box>)}
          {step.state === "completed" && step.result_refs.filter(ref => nodiaAiRentalResources.some(resource => ref.resource_key === resource)).map(ref => <Box key={`${ref.resource_key}:${ref.id}`}>
            <Typography variant="body2">{t("execution.rental_receipt", { id: ref.id, resource: t(`execution.rental_resources.${ref.resource_key}`) })}</Typography>
            <Typography variant="caption" component="p">{t("execution.historical_receipt")}</Typography>
            <Actions><Button variant="contained" component={Link} to={RENTAL_RESERVATIONS_ROUTE} disabled={busy}>{t("execution.open_rentals")}</Button></Actions>
          </Box>)}
        </Box>)}
        {!query.readOnly && execution.state !== "waiting_for_user" && <Actions>
          {canCancel && <Button variant="contained" disabled={busy || query.uncertain || query.isError} onClick={() => void query.control("cancel")}>{t("execution.cancel")}</Button>}
          {execution.can_resume && <Button variant="outlined" disabled={busy || query.uncertain || query.isError} onClick={() => void query.control("resume")}>{t("execution.resume")}</Button>}
          {query.canRetry && <Button variant="contained" disabled={busy} onClick={() => void query.retry()}>{t("execution.retry_control")}</Button>}
        </Actions>}
        {execution.can_resume && execution.steps.some(step => step.state === "completed") && <Typography variant="caption" component="p">{t("execution.resume_pending")}</Typography>}
      </>}
    </Skeleton>
    <Actions><Button variant="contained" disabled={busy} onClick={() => void query.recover()}>{t("refresh_status")}</Button></Actions>
  </Panel>;
}
