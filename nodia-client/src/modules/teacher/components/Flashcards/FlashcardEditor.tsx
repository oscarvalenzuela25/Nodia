import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Box, Button, CircularProgress, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import UploadOutlined from "@mui/icons-material/UploadOutlined";
import { useTranslation } from "react-i18next";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import TextInput from "../../../../components/inputs/TextInput";
import {
  flashcardGeneralDeck, flashcardSourceLabelLimit, flashcardTextLimit, type Flashcard,
  type FlashcardDeck, type FlashcardDraft, type FlashcardSide,
} from "../../infrastructure/flashcards";
import { flashcardImageAccept, prepareFlashcardImage } from "../../infrastructure/flashcardImage";
import { useFlashcardImage } from "../../infrastructure/useFlashcards";
import CalendarDrawer from "../StudyCalendar/CalendarDrawer";
import FlashcardTextGeneration, { type FlashcardTextRequest } from "./FlashcardTextGeneration";
import { FlashcardActions, FlashcardMediaFields, FlashcardMediaPreview } from "./styles";

const fieldSchema = z.object({
  question: z.string().trim().min(1, "teacher:flashcards.required").max(flashcardTextLimit, "teacher:flashcards.text_limit"),
  answer: z.string().trim().min(1, "teacher:flashcards.required").max(flashcardTextLimit, "teacher:flashcards.text_limit"),
  deckId: z.string().min(1, "teacher:flashcards.required"),
  source: z.string().trim().max(flashcardSourceLabelLimit, "teacher:flashcards.source_limit"),
  side: z.enum(["question", "answer"]),
});
type EditorValues = z.input<typeof fieldSchema>;

export type FlashcardEditorProps = {
  decks: readonly FlashcardDeck[];
  initialValues?: FlashcardDraft;
  card?: Flashcard;
  mode?: "create" | "edit" | "lesson";
  title?: string;
  busy?: boolean;
  status?: ReactNode;
  textRequest?: FlashcardTextRequest;
  uncertain?: boolean;
  onRetry?: () => void;
  onClose: () => void;
  onSave: (draft: FlashcardDraft, existingImageSide: FlashcardSide) => Promise<boolean>;
};

