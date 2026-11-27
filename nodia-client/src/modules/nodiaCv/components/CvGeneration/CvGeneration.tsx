import { useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Alert, Box, Button, Divider, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import { zodResolver } from "@hookform/resolvers/zod";
import { Skeleton } from "boneyard-js/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import BaseModal from "../../../../components/BaseModal";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import TextInput from "../../../../components/inputs/TextInput";
import { getHttpErrorMessage } from "../../../../config/httpFeedback";
import type { NodiaAiSelection } from "../../../nodiaAi/infrastructure/types";
import { cvEligibilityReasonKey } from "../../infrastructure/eligibilityPresentation";
import {
  cvInputIdentity,
  cvOfferSchema,
  sameCvSelection,
  type CvOffer,
  type CvRequirement,
} from "../../infrastructure/generationSchema";
import {
  useCvCatalog,
  useCvEligibility,
  useCvHttpNotice,
  useCvProfilesForGeneration,
} from "../../infrastructure/generations";
import { useProfileDetail } from "../../infrastructure/profiles";
import type { CvPdfTemplate } from "../../infrastructure/pdfVersions";
import { useCvDraftExit } from "../../infrastructure/useCvDraftExit";
import {
  useCvGenerationWorkflow,
  type CvGenerationView,
} from "../../infrastructure/useCvGenerationWorkflow";
import CvModelSelector from "../CvModelSelector";
import { CvAiEditDialog } from "../CvAiEditDialog/CvAiEditDialog";
import CvDraftPdf, { type CvDraftPdfHandle } from "../CvDraftPdf/CvDraftPdf";
import CvOfferAnalysis from "../CvRequirements/CvOfferAnalysis";
import CvApplicationDocuments from "../CvApplicationDocuments";
import CvTechnologies from "../CvTechnologies/CvTechnologies";
import CvDraftDocument from "./CvDraftDocument";
import ReviewEvidenceDialog from "./ReviewEvidenceDialog";
import { cvPreviewCoverage, cvPreviewPresentation } from "./previewPresentation";
import { useCvEvidenceHighlight } from "./useCvEvidenceHighlight";
import { cvPrimaryHover } from "./styles";

const primaryAction = { minHeight: 44, width: { xs: "100%", sm: "auto" }, flexShrink: 0 };
const panel = { borderRadius: 2, minWidth: 0, p: { xs: 2, sm: 2.5 } };
const wrap = { overflowWrap: "anywhere" } as const;

export type CvGenerationHandle = { leave: (action: () => void) => void };
type Props = {
  active: boolean;
  initialCopy: CvGenerationView | null;
  onCreateProfile: () => void;
  onDenial: () => void;
  onClearCopy: () => void;
  onOpenVersions: () => void;
  ref?: Ref<CvGenerationHandle>;
};
type ReviewTarget = { view: CvGenerationView; requirement: CvRequirement };
type EditTarget = { view: CvGenerationView; selection: NodiaAiSelection };

export default function CvGeneration({ active, initialCopy, onCreateProfile, onDenial, onClearCopy, onOpenVersions, ref }: Props) {
  const { t, i18n } = useTranslation("nodiaCv");
  const id = useId();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [selection, setSelection] = useState<NodiaAiSelection | null>(null);
  const [workingSelection, setWorkingSelection] = useState<NodiaAiSelection | null>(null);
  const [selectionDirty, setSelectionDirty] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [savedRevision, setSavedRevision] = useState<string | null>(null);
  const [template, setTemplate] = useState<CvPdfTemplate>(initialCopy?.receipt.source_version?.template ?? "classic");
  const [writingVersion, setWritingVersion] = useState(false);
  const pdfRef = useRef<CvDraftPdfHandle>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const modelTrigger = useRef<HTMLButtonElement>(null);
  const prepareTitle = useRef<HTMLHeadingElement>(null);
  if (!active && reviewTarget) setReviewTarget(null);
  if (!active && editTarget) setEditTarget(null);

  const profiles = useCvProfilesForGeneration(active && !initialCopy);
  const profileDetail = useProfileDetail(active ? profileId : null);
  const catalog = useCvCatalog(active);
  const candidateSelection = selectionDirty ? workingSelection : selection;
  const eligibility = useCvEligibility(candidateSelection, active);
  const workflow = useCvGenerationWorkflow(active, onDenial, initialCopy);

  useCvHttpNotice(initialCopy ? null : profiles.error, onDenial);
  useCvHttpNotice(profileDetail.error, onDenial);
  useCvHttpNotice(catalog.error, onDenial);
  useCvHttpNotice(eligibility.error, onDenial);
  useCvHttpNotice(workflow.status.error, onDenial);

  const emptyOffer: CvOffer = {
    language: i18n.resolvedLanguage?.startsWith("en") ? "en" : "es",
    vacancy_title: "",
    vacancy_company: "",
    offer_text: "",
  };
  const { control, handleSubmit, reset } = useForm<CvOffer>({
    resolver: zodResolver(cvOfferSchema),
    mode: "onTouched",
    defaultValues: emptyOffer,
  });
  const watched = useWatch({ control });
  const validated = cvOfferSchema.safeParse(watched);
  const profile =
    profileDetail.data?.id === profileId && !profileDetail.isError ? profileDetail.data : undefined;
  const listedProfiles = profiles.data?.pages.flatMap((page) => page.items) ?? [];
  const noProfiles = profiles.isSuccess && profiles.data.pages[0].total === 0;
  const listedProfile = listedProfiles.find((item) => item.id === profileId);
  const profileOption = listedProfile ?? profile;
  const profileOptions = profile && !listedProfile ? [profile, ...listedProfiles] : listedProfiles;
  const profileRevisionCurrent = Boolean(profile && profileOption?.revision === profile.revision);
  const connections = catalog.data?.pages.flatMap((page) => page.items) ?? [];
  const selectedMode = connections
    .find((connection) => connection.connection_id === selection?.connection_id && connection.is_active)
    ?.modes.find((candidate) => candidate.mode === selection?.mode && candidate.cv_transport === "available");
  const listedModel = selectedMode?.models.find((model) => model.model_id === selection?.model_id);
  const selectionListed = Boolean(
    listedModel &&
    (selection?.effort_id === null ||
      listedModel.efforts.some((effort) => effort.effort_id === selection?.effort_id)),
  );
  const draftInput =
    !initialCopy && profile && profileRevisionCurrent && selection && validated.success
      ? { ...validated.data, profile_id: profile.id, profile_revision: profile.revision, selection }
      : null;
  const identity = draftInput ? cvInputIdentity(draftInput) : null;
  const visible = workflow.visible;
  const draftView = visible && !workflow.busy && !workflow.uncertain &&
    (initialCopy || (!selectionDirty && identity === cvInputIdentity(visible.intent))) ? visible : null;
  const draft = draftView?.receipt.draft;
  const review = draftView?.receipt.review;
  const draftId = draftView?.receipt.id ?? null;
  const highlight = useCvEvidenceHighlight(draftId, previewRef, draft?.requirements);
  const { activeRequirement, pinnedRequirement } = highlight;
  const preview = draftView && cvPreviewPresentation(draftView, i18n.getFixedT(draftView.receipt.language, "nodiaCv"));
  const describeEvidence = (requirement: CvRequirement) => t(
    preview?.linkedRequirements.has(requirement.id) ? "preview_evidence_linked" : "preview_evidence_missing",
    { quote: requirement.quote },
  );
  const visibleReview = visible?.receipt.review;
  const revisionKey = visible && visibleReview ? visible.receipt.id + ":" + visibleReview.revision : null;
  const unsaved = Boolean(revisionKey && revisionKey !== savedRevision);
  const exit = useCvDraftExit({
    unsaved,
    save: () => pdfRef.current?.saveForExit() ?? Promise.resolve(false),
    retire: (saved) => {
      workflow.discardDraft();
      if (!saved) sileo.success({ title: t("draft_exit_discarded") });
    },
  });
  const clearFields = () => {
    workflow.clearPresentation();
    reset(emptyOffer);
    setProfileId(null);
    setSelection(null);
    setWorkingSelection(null);
    setSelectionDirty(false);
    setSavedRevision(null);
    setReviewTarget(null);
    setEditTarget(null);
    setTemplate("classic");
  };
  useImperativeHandle(ref, () => ({
    leave: (action) => exit.request(() => {
      if (visible) clearFields();
      action();
    }),
  }));
  const hasFields = Boolean(
    initialCopy || profileId || selection || selectionDirty || workflow.receipt || workflow.uncertain ||
    workflow.priorRequest || workflow.admissionError ||
    watched.offer_text || watched.vacancy_title || watched.vacancy_company || watched.language !== emptyOffer.language
  );
  const clearForm = () => exit.request(() => {
    clearFields();
    if (initialCopy) onClearCopy();
    else requestAnimationFrame(() => prepareTitle.current?.focus());
    if (!unsaved) sileo.success({ title: t("generation_fields_cleared") });
  });
  const chooseAnotherModel = () => {
    modelTrigger.current?.focus();
    if (modelTrigger.current?.getAttribute("aria-expanded") === "false") modelTrigger.current.click();
  };
  const unknownSame = identity !== null && workflow.hasUnknown(identity);
  const appliedEligibility =
    eligibility.isSuccess && sameCvSelection(eligibility.data.selection, selection)
      ? eligibility.data
      : null;
  const eligible = appliedEligibility?.eligible === true && !eligibility.isFetching;
  const blocked =
    !active ||
    !draftInput ||
    !profileOption ||
    profileDetail.isFetching ||
    profiles.isError ||
    profiles.isFetching ||
    !eligible ||
    !selectionListed ||
    selectionDirty ||
    catalog.isError ||
    catalog.isFetching ||
    workflow.busy ||
    workflow.working ||
    writingVersion ||
    Boolean(workflow.uncertain) ||
    Boolean(unknownSame);
  const status = workflow.receipt?.state;
  const displayedState = workflow.expired
    ? "generation_expired"
    : status && (status !== "ready" || draftView)
      ? "generation_state." + status
      : null;

  const submitDraft = (resumeMissing = false) => handleSubmit(
    (values) => {
      if (blocked || !profile || !selection) return;
      const input = { ...values, profile_id: profile.id, profile_revision: profile.revision, selection };
      exit.request(() => {
        if (resumeMissing) void workflow.resumeMissing(input, profile);
        else workflow.generate(input, profile);
      });
    },
    (errors) => {
      if (errors.offer_text) requestAnimationFrame(() => document.getElementById(id + "-offer")?.focus());
      else if (errors.vacancy_title)
        requestAnimationFrame(() => document.getElementById(id + "-vacancy_title")?.focus());
      else if (errors.vacancy_company)
        requestAnimationFrame(() => document.getElementById(id + "-vacancy_company")?.focus());
    },
  );
  const submit = submitDraft();
  const forPreviewAvailable = Boolean(preview);
  const pdfReady =
    !workflow.status.isFetching &&
    !workflow.status.isError &&
    !workflow.busy;
  const reviewReady = Boolean(draftView && review && pdfReady && !writingVersion);
  const copyModelReady = eligible && selectionListed && !selectionDirty && !catalog.isError && !catalog.isFetching;
  const editSelection = initialCopy ? (copyModelReady ? selection : null) : draftView?.receipt.selection;
  const openReview = (requirement: CvRequirement) => {
    if (reviewReady && draftView) setReviewTarget({ view: draftView, requirement });
  };
  const candidateError = eligibility.error ? getHttpErrorMessage(eligibility.error) : null;
  const showAppliedEligibility =
    active &&
    selection &&
    sameCvSelection(candidateSelection, selection) &&
    selectionListed &&
    !selectionDirty &&
    !catalog.isError &&
    !catalog.isFetching &&
    !eligibility.isFetching &&
    (eligibility.isError || (appliedEligibility && (selection.mode === "agentic" || !eligible)));

  return (
    <Box sx={{ containerType: "inline-size", minWidth: 0 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr)",
          columnGap: 2,
          rowGap: 3,
          alignItems: "start",
          "@container (min-width: 870px)": { gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" },
        }}
      >
        <Stack sx={{ minWidth: 0, gridColumn: forPreviewAvailable ? "1 / -1" : undefined }}>
          <Stack
            component={Paper}
            variant="outlined"
            spacing={2.25}
            sx={panel}
            aria-labelledby={id + "-prepare"}
          >
            <Stack direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between" }}>
              <Typography id={id + "-prepare"} ref={prepareTitle} tabIndex={-1}
                component="h2" variant="h6" sx={{ fontWeight: 750 }}>
                {t("generation_prepare")}
              </Typography>
              <Button type="button" variant="outlined" sx={primaryAction} onClick={clearForm}
                disabled={!hasFields || workflow.busy || workflow.working || writingVersion || Boolean(editTarget || reviewTarget)}>
                {t("generation_clear_fields")}
              </Button>
            </Stack>
            {!initialCopy && (
              <QueryErrorAlert isError={profiles.isError} isFetching={profiles.isFetching}
                onRetry={profiles.refetch} retryVariant="outlined" />
            )}
            {profileId && (
              <QueryErrorAlert
                isError={profileDetail.isError}
                isFetching={profileDetail.isFetching}
                onRetry={profileDetail.refetch}
                retryVariant="outlined"
              />
            )}
            {!initialCopy && noProfiles && (
              <Alert severity="info">
                <Stack spacing={1} sx={{ alignItems: { xs: "stretch", sm: "flex-start" } }}>
                  <Typography variant="body2">{t("generate_needs_profile")}</Typography>
                  <Button variant="outlined" color="inherit" sx={primaryAction} onClick={onCreateProfile}>
                    {t("new_profile")}
                  </Button>
                </Stack>
              </Alert>
            )}
            <Stack
              component="form"
              spacing={2}
              noValidate
              onSubmit={(event) => {
                if (initialCopy) event.preventDefault();
                else void submit(event);
              }}
            >
              {initialCopy ? (
                <Alert severity="info">
                  <Typography variant="body2" sx={wrap}>
                    {t("version_copy_profile", {
                      profile: initialCopy.profile.profile_name,
                      language: t(`document_language.${initialCopy.receipt.language}`),
                    })}
                  </Typography>
                  <Typography variant="body2">{t("version_copy_offer_unavailable")}</Typography>
                  <Typography variant="body2">{t("version_copy_choose_model")}</Typography>
                </Alert>
              ) : <>
              <SelectSingleInput
                id={id + "-profile"}
                label={t("generation_profile")}
                value={profileId}
                options={profileOptions.map((item) => ({ value: item.id, label: item.profile_name }))}
                disabled={profiles.isFetching || profiles.isError || noProfiles || workflow.busy}
                helperText={
                  profileId && !profileOption && !profiles.isFetching
                    ? t("generation_profile_unavailable")
                    : undefined
                }
                onChange={setProfileId}
                hasMore={profiles.hasNextPage}
                loadingOptions={profiles.isFetchingNextPage}
                onLoadMore={() => {
                  if (!profiles.isFetching) void profiles.fetchNextPage();
                }}
              />
              <Controller
                control={control}
                name="language"
                render={({ field }) => (
                  <SelectSingleInput
                    id={id + "-language"}
                    label={t("generation_language")}
                    value={field.value}
                    options={[
                      { label: t("generation_spanish"), value: "es" },
                      { label: t("generation_english"), value: "en" },
                    ]}
                    clearable={false}
                    disabled={workflow.busy}
                    onChange={(value) => {
                      if (value === "es" || value === "en") field.onChange(value);
                    }}
                  />
                )}
              />
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" },
                  gap: 1.5,
                }}
              >
                {(["vacancy_title", "vacancy_company"] as const).map((name) => (
                  <Controller
                    key={name}
                    control={control}
                    name={name}
                    render={({ field, fieldState }) => (
                      <TextInput
                        id={id + "-" + name}
                        name={field.name}
                        label={t("generation_" + name)}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={workflow.busy}
                        error={Boolean(fieldState.error)}
                        helperText={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                      />
                    )}
                  />
                ))}
              </Box>
              <Controller
                control={control}
                name="offer_text"
                render={({ field, fieldState }) => (
                  <TextInput
                    id={id + "-offer"}
                    name={field.name}
                    label={t("generation_offer")}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={workflow.busy}
                    required
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                    multiline
                    minRows={6}
                    maxRows={12}
                  />
                )}
              />
              </>}
              <Divider />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{
                  gap: 1.5,
                  alignItems: { xs: "stretch", sm: "center" },
                  justifyContent: "space-between",
                }}
              >
                <CvModelSelector
                  triggerRef={modelTrigger}
                  connections={connections}
                  selection={selection}
                  onSelectionChange={setWorkingSelection}
                  onDirtyChange={setSelectionDirty}
                  onApply={setSelection}
                  eligibility={eligibility.data ?? null}
                  eligibilityBusy={eligibility.isFetching}
                  eligibilityError={candidateError}
                  onRetryEligibility={() => {
                    void eligibility.refetch();
                  }}
                  isLoading={catalog.isLoading}
                  isFetching={catalog.isFetching}
                  isSaving={false}
                  readOnly={workflow.busy}
                  error={catalog.error ? getHttpErrorMessage(catalog.error) : null}
                  onRetry={() => {
                    void catalog.refetch();
                  }}
                  hasMore={catalog.hasNextPage}
                  onLoadMore={() => {
                    if (!catalog.isFetching) void catalog.fetchNextPage();
                  }}
                />
                {!initialCopy && <Button
                  type="submit"
                  variant="contained"
                  startIcon={<AutoAwesomeOutlined />}
                  sx={[primaryAction, cvPrimaryHover]}
                  loading={workflow.busy && !workflow.uncertain}
                  disabled={blocked}
                >
                  {t("generation_start")}
                </Button>}
              </Stack>
            </Stack>
            {selection && catalog.isSuccess && !catalog.isFetching && !selectionListed && !selectionDirty && (
              <Alert severity="warning">{t("model_selector.selection_missing")}</Alert>
            )}
            {showAppliedEligibility && (
              <Alert severity={eligibility.isError ? "error" : eligible ? "success" : "info"} role="status">
                <Stack spacing={1} sx={{ alignItems: { xs: "stretch", sm: "flex-start" } }}>
                  <Typography variant="body2">
                    {eligibility.isError
                      ? (candidateError ?? t("core:server_error_alert"))
                      : t(initialCopy && eligible ? "version_copy_model_ready" : cvEligibilityReasonKey(appliedEligibility?.reason_code ?? null))}
                  </Typography>
                  {!eligible && (
                    <Button
                      color="inherit"
                      variant="outlined"
                      sx={primaryAction}
                      disabled={eligibility.isFetching || workflow.busy || workflow.working}
                      onClick={() => { void eligibility.refetch(); }}
                    >
                      {t("nodiaAi:configuration.check_again")}
                    </Button>
                  )}
                </Stack>
              </Alert>
            )}
            {profileOption && profile && !profileRevisionCurrent && !profileDetail.isFetching && (
              <Alert
                severity="info"
                action={
                  <Button
                    color="inherit"
                    onClick={() => {
                      void profileDetail.refetch();
                    }}
                    sx={{ minHeight: 44 }}
                  >
                    {t("core:retry")}
                  </Button>
                }
              >
                {t("stale_profile")}
              </Alert>
            )}
            {workflow.working && <LinearProgress aria-label={t("generation_working")} />}
            {displayedState && (
              <Typography role="status" variant="body2" color="text.secondary">
                {t(displayedState)}
              </Typography>
            )}
            {status === "failed" && (
              <Alert severity="error">
                {t("generation_failure." + workflow.receipt?.error_code, {
                  defaultValue: t("generation_failed"),
                })}
              </Alert>
            )}
            {status === "unknown" && (
              <Alert severity="warning">
                <Stack spacing={1}>
                  <Typography variant="body2">{t(unknownSame
                    ? "generation_unknown_change_model"
                    : "generation_unknown_help")}</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, flexWrap: "wrap" }}>
                    {unknownSame && (
                      <Button type="button" color="inherit" variant="outlined" sx={primaryAction}
                        disabled={catalog.isFetching || eligibility.isFetching || workflow.busy}
                        onClick={chooseAnotherModel}>
                        {t("generation_change_model")}
                      </Button>
                    )}
                    <Button type="button" color="inherit" sx={primaryAction} loading={workflow.status.isFetching}
                      onClick={() => { void workflow.status.refetch(); }}>
                      {t("generation_check_status")}
                    </Button>
                  </Stack>
                </Stack>
              </Alert>
            )}
            {workflow.admissionError !== null && (
              <Alert severity="error">{getHttpErrorMessage(workflow.admissionError)}</Alert>
            )}
            {workflow.priorRequest && (
              <Alert role="status" severity={workflow.priorRequest === "working" ? "info" : "warning"}>
                <Stack spacing={1} sx={{ alignItems: { xs: "stretch", sm: "flex-start" } }}>
                  <Typography variant="body2">{t("generation_prior." + workflow.priorRequest)}</Typography>
                  {workflow.priorRequest === "missing" && (
                    <Button variant="outlined" color="inherit" sx={primaryAction}
                      loading={workflow.busy} disabled={blocked} onClick={submitDraft(true)}>
                      {t("generation_resume_request")}
                    </Button>
                  )}
                </Stack>
              </Alert>
            )}
            {workflow.uncertain && (
              <Alert severity="warning">
                <Stack spacing={1.25}>
                  <Typography variant="body2">
                    {t(
                      workflow.uncertain.receiptMissing
                        ? "generation_receipt_missing"
                        : "generation_admission_uncertain",
                    )}
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, flexWrap: "wrap" }}>
                    <Button
                      color="inherit"
                      variant="outlined"
                      loading={workflow.busy}
                      sx={primaryAction}
                      onClick={() => {
                        void workflow.recover();
                      }}
                    >
                      {t("generation_recover")}
                    </Button>
                    {workflow.uncertain.receiptMissing && (
                      <Button
                        color="inherit"
                        variant="outlined"
                        disabled={workflow.busy}
                        sx={primaryAction}
                        onClick={workflow.resend}
                      >
                        {t("generation_resend_same")}
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Alert>
            )}
            <QueryErrorAlert
              isError={workflow.status.isError}
              isFetching={workflow.status.isFetching}
              onRetry={workflow.status.refetch}
              retryVariant="outlined"
            />
          </Stack>
        </Stack>
        {draftView && draft && preview && (
          <CvOfferAnalysis key={draftView.receipt.id}
            analysis={{
              requirements: draft.requirements,
              facts: [...draft.selectedFacts, ...draft.remainingFacts],
              evidence: review?.evidence ?? [],
            }}
            interaction={{
              previewId: id + "-preview-panel",
              ...highlight.target,
              coverage: (requirement) => cvPreviewCoverage(requirement, preview),
            }}
            onReview={openReview}
            reviewDisabled={!reviewReady}
            onChangeTab={highlight.clear}
            technologies={
              <CvTechnologies view={draftView} disabled={!reviewReady || Boolean(reviewTarget)}
                onSave={(input) => workflow.review(draftView, input)}
                onReload={() => workflow.reloadReview(draftView)} />
            }
          />
        )}
        <Stack component={Paper} variant="outlined" spacing={2} sx={panel} ref={previewRef} role="region"
          id={id + "-preview-panel"} aria-labelledby={id + "-preview"} data-cv-preview-draft={draftId ?? undefined}
          data-cv-scroll-requirement={highlight.scrollRequirementId}>
          <Stack spacing={0.75}>
            <Typography id={id + "-preview"} component="h2" variant="h6" sx={{ fontWeight: 750 }}>
              {t("generation_preview")}
            </Typography>
            {activeRequirement && (
              <Typography variant="body2" color="text.secondary" sx={wrap}>{describeEvidence(activeRequirement)}</Typography>
            )}
            <Box role="status" sx={visuallyHidden}>{pinnedRequirement && describeEvidence(pinnedRequirement)}</Box>
            {draftView && (draftView.receipt.vacancy_title || draftView.receipt.vacancy_company) && (
              <Typography variant="body2" color="text.secondary" sx={wrap}>
                {[draftView.receipt.vacancy_title, draftView.receipt.vacancy_company]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
            )}
          </Stack>
          {draftView && review && (
            <Button variant="outlined" startIcon={<AutoAwesomeOutlined />}
              disabled={!reviewReady || !editSelection || Boolean(reviewTarget)}
              onClick={() => { if (editSelection) setEditTarget({ view: draftView, selection: editSelection }); }}
              sx={{ ...primaryAction, alignSelf: { sm: "flex-start" } }}>
              {t("ai_edit.open")}
            </Button>
          )}
          {visible && visibleReview && (
            <Box hidden={!forPreviewAvailable}>
              <CvDraftPdf key={revisionKey} ref={pdfRef} generationId={visible.receipt.id}
                revision={visibleReview.revision} language={visible.receipt.language} active={active}
                initialTemplate={template} onTemplateChange={setTemplate}
                disabled={!pdfReady || Boolean(reviewTarget)} onDenial={onDenial}
                onSaved={() => setSavedRevision(revisionKey)} onSavingChange={setWritingVersion}
                onRefresh={() => { void workflow.status.refetch(); }} onOpenVersions={onOpenVersions} />
            </Box>
          )}
          {preview && draftView ? (
            <CvDraftDocument view={draftView} presentation={preview} activeRequirement={activeRequirement} />
          ) : workflow.status.isLoading ? (
            <Skeleton loading name="cv-draft-preview">
              <Box sx={{ height: 180 }} />
            </Skeleton>
          ) : (
            <Stack
              spacing={1}
              sx={{
                alignItems: "center",
                textAlign: "center",
                py: 3,
                px: 1,
                bgcolor: "action.hover",
                borderRadius: 2,
              }}
            >
              <DescriptionOutlined color="action" />
              <Typography variant="body2" color="text.secondary">
                {t("generation_preview_empty")}
              </Typography>
            </Stack>
          )}
        </Stack>
      </Box>
      {active && draftView && preview && (
        <Box sx={{ mt: 3 }}><CvApplicationDocuments view={draftView} onDenial={onDenial} /></Box>
      )}
      {active && editTarget && (
        <CvAiEditDialog base={editTarget.view} selection={editTarget.selection}
          connectionLabel={connections.find(item => item.connection_id === editTarget.selection.connection_id)?.label}
          onDenial={onDenial} onClose={() => setEditTarget(null)}
          onApply={(next) => workflow.applyEdit(editTarget.view, next)}
        />
      )}
      {exit.open && (
        <BaseModal open size="sm" title={t("draft_exit_title")} ariaDescribedBy={`${id}-draft-exit-description`}
          onClose={exit.keepEditing} showCloseButton={false} disableEscapeKeyDown={exit.saving}
          actions={
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ width: "100%", gap: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Button autoFocus color="inherit" disabled={exit.saving}
                sx={{ ...primaryAction, mr: { sm: "auto" } }} onClick={exit.keepEditing}>{t("draft_exit_keep")}</Button>
              <Button variant="outlined" color="error" disabled={exit.saving || writingVersion}
                sx={primaryAction} onClick={exit.discard}>{t("draft_exit_discard")}</Button>
              <Button variant="contained" loading={exit.saving} disabled={!pdfReady || writingVersion || Boolean(reviewTarget)}
                sx={primaryAction} onClick={() => void exit.saveAndLeave()}>{t("draft_exit_save")}</Button>
            </Stack>
          }>
          <Typography id={`${id}-draft-exit-description`} variant="body2" color="text.secondary">
            {t("draft_exit_description")}
          </Typography>
          {exit.saveFailed && <Alert severity="error">{t("draft_exit_save_error")}</Alert>}
        </BaseModal>
      )}
      {active &&
        reviewTarget?.view.receipt.review &&
        draftView?.receipt.id === reviewTarget.view.receipt.id && (
          <ReviewEvidenceDialog
            key={reviewTarget.view.receipt.id + ":" + reviewTarget.requirement.id}
            requirement={reviewTarget.requirement}
            facts={[
              ...(reviewTarget.view.receipt.draft?.selectedFacts ?? []),
              ...(reviewTarget.view.receipt.draft?.remainingFacts ?? []),
            ].filter((fact) => reviewTarget.requirement.evidenceIds.includes(fact.id))}
            baseline={reviewTarget.view.receipt.review}
            onSave={(input) => workflow.review(reviewTarget.view, input)}
            onReload={() => workflow.reloadReview(reviewTarget.view)}
            onError={workflow.reportError}
            onClose={() => setReviewTarget(null)}
          />
        )}
    </Box>
  );
}
