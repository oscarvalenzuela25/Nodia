import { useEffect, useId, useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import { useTranslation } from "react-i18next";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import TextInput from "../../../../components/inputs/TextInput";
import {
  flashcardNotesMaxBytes, flashcardProposalPending, proposalPartPending,
  type FlashcardProposalOrigin, type FlashcardProposalParts, type FlashcardProposalStatus,
} from "../../infrastructure/flashcardLibraryProposal";
import { connectionsSchema, type Selection } from "../../infrastructure/schemas";
import { useFlashcardLibraryProposal } from "../../infrastructure/useFlashcardLibraryProposal";
import { useFlashcardProposalSelection } from "../../infrastructure/useFlashcardProposalSelection";
import { useTeacherQuery } from "../../infrastructure/useServices";
import type { FlashcardTextProposal } from "../../infrastructure/flashcardGeneration";
import { FlashcardProposalSelection } from "./FlashcardProposalSelection";
import { FlashcardActions } from "./styles";

export type FlashcardLibraryRequest = {
  origin: Exclude<FlashcardProposalOrigin, { kind: "notes" }> | { kind: "notes" };
  initialParts?: FlashcardProposalParts;
};

type Props = {
  request: FlashcardLibraryRequest;
  disabled: boolean;
  onUseText: (proposal: FlashcardTextProposal) => void;
  onUseImage: (file: File) => Promise<boolean>;
};

const encoder = new TextEncoder();

export default function FlashcardProposalPanel({ request, disabled, onUseText, onUseImage }: Props) {
  const { t } = useTranslation();
  const headingId = useId();
  const [notes, setNotes] = useState("");
  const [parts, setParts] = useState<FlashcardProposalParts>(request.initialParts ?? "both");
  const [textChoice, setTextChoice] = useState<Selection | null>(null);
  const [imageChoice, setImageChoice] = useState<Selection | null>(null);
  const proposal = useFlashcardLibraryProposal();
  const controlsLocked = disabled || !proposal.authenticated || proposal.submitting || proposal.started || proposal.uncertain;
  const needsText = parts !== "image";
  const needsImage = parts !== "text";
  const catalog = useTeacherQuery("connections", connectionsSchema, undefined, !proposal.started && !proposal.uncertain);
  const text = useFlashcardProposalSelection("text", textChoice, catalog, needsText && !controlsLocked);
  const image = useFlashcardProposalSelection("image", imageChoice, catalog, needsImage && !controlsLocked);
  const optionsAvailable = text.options.length > 0;
  const normalizedNotes = request.origin.kind === "notes" ? notes.trim() : "";
  const noteSize = encoder.encode(normalizedNotes).byteLength;
  const notesTooLarge = noteSize > flashcardNotesMaxBytes;
  const notesInvalid = normalizedNotes.includes("\u0000") || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(normalizedNotes);
  const notesValid = request.origin.kind !== "notes" || (noteSize > 0 && !notesTooLarge && !notesInvalid);
  const status = !proposal.status.isError && !proposal.expired ? proposal.status.data : undefined;
  const pending = Boolean(status && flashcardProposalPending(status));
  const unknown = status?.text.state === "unknown" || status?.image.state === "unknown";
  const canGenerate = !controlsLocked && notesValid && (!needsText || text.ready) && (!needsImage || image.ready);

  const start = () => {
    if (!canGenerate) return;
    const origin = request.origin.kind === "notes" ? { ...request.origin, notes: normalizedNotes } : request.origin;
    void proposal.start({
      origin, parts,
      ...(needsText && text.selection && { text_selection: text.selection }),
      ...(needsImage && image.selection && { image_selection: image.selection }),
    });
  };

  return <Stack component="section" aria-labelledby={headingId} spacing={1.5}
    sx={{ minWidth: 0, p: 1.5, border: 1, borderRadius: 1.5, borderColor: "divider", overflowWrap: "anywhere" }}>
    <Stack spacing={0.5}>
      <Typography id={headingId} component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
        {t("teacher:flashcard_proposal.heading")}
      </Typography>
      <Typography variant="body2" color="text.secondary">{t("teacher:flashcard_proposal.description")}</Typography>
    </Stack>
    {request.origin.kind === "notes" && <TextInput label={t("teacher:flashcard_proposal.notes")} required multiline minRows={3}
      maxRows={10} value={notes} onChange={event => setNotes(event.target.value)} disabled={controlsLocked}
      error={notesTooLarge || notesInvalid}
      helperText={notesTooLarge ? t("teacher:flashcard_proposal.notes_too_large", { limit: flashcardNotesMaxBytes })
        : notesInvalid ? t("teacher:flashcard_proposal.notes_invalid") : undefined} />}
    {!proposal.started && !proposal.uncertain && <>
      <SelectSingleInput label={t("teacher:flashcard_proposal.output")} value={parts} clearable={false} disabled={controlsLocked}
        options={(request.origin.kind === "card" ? (["text", "image", "both"] as const) : (["text", "both"] as const))
          .map(part => ({ value: part, label: t(`teacher:flashcard_proposal.parts.${part}`) }))}
        onChange={value => { if (value === "text" || value === "image" || value === "both") setParts(value); }} />
      <QueryErrorAlert retryVariant="outlined" isError={catalog.isError} isFetching={catalog.isFetching} onRetry={catalog.refetch} />
      {catalog.isFetching && <Typography role="status" variant="body2">{t("teacher:checking_selection")}</Typography>}
      {catalog.isSuccess && !optionsAvailable && <Alert severity="info">{t("teacher:flashcard_proposal.no_connections")}</Alert>}
      {optionsAvailable && <>
        {needsText && <FlashcardProposalSelection kind="text" state={text} choice={textChoice}
          disabled={controlsLocked || catalog.isFetching || catalog.isError} onChange={setTextChoice} />}
        {needsImage && <FlashcardProposalSelection kind="image" state={image} choice={imageChoice}
          disabled={controlsLocked || catalog.isFetching || catalog.isError} onChange={setImageChoice} />}
      </>}
      <FlashcardActions>
        <Button type="button" variant="contained" startIcon={<AutoAwesomeOutlined />} disabled={!canGenerate}
          loading={proposal.submitting} onClick={start}>
          {t("teacher:flashcard_proposal.generate")}
        </Button>
      </FlashcardActions>
    </>}
    {proposal.uncertain && <>
      <Alert severity="warning">{t("teacher:flashcard_generation.receipt_uncertain")}</Alert>
      <FlashcardActions>
        <Button type="button" variant="outlined" disabled={disabled || proposal.submitting}
          onClick={() => { void proposal.reconcile(); }}>{t("teacher:flashcard_generation.check_status")}</Button>
      </FlashcardActions>
    </>}
    {proposal.expired && <Alert severity="info">{t("teacher:flashcard_proposal.expired")}</Alert>}
    {!proposal.expired && <>
      <QueryErrorAlert retryVariant="outlined" isError={proposal.status.isError} isFetching={proposal.status.isFetching}
        onRetry={proposal.status.refetch} />
      {proposal.started && !status && !proposal.status.isError && <Typography role="status" variant="body2">
        {t("teacher:flashcard_proposal.checking")}
      </Typography>}
      {unknown && <FlashcardActions>
        <Button type="button" variant="outlined" disabled={disabled || proposal.status.isFetching}
          onClick={() => { void proposal.status.refetch(); }}>{t("teacher:flashcard_generation.check_status")}</Button>
      </FlashcardActions>}
    </>}
    {status && <ProposalPreview key={status.id} status={status} image={proposal.image.isError ? undefined : proposal.image.data} imageError={proposal.image.isError}
      imageLoading={proposal.image.isFetching} retryImage={proposal.image.refetch}
      disabled={disabled || !proposal.authenticated} onUseText={onUseText} onUseImage={onUseImage} />}
    {(proposal.expired || (status && !pending && !unknown)) && <FlashcardActions>
      <Button type="button" variant="outlined" disabled={disabled || proposal.submitting} onClick={proposal.reset}>
        {t("teacher:flashcard_proposal.new_proposal")}
      </Button>
    </FlashcardActions>}
  </Stack>;
}

function ProposalPreview({ status, image, imageError, imageLoading, retryImage, disabled, onUseText, onUseImage }: {
  status: FlashcardProposalStatus;
  image: Blob | undefined;
  imageError: boolean;
  imageLoading: boolean;
  retryImage: () => void;
} & Pick<Props, "disabled" | "onUseText" | "onUseImage">) {
  const { t } = useTranslation();
  const [textApplied, setTextApplied] = useState(false);
  const [imageApplied, setImageApplied] = useState(false);
  const [preview, setPreview] = useState<{ blob: Blob; url: string }>();
  const [undisplayable, setUndisplayable] = useState<string>();
  const previewUrl = preview?.blob === image ? preview?.url : undefined;
  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image);
    const update = window.setTimeout(() => setPreview({ blob: image, url }), 0);
    return () => { window.clearTimeout(update); URL.revokeObjectURL(url); };
  }, [image]);

  return <Stack spacing={1.5}>
    <Typography component="h4" variant="subtitle2">{t("teacher:flashcard_proposal.preview")}</Typography>
    {status.text.state !== "skipped" && <PartProgress kind="text" part={status.text} />}
    {status.text.value && <Stack spacing={1.25}>
      <Box component="dl" sx={{ m: 0, display: "grid", gap: 0.5 }}>
        <Typography component="dt" variant="subtitle2">{t("teacher:flashcards.question")}</Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0, whiteSpace: "pre-wrap" }}>{status.text.value.question}</Typography>
        <Typography component="dt" variant="subtitle2">{t("teacher:flashcards.answer")}</Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0, whiteSpace: "pre-wrap" }}>{status.text.value.answer}</Typography>
      </Box>
      <FlashcardActions>
        <Button type="button" variant="outlined" disabled={disabled || textApplied} onClick={() => {
          if (status.text.value) { onUseText(status.text.value); setTextApplied(true); }
        }}>{t(textApplied ? "teacher:flashcard_proposal.applied_text" : "teacher:flashcard_generation.apply")}</Button>
      </FlashcardActions>
    </Stack>}
    {status.image.state !== "skipped" && <PartProgress kind="image" part={status.image} />}
    {status.image.state === "ready" && <>
      {imageLoading && <Typography role="status" variant="body2">{t("teacher:flashcards.loading_image")}</Typography>}
      <QueryErrorAlert retryVariant="outlined" isError={imageError} isFetching={imageLoading} onRetry={retryImage} />
      {previewUrl && previewUrl === undisplayable && <Alert severity="error">{t("teacher:flashcard_proposal.preview_image_error")}</Alert>}
      {image && previewUrl && previewUrl !== undisplayable && <>
        <Box component="img" src={previewUrl} alt={t("teacher:flashcard_proposal.preview_image")}
          onError={() => setUndisplayable(previewUrl)} sx={{
            display: "block", width: "100%", aspectRatio: "3 / 2", objectFit: "contain",
            border: 1, borderRadius: 1.5, borderColor: "divider", bgcolor: "action.hover",
          }} />
        <FlashcardActions>
          <Button type="button" variant="outlined" disabled={disabled || imageApplied} onClick={() => {
            void onUseImage(new File([image], "flashcard-proposal", { type: image.type })).then(setImageApplied);
          }}>{t(imageApplied ? "teacher:flashcard_proposal.applied_image" : "teacher:flashcard_proposal.use_image")}</Button>
        </FlashcardActions>
      </>}
    </>}
  </Stack>;
}

function PartProgress({ kind, part }: { kind: "text" | "image"; part: FlashcardProposalStatus["image"] }) {
  const { t, i18n } = useTranslation();
  const label = t(`teacher:flashcard_proposal.parts.${kind}`);
  if (proposalPartPending(part.state)) return <Typography role="status" variant="body2">
    {t("teacher:flashcard_proposal.preparing_part", { part: label })}
  </Typography>;
  if (part.state !== "failed" && part.state !== "unknown") return null;
  const errorKey = part.error_code
    ? [`teacher:${part.error_code}`, `teacher:reasons.${part.error_code}`].find(key => i18n.exists(key))
    : undefined;
  return <Alert severity={part.state === "unknown" ? "warning" : "error"}>
    {t(part.state === "unknown" ? "teacher:flashcard_proposal.unknown_part" : "teacher:flashcard_proposal.failed_part", { part: label })}
    {errorKey && <Typography variant="body2" component="p">{t(errorKey)}</Typography>}
  </Alert>;
}