export function FlashcardEditor({
  decks, initialValues, card, mode = "create", title: titleOverride, busy = false, status, textRequest, uncertain = false,
  onRetry, onClose, onSave,
}: FlashcardEditorProps) {
  const { t } = useTranslation();
  const source = card?.source ?? initialValues?.source;
  const uploadErrorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const uploadInFlight = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [replacement, setReplacement] = useState<string | null | undefined>(initialValues?.image?.data);
  const image = useFlashcardImage(card, replacement === undefined);
  const { control, handleSubmit, setValue, setFocus, formState: { errors, isSubmitting } } = useForm<EditorValues>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      question: card?.question ?? initialValues?.question ?? "",
      answer: card?.answer ?? initialValues?.answer ?? "",
      deckId: card?.deck_id ?? initialValues?.deck_id ?? flashcardGeneralDeck,
      source: source?.label ?? "",
      side: card?.image?.side ?? initialValues?.image?.side ?? "answer",
    },
  });
  const deckId = useWatch({ control, name: "deckId" });
  const deckOptions = decks.map(deck => ({
    value: deck.id,
    label: deck.id === flashcardGeneralDeck ? t("teacher:flashcards.general") : deck.title,
  }));
  const deckAvailable = deckOptions.some(option => option.value === deckId);
  const preview = replacement === undefined ? image.src : replacement ? "data:image/webp;base64," + replacement : null;
  const hasImage = Boolean(replacement || (replacement === undefined && card?.image));
  const blocked = busy || isSubmitting || preparing;
  const locked = blocked || uncertain;

  const upload = async (file: File) => {
    if (locked || uploadInFlight.current) return;
    uploadInFlight.current = true;
    setPreparing(true);
    setUploadError(false);
    try {
      const result = await prepareFlashcardImage(file);
      setReplacement(result.data);
    } catch {
      setUploadError(true);
    } finally {
      uploadInFlight.current = false;
      setPreparing(false);
    }
  };

  const save = async (values: EditorValues) => {
    const draft: FlashcardDraft = {
      question: values.question,
      answer: values.answer,
      deck_id: values.deckId,
    };
    // An unchanged label can represent an anchor the server temporarily redacted.
    if (!card || values.source !== (source?.label ?? "")) {
      draft.source = source?.anchor ? source : values.source ? { label: values.source } : null;
    }
    if (replacement !== undefined) draft.image = replacement ? { data: replacement, side: values.side } : null;
    try {
      await onSave(draft, values.side);
    } catch {
      // The caller reports transport errors. Preserve the current form and image.
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (locked || uploadInFlight.current || !deckAvailable) {
      event.preventDefault();
      return;
    }
    void handleSubmit(save)(event);
  };

  const title = titleOverride ?? t(mode === "edit" ? "teacher:flashcards.edit_card" : mode === "lesson"
    ? "teacher:flashcards.review_card" : "teacher:flashcards.new_card");
  const saveLabel = t(mode === "edit" ? "teacher:flashcards.save_changes" : "teacher:flashcards.save_card");

  return <CalendarDrawer title={title} busy={blocked} onClose={onClose}>
    <Stack component="form" noValidate onSubmit={submit} spacing={2}>
      {status}
      {source?.anchor && <Box sx={{ borderInlineStart: 3, borderColor: "primary.main", paddingInlineStart: 1.5, py: 0.5 }}>
        <Typography component="p" variant="subtitle2">{source.label}</Typography>
        <Typography component="blockquote" variant="body2" color="text.secondary" sx={{ m: 0 }}>
          {source.anchor.selection}
        </Typography>
      </Box>}
      {textRequest && <FlashcardTextGeneration request={textRequest} disabled={locked} onApply={proposal => {
        setValue("question", proposal.question, { shouldDirty: true, shouldValidate: true });
        setValue("answer", proposal.answer, { shouldDirty: true, shouldValidate: true });
        setFocus("question");
      }} />}
      <Controller control={control} name="question" render={({ field }) => (
        <TextInput {...field} label={t("teacher:flashcards.question")} required disabled={locked}
          placeholder={t("teacher:flashcards.question_placeholder")}
          error={Boolean(errors.question)} helperText={errors.question?.message && t(errors.question.message, { limit: flashcardTextLimit })} />
      )} />
      <Controller control={control} name="answer" render={({ field }) => (
        <TextInput {...field} label={t("teacher:flashcards.answer")} required disabled={locked} multiline minRows={3} maxRows={9}
          placeholder={t("teacher:flashcards.answer_placeholder")}
          error={Boolean(errors.answer)} helperText={errors.answer?.message && t(errors.answer.message, { limit: flashcardTextLimit })} />
      )} />
      <Controller control={control} name="deckId" render={({ field }) => (
        <SelectSingleInput label={t("teacher:flashcards.deck")} required options={deckOptions} clearable={false}
          disabled={locked} value={field.value} onChange={value => field.onChange(value ?? flashcardGeneralDeck)} />
      )} />
      {!source?.anchor && <Controller control={control} name="source" render={({ field }) => (
        <TextInput {...field} label={t("teacher:flashcards.source_optional")} disabled={locked}
          placeholder={t("teacher:flashcards.source_placeholder")}
          error={Boolean(errors.source)} helperText={errors.source?.message && t(errors.source.message, { limit: flashcardSourceLabelLimit })} />
      )} />}
      <Stack spacing={1}>
        <Typography component="h3" variant="subtitle1">{t("teacher:flashcards.image")}</Typography>
        <FlashcardMediaFields>
          <FlashcardMediaPreview>
            {preview && <img src={preview} alt={t("teacher:flashcards.image_preview")} />}
            {!preview && <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "text.secondary" }}>
              {preparing || image.isLoading
                ? <CircularProgress size={22} aria-label={t("teacher:flashcards.loading_image")} />
                : <ImageOutlined aria-hidden="true" />}
            </Box>}
            {hasImage && <Tooltip title={t("teacher:flashcards.remove_image")}>
              <IconButton type="button" aria-label={t("teacher:flashcards.remove_image")} disabled={locked}
                onClick={() => { setReplacement(null); setUploadError(false); }}
                sx={{ position: "absolute", insetInlineEnd: 0, top: 0, width: 44, height: 44, bgcolor: "background.paper", "&:hover": { bgcolor: "background.default" } }}>
                <DeleteOutlineOutlined />
              </IconButton>
            </Tooltip>}
          </FlashcardMediaPreview>
          <Stack spacing={1} sx={{ minWidth: 0 }}>
            <input ref={input} type="file" accept={flashcardImageAccept} hidden disabled={locked} onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void upload(file);
            }} />
            <Button type="button" variant="outlined" startIcon={<UploadOutlined />} disabled={locked}
              aria-describedby={uploadError ? uploadErrorId : undefined} onClick={() => input.current?.click()}
              sx={{ minHeight: 44, px: 1, overflowWrap: "anywhere" }}>
              {t("teacher:flashcards.upload_image")}
            </Button>
            <Controller control={control} name="side" render={({ field }) => (
              <SelectSingleInput label={t("teacher:flashcards.image_side")} disabled={locked} clearable={false}
                value={field.value} onChange={value => field.onChange(value === "answer" ? "answer" : "question")}
                options={[
                  { value: "question", label: t("teacher:flashcards.image_with_question") },
                  { value: "answer", label: t("teacher:flashcards.image_with_answer") },
                ]} />
            )} />
          </Stack>
        </FlashcardMediaFields>
        {uploadError && <Alert id={uploadErrorId} severity="error">{t("teacher:flashcards.image_upload_error")}</Alert>}
        {replacement === undefined && image.isError && <Alert severity="error"
          action={<Button variant="outlined" color="inherit" disabled={locked} onClick={() => { void image.refetch(); }} sx={{ minHeight: 44 }}>
            {t("core:retry")}
          </Button>}>{t("teacher:flashcards.image_load_error")}</Alert>}
      </Stack>
      {uncertain && <Alert severity="warning">{t("teacher:flashcards.create_uncertain")}</Alert>}
      <FlashcardActions sx={{ justifyContent: "flex-end" }}>
        <Button type="button" variant="outlined" disabled={blocked} onClick={onClose}>{t("core:cancel")}</Button>
        {uncertain ? <Button type="button" variant="contained" disabled={blocked || !onRetry} onClick={onRetry}>{t("core:retry")}</Button>
          : <Button type="submit" variant="contained" disabled={blocked || !deckAvailable}>{saveLabel}</Button>}
      </FlashcardActions>
    </Stack>
  </CalendarDrawer>;
}

export default FlashcardEditor;
