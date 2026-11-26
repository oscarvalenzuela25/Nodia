import { useId } from "react";
import { Alert, Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import { getHttpErrorMessage } from "../../../../config/httpFeedback";
import type { NodiaAiSelection } from "../../../nodiaAi/infrastructure/types";
import { cvAiEditFormSchema, cvAiEditMaxBytes } from "../../infrastructure/cvAiEdit";
import type { CvDraftFact } from "../../infrastructure/generationSchema";
import type { TrackedCvGeneration } from "../../infrastructure/generations";
import { useCvAiEdit, type CvAiEditApplyResult } from "../../infrastructure/useCvAiEdit";
import type { CvGenerationView } from "../../infrastructure/useCvGenerationWorkflow";
import { aiEditAction, aiEditList } from "./styles";

type Props = {
  base: CvGenerationView;
  selection: NodiaAiSelection;
  connectionLabel?: string;
  onApply: (next: TrackedCvGeneration) => Promise<CvAiEditApplyResult>;
  onClose: () => void;
  onDenial: () => void;
};

function ChangedFacts({ title, items, ordered }: { title: string; items: CvDraftFact[]; ordered?: boolean }) {
  if (!items.length) return null;
  return (
    <Box component="section">
      <Typography component="h4" variant="subtitle2">{title}</Typography>
      <Box component={ordered ? "ol" : "ul"} sx={aiEditList}>
        {items.map(fact => (
          <Typography component="li" variant="body2" key={fact.id} sx={{ whiteSpace: "pre-wrap" }}>
            {fact.text}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

export function CvAiEditDialog({ base, selection, connectionLabel, onApply, onClose, onDenial }: Props) {
  const { t, i18n } = useTranslation("nodiaCv");
  const formId = useId();
  const inputId = useId();
  const edit = useCvAiEdit(base, selection, onDenial);
  const { control, handleSubmit, formState: { isValid } } = useForm({
    resolver: zodResolver(cvAiEditFormSchema),
    mode: "onChange",
    defaultValues: { instructions: "" },
  });

  const busy = edit.action !== null;
  const checkNeeded = edit.pending && !edit.missing && (
    !edit.tracked || edit.unresolved || edit.invalid || Boolean(edit.error)
  );
  const displayedModel = edit.observedModel ?? selection;
  const label = displayedModel.connection_id === selection.connection_id ? connectionLabel : undefined;
  const effort = displayedModel.effort_id;
  const effortKey = `nodiaAi:effort_levels.${effort}`;
  const selectionLabel = [
    label ?? t("ai_edit.connection", { id: displayedModel.connection_id }),
    displayedModel.model_id,
    t(`nodiaAi:modes.${displayedModel.mode}`),
    effort && (i18n.exists(effortKey) ? t(effortKey) : effort),
  ].filter(Boolean).join(" · ");

  const close = () => {
    if (edit.dismiss()) onClose();
  };
  const apply = async () => {
    if (await edit.apply(onApply)) onClose();
  };
  const send = handleSubmit(
    ({ instructions }) => edit.propose(instructions),
    () => document.getElementById(inputId)?.focus(),
  );

  return (
    <BaseModal
      open
      size="md"
      title={t("ai_edit.open")}
      subtitle={selectionLabel}
      onClose={close}
      disableEscapeKeyDown={busy}
      showCloseButton={!busy}
      actions={
        <>
          <Button variant="outlined" onClick={close} disabled={busy} sx={aiEditAction}>
            {t("ai_edit.keep")}
          </Button>
          {checkNeeded && (
            <Button variant="outlined" onClick={() => void edit.check()} disabled={busy}
              loading={edit.action === "check"} sx={aiEditAction}>
              {t("ai_edit.check")}
            </Button>
          )}
          {(edit.canPropose || edit.action === "propose") && (
            <Button variant="contained" type="submit" form={formId} loading={edit.action === "propose"}
              disabled={busy || !isValid} sx={aiEditAction}>
              {t(edit.missing ? "ai_edit.resume" : "ai_edit.propose")}
            </Button>
          )}
          {edit.proposal && (
            <Button variant="contained" onClick={() => void apply()} loading={edit.action === "apply"}
              disabled={busy || edit.checkingResult || edit.stale || Boolean(edit.error)} sx={aiEditAction}>
              {t("ai_edit.apply")}
            </Button>
          )}
        </>
      }
    >
      <Stack id={formId} component="form" noValidate spacing={2} onSubmit={(event) => { void send(event); }}>
        <Typography variant="body2">{t("ai_edit.help")}</Typography>
        <Controller
          name="instructions"
          control={control}
          render={({ field, fieldState }) => (
            <TextInput
              id={inputId}
              label={t("ai_edit.instructions")}
              placeholder={t("ai_edit.example")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              required
              disabled={!edit.canEdit}
              multiline
              minRows={4}
              maxRows={9}
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message
                ? t(fieldState.error.message, { limit: cvAiEditMaxBytes })
                : t("ai_edit.limit", { limit: cvAiEditMaxBytes })}
            />
          )}
        />
        {edit.working && (
          <Stack spacing={0.75}>
            <Typography variant="body2">{t("ai_edit.working")}</Typography>
            <LinearProgress aria-label={t("ai_edit.working")} />
          </Stack>
        )}
        {edit.missing && <Alert severity="info" role="status">{t("ai_edit.missing")}</Alert>}
        {edit.pending && !edit.tracked && !edit.missing && !edit.error && !busy && (
          <Alert severity="info" role="status">{t("ai_edit.pending")}</Alert>
        )}
        {edit.unresolved && <Alert severity="warning">{t("ai_edit.unknown")}</Alert>}
        {edit.failed && (
          <Alert severity="error">
            {edit.failedCode && i18n.exists(`nodiaCv:${edit.failedCode}`)
              ? t(`nodiaCv:${edit.failedCode}`) : t("ai_edit.failed")}
          </Alert>
        )}
        {edit.invalid && <Alert severity="error">{t("ai_edit.invalid_result")}</Alert>}
        {Boolean(edit.error) && !edit.missing && <Alert severity="error">{getHttpErrorMessage(edit.error)}</Alert>}
        {edit.stale && <Alert severity="warning">{t("ai_edit.stale")}</Alert>}
        {edit.applyUnavailable && <Alert severity="error">{t("ai_edit.apply_unavailable")}</Alert>}
        {edit.changes && !edit.changes.changed && (
          <Alert severity="info" role="status">{t("ai_edit.no_changes")}</Alert>
        )}
        {edit.proposal && edit.changes && (
          <Stack component="section" spacing={1.25} aria-labelledby={formId + "-changes"}>
            <Typography id={formId + "-changes"} component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
              {t("ai_edit.changes")}
            </Typography>
            <ChangedFacts title={t("ai_edit.added")} items={edit.changes.added} />
            <ChangedFacts title={t("ai_edit.omitted")} items={edit.changes.omitted} />
            <ChangedFacts title={t("ai_edit.reordered")} items={edit.changes.reordered} ordered />
            {edit.changes.sectionOrder.length > 0 && (
              <Box component="section">
                <Typography component="h4" variant="subtitle2">{t("ai_edit.section_order")}</Typography>
                <Box component="ol" sx={aiEditList}>
                  {edit.changes.sectionOrder.map(section => (
                    <Typography component="li" variant="body2" key={section}>{t(`document_sections.${section}`)}</Typography>
                  ))}
                </Box>
              </Box>
            )}
          </Stack>
        )}
      </Stack>
    </BaseModal>
  );
}
