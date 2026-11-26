import { useId, useState } from "react";
import { Alert, Box, Button, Divider, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import { zodResolver } from "@hookform/resolvers/zod";
import { Skeleton } from "boneyard-js/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
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
import {
  useCvGenerationWorkflow,
  type CvGenerationView,
} from "../../infrastructure/useCvGenerationWorkflow";
import CvModelSelector from "../CvModelSelector";
import CvDraftPdf from "../CvDraftPdf";
import CvRequirements from "../CvRequirements/CvRequirements";
import CvDraftDocument from "./CvDraftDocument";
import ReviewEvidenceDialog from "./ReviewEvidenceDialog";
import { cvPrimaryHover } from "./styles";

const primaryAction = { minHeight: 44, width: { xs: "100%", sm: "auto" }, flexShrink: 0 };
const panel = { borderRadius: 2, minWidth: 0, p: { xs: 2, sm: 2.5 } };
const wrap = { overflowWrap: "anywhere" } as const;

type Props = { active: boolean; onCreateProfile: () => void; onDenial: () => void; onOpenVersions: () => void };
type ReviewTarget = { view: CvGenerationView; requirement: CvRequirement };

export default function CvGeneration({ active, onCreateProfile, onDenial, onOpenVersions }: Props) {
  const { t, i18n } = useTranslation("nodiaCv");
  const id = useId();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [selection, setSelection] = useState<NodiaAiSelection | null>(null);
  const [workingSelection, setWorkingSelection] = useState<NodiaAiSelection | null>(null);
  const [selectionDirty, setSelectionDirty] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  if (!active && reviewTarget) setReviewTarget(null);

  const profiles = useCvProfilesForGeneration(active);
  const profileDetail = useProfileDetail(active ? profileId : null);
  const catalog = useCvCatalog(active);
  const candidateSelection = selectionDirty ? workingSelection : selection;
  const eligibility = useCvEligibility(candidateSelection, active);
  const workflow = useCvGenerationWorkflow(active, onDenial);

  useCvHttpNotice(profiles.error, onDenial);
  useCvHttpNotice(profileDetail.error, onDenial);
  useCvHttpNotice(catalog.error, onDenial);
  useCvHttpNotice(eligibility.error, onDenial);
  useCvHttpNotice(workflow.status.error, onDenial);

  const { control, handleSubmit, reset } = useForm<CvOffer>({
    resolver: zodResolver(cvOfferSchema),
    mode: "onTouched",
    defaultValues: {
      language: i18n.resolvedLanguage?.startsWith("en") ? "en" : "es",
      vacancy_title: "",
      vacancy_company: "",
      offer_text: "",
    },
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
    profile && profileRevisionCurrent && selection && validated.success
      ? { ...validated.data, profile_id: profile.id, profile_revision: profile.revision, selection }
      : null;
  const identity = draftInput ? cvInputIdentity(draftInput) : null;
  const visible = workflow.visible;
  const draftView = visible && !selectionDirty && !workflow.busy && !workflow.uncertain &&
    identity === cvInputIdentity(visible.intent) ? visible : null;
  const draft = draftView?.receipt.draft;
  const review = draftView?.receipt.review;
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
    Boolean(workflow.uncertain) ||
    Boolean(workflow.restorable) ||
    Boolean(unknownSame);
  const status = workflow.receipt?.state;
  const displayedState = workflow.expired
    ? "generation_expired"
    : status && (status !== "ready" || draftView)
      ? "generation_state." + status
      : null;

  const submit = handleSubmit(
    (values) => {
      if (blocked || !profile || !selection) return;
      workflow.generate(
        { ...values, profile_id: profile.id, profile_revision: profile.revision, selection },
        profile,
      );
    },
    (errors) => {
      if (errors.offer_text) requestAnimationFrame(() => document.getElementById(id + "-offer")?.focus());
      else if (errors.vacancy_title)
        requestAnimationFrame(() => document.getElementById(id + "-vacancy_title")?.focus());
      else if (errors.vacancy_company)
        requestAnimationFrame(() => document.getElementById(id + "-vacancy_company")?.focus());
    },
  );
  const forPreviewAvailable = Boolean(draftView && draft);
  const reviewReady = Boolean(
    draftView &&
    review &&
    !workflow.status.isFetching &&
    !workflow.status.isError &&
    !workflow.busy,
  );
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
  const restoreSaved = async () => {
    const restored = await workflow.recover();
    if (!restored) return;
    setProfileId(restored.profile_id);
    setSelection(restored.selection);
    setWorkingSelection(null);
    setSelectionDirty(false);
    reset({
      language: restored.language,
      vacancy_title: restored.vacancy_title,
      vacancy_company: restored.vacancy_company,
      offer_text: restored.offer_text,
    });
  };

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
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Stack
            component={Paper}
            variant="outlined"
            spacing={2.25}
            sx={panel}
            aria-labelledby={id + "-prepare"}
          >
            <Typography id={id + "-prepare"} component="h2" variant="h6" sx={{ fontWeight: 750 }}>
              {t("generation_prepare")}
            </Typography>
            <QueryErrorAlert
              isError={profiles.isError}
              isFetching={profiles.isFetching}
              onRetry={profiles.refetch}
              retryVariant="outlined"
            />
            {profileId && (
              <QueryErrorAlert
                isError={profileDetail.isError}
                isFetching={profileDetail.isFetching}
                onRetry={profileDetail.refetch}
                retryVariant="outlined"
              />
            )}
            {noProfiles && (
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
                void submit(event);
              }}
            >
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
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<AutoAwesomeOutlined />}
                  sx={[primaryAction, cvPrimaryHover]}
                  loading={workflow.busy && !workflow.uncertain}
                  disabled={blocked}
                >
                  {t("generation_start")}
                </Button>
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
                      : t(cvEligibilityReasonKey(appliedEligibility?.reason_code ?? null))}
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
            {(status === "unknown" || unknownSame) && (
              <Alert severity="warning">
                <Stack spacing={1} sx={{ alignItems: { xs: "stretch", sm: "flex-start" } }}>
                  <Typography variant="body2">{t("generation_unknown_help")}</Typography>
                  {status === "unknown" && (
                    <Button
                      color="inherit"
                      variant="outlined"
                      sx={primaryAction}
                      loading={workflow.status.isFetching}
                      onClick={() => {
                        void workflow.status.refetch();
                      }}
                    >
                      {t("generation_check_status")}
                    </Button>
                  )}
                </Stack>
              </Alert>
            )}
            {workflow.admissionError !== null && (
              <Alert severity="error">{getHttpErrorMessage(workflow.admissionError)}</Alert>
            )}
            {workflow.restorable && (
              <Alert severity="info">
                <Stack spacing={1.25}>
                  <Typography variant="body2">{t("generation_restore_saved")}</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, flexWrap: "wrap" }}>
                    <Button
                      color="inherit"
                      variant="outlined"
                      loading={workflow.busy}
                      sx={primaryAction}
                      onClick={() => {
                        void restoreSaved();
                      }}
                    >
                      {t("generation_restore_action")}
                    </Button>
                    {workflow.restoreMissing && (
                      <Button
                        color="inherit"
                        disabled={workflow.busy}
                        sx={primaryAction}
                        onClick={workflow.discardRestorable}
                      >
                        {t("generation_discard_recovery")}
                      </Button>
                    )}
                  </Stack>
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
          {draft && (
            <CvRequirements
              analysis={{
                requirements: draft.requirements,
                facts: [...draft.selectedFacts, ...draft.remainingFacts],
                evidence: review?.evidence ?? [],
              }}
              onReview={openReview}
              reviewDisabled={!reviewReady}
            />
          )}
        </Stack>
        <Stack component={Paper} variant="outlined" spacing={2} sx={panel} aria-labelledby={id + "-preview"}>
          <Stack spacing={0.75}>
            <Typography id={id + "-preview"} component="h2" variant="h6" sx={{ fontWeight: 750 }}>
              {t("generation_preview")}
            </Typography>
            {draftView?.receipt.vacancy_title && (
              <Typography variant="body2" color="text.secondary" sx={wrap}>
                {[draftView.receipt.vacancy_title, draftView.receipt.vacancy_company]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
            )}
          </Stack>
          {forPreviewAvailable && draftView ? (
            <>
              {review && (
                <CvDraftPdf key={draftView.receipt.id + ":" + review.revision} generationId={draftView.receipt.id}
                  revision={review.revision} language={draftView.receipt.language} active={active}
                  disabled={!reviewReady || Boolean(reviewTarget)} onDenial={onDenial}
                  onRefresh={() => { void workflow.status.refetch(); }} onOpenVersions={onOpenVersions} />
              )}
              <CvDraftDocument view={draftView} />
            </>
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
