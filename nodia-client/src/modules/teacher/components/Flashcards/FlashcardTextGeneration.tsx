import { useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import { useTranslation } from "react-i18next";
import { flashcardGenerationPending, type FlashcardGenerationTarget, type FlashcardTextProposal } from "../../infrastructure/flashcardGeneration";
import { connectionsSchema, type Selection } from "../../infrastructure/schemas";
import { useFlashcardGeneration } from "../../infrastructure/useFlashcardGeneration";
import { useTeacherQuery } from "../../infrastructure/useServices";
import { jobErrorKey } from "../JobPanel/presentation";
import { FlashcardActions } from "./styles";

export type FlashcardTextRequest = {
  target: FlashcardGenerationTarget;
  selection: Selection | null;
};

export default function FlashcardTextGeneration({ request, disabled, onApply }: {
  request: FlashcardTextRequest;
  disabled: boolean;
  onApply: (proposal: FlashcardTextProposal) => void;
}) {
  const { t } = useTranslation();
  const generation = useFlashcardGeneration();
  const { selection, target } = request;
  const catalog = useTeacherQuery("connections", connectionsSchema, undefined, Boolean(selection));
  const connection = catalog.data?.items.find(item => item.connection_id === selection?.connection_id);
  const connectionLabel = connection?.label ?? selection?.connection_id;
  const locked = disabled || generation.disabled;
  const status = generation.current;
  const proposal = status?.proposal;
  const [applied, setApplied] = useState(false);
  const errorKey = jobErrorKey(status?.error_code ?? null, status?.state === "failed_known");

  return <Stack spacing={1} sx={{
    minWidth: 0, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1.5, overflowWrap: "anywhere",
  }}>
    <Typography component="h3" variant="subtitle2">{t("teacher:flashcard_generation.heading")}</Typography>
    {!selection && <Typography variant="body2" color="text.secondary">{t("teacher:flashcard_generation.selection_missing")}</Typography>}
    {selection && <Typography variant="body2" color="text.secondary">
      {t(selection.effort_id ? "teacher:flashcard_generation.selection_effort" : "teacher:flashcard_generation.selection", {
        connection: connectionLabel, mode: selection.mode === "api_key" ? "API key" : "Agentic",
        model: selection.model_id, effort: selection.effort_id,
      })}
    </Typography>}
    {selection && !status && !generation.uncertain && <FlashcardActions>
      <Button type="button" variant="outlined" startIcon={<AutoAwesomeOutlined />}
        disabled={locked || catalog.isFetching}
        onClick={() => { void generation.start(target, selection); }}>
        {t("teacher:flashcard_generation.generate")}
      </Button>
    </FlashcardActions>}
    {generation.uncertain && <>
      <Alert severity="warning">{t("teacher:flashcard_generation.receipt_uncertain")}</Alert>
      <FlashcardActions><Button type="button" variant="outlined" disabled={locked}
        onClick={() => { void generation.reconcile(); }}>{t("teacher:flashcard_generation.check_status")}</Button></FlashcardActions>
    </>}
    {status && flashcardGenerationPending(status) && <Typography variant="body2" role="status">
      {t(status.state === "blocked_paused" ? "teacher:job_paused_help" : "teacher:flashcard_generation.preparing")}
    </Typography>}
    {status?.state === "unknown" && <Alert severity="warning">{t("teacher:unknown_notice")}</Alert>}
    {status?.state === "failed_known" && <Alert severity="error">{t(errorKey ?? "teacher:flashcard_generation.failed")}</Alert>}
    {status?.state === "cancelled_before_dispatch" && <Alert severity="info">{t("teacher:flashcard_generation.cancelled")}</Alert>}
    {generation.readFailed && <Alert severity="error">{t("teacher:flashcard_generation.read_failed")}</Alert>}
    {(generation.readFailed || status?.state === "unknown" || status?.state === "blocked_paused") && <FlashcardActions>
      <Button type="button" variant="outlined" disabled={locked || generation.checking}
        onClick={() => { void generation.refresh(); }}>{t("teacher:flashcard_generation.check_status")}</Button>
    </FlashcardActions>}
    {proposal && !generation.readFailed && <Stack spacing={1.25}>
      <Typography variant="body2" role="status">{t(applied ? "teacher:flashcard_generation.applied" : "teacher:flashcard_generation.review")}</Typography>
      <Box component="dl" sx={{ m: 0, display: "grid", gap: 0.5 }}>
        <Typography component="dt" variant="subtitle2">{t("teacher:flashcards.question")}</Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0, whiteSpace: "pre-wrap" }}>{proposal.question}</Typography>
        <Typography component="dt" variant="subtitle2">{t("teacher:flashcards.answer")}</Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0, whiteSpace: "pre-wrap" }}>{proposal.answer}</Typography>
      </Box>
      <FlashcardActions>
        <Button type="button" variant="outlined" disabled={locked || applied} onClick={() => {
          onApply(proposal);
          setApplied(true);
        }}>{t("teacher:flashcard_generation.apply")}</Button>
      </FlashcardActions>
    </Stack>}
  </Stack>;
}
