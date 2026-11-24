import { useId, useRef, useState } from "react";
import { Alert, Button, Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import { getHttpErrorMessage } from "../../../../config/httpFeedback";
import type { CvDraftFact, CvRequirement, CvReviewSave } from "../../infrastructure/generationSchema";
import { cvHttpStatus } from "../../infrastructure/useCvGenerationWorkflow";
import { cvReviewFields, rebaseCvReviewFields } from "../../infrastructure/draftReview";
import { cvPrimaryHover } from "./styles";

const formSchema = z
  .object({
    source: z.string().trim().max(160, "nodiaCv:validation.length"),
    detail: z.string().trim().max(600, "nodiaCv:validation.length"),
    included: z.array(z.string()),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.source) !== Boolean(value.detail))
      ctx.addIssue({
        code: "custom",
        path: [value.source ? "detail" : "source"],
        message: "nodiaCv:review_evidence_pair",
      });
  });
type ReviewForm = z.output<typeof formSchema>;
const action = { minHeight: 44 };
type Props = {
  requirement: CvRequirement;
  facts: CvDraftFact[];
  baseline: CvReviewSave;
  onSave: (input: CvReviewSave) => Promise<void>;
  onReload: () => Promise<CvReviewSave | null | undefined>;
  onError: (error: unknown) => void;
  onClose: () => void;
};

export default function ReviewEvidenceDialog({
  requirement,
  facts,
  baseline,
  onSave,
  onReload,
  onError,
  onClose,
}: Props) {
  const { t } = useTranslation("nodiaCv");
  const formId = useId();
  const [revision, setRevision] = useState(baseline);
  const [error, setError] = useState<unknown>(null);
  const [reloading, setReloading] = useState(false);
  const [reloaded, setReloaded] = useState(false);
  const inFlight = useRef(false);
  const {
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { isSubmitting },
  } = useForm<ReviewForm>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: cvReviewFields(baseline, requirement),
  });
  const saving = isSubmitting || reloading;
  const conflicted = cvHttpStatus(error) === 409;

  const save = async (form: ReviewForm) => {
    if (inFlight.current || conflicted) return;
    inFlight.current = true;
    setError(null);
    try {
      const touched = new Set(requirement.evidenceIds);
      const chosen = new Set(form.included);
      const included = revision.included_fact_ids.filter((id) => !touched.has(id) || chosen.has(id));
      const includedSet = new Set(included);
      for (const id of form.included) if (!includedSet.has(id)) included.push(id);
      const evidence = revision.evidence.filter((item) => item.requirement_id !== requirement.id);
      if (form.detail && form.source)
        evidence.push({ requirement_id: requirement.id, source: form.source, detail: form.detail });
      await onSave({ revision: revision.revision, included_fact_ids: included, evidence });
      onClose();
    } catch (reason) {
      setError(reason);
    } finally {
      inFlight.current = false;
    }
  };

  const refresh = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setReloading(true);
    try {
      const latest = await onReload();
      if (!latest) throw new Error("Missing Nodia CV draft revision");
      reset(
        rebaseCvReviewFields(
          cvReviewFields(revision, requirement),
          getValues(),
          cvReviewFields(latest, requirement),
        ),
      );
      setRevision(latest);
      setError(null);
      setReloaded(true);
    } catch (reason) {
      setError(reason);
      onError(reason);
    } finally {
      inFlight.current = false;
      setReloading(false);
    }
  };
  const close = () => {
    if (!inFlight.current) onClose();
  };

  return (
    <BaseModal
      open
      title={t("review_title")}
      onClose={close}
      disableEscapeKeyDown={saving}
      showCloseButton={!saving}
      actions={
        <>
          <Button onClick={close} disabled={saving} variant="outlined" sx={action}>
            {t("core:cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={isSubmitting}
            disabled={conflicted || reloading}
            variant="contained"
            sx={[action, cvPrimaryHover]}
          >
            {t("review_confirm")}
          </Button>
        </>
      }
    >
      <Stack
        component="form"
        id={formId}
        noValidate
        spacing={2.5}
        onSubmit={(event) => {
          void handleSubmit(save, (errors) => {
            const field = errors.source ? "source" : errors.detail ? "detail" : null;
            if (field) document.getElementById(formId + "-" + field)?.focus();
          })(event);
        }}
      >
        <Typography sx={{ overflowWrap: "anywhere", fontWeight: 650 }}>{requirement.quote}</Typography>
        {error !== null && (
          <Alert severity="error">
            <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
              <Typography variant="body2">{getHttpErrorMessage(error)}</Typography>
              {conflicted && (
                <>
                  <Typography variant="body2">{t("review_reload_help")}</Typography>
                  <Button
                    variant="outlined"
                    color="inherit"
                    loading={reloading}
                    sx={action}
                    onClick={() => {
                      void refresh();
                    }}
                  >
                    {t("review_reload")}
                  </Button>
                </>
              )}
            </Stack>
          </Alert>
        )}
        {error === null && reloaded && <Alert severity="info">{t("review_reloaded")}</Alert>}
        {facts.length > 0 && (
          <Stack component="fieldset" spacing={0.75} sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
            <Typography component="legend" variant="subtitle2">
              {t("review_profile_choices")}
            </Typography>
            <Controller
              control={control}
              name="included"
              render={({ field }) => (
                <Stack spacing={0.5}>
                  {facts.map((fact) => (
                    <FormControlLabel
                      key={fact.id}
                      disabled={saving}
                      sx={{
                        m: 0,
                        minHeight: 44,
                        alignItems: "flex-start",
                        overflowWrap: "anywhere",
                        "& .MuiFormControlLabel-label": { py: 1 },
                      }}
                      label={fact.text}
                      control={
                        <Checkbox
                          checked={field.value.includes(fact.id)}
                          onChange={(_, checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, fact.id]
                                : field.value.filter((id) => id !== fact.id),
                            )
                          }
                        />
                      }
                    />
                  ))}
                </Stack>
              )}
            />
          </Stack>
        )}
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {t("review_declaration_help")}
          </Typography>
          <Controller
            name="source"
            control={control}
            render={({ field, fieldState }) => (
              <TextInput
                id={formId + "-source"}
                name={field.name}
                label={t("review_source")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={saving}
                autoFocus={!facts.length}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              />
            )}
          />
          <Controller
            name="detail"
            control={control}
            render={({ field, fieldState }) => (
              <TextInput
                id={formId + "-detail"}
                name={field.name}
                label={t("review_detail")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={saving}
                multiline
                minRows={3}
                maxRows={5}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              />
            )}
          />
        </Stack>
      </Stack>
    </BaseModal>
  );
}
