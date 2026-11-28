import { useEffect, useId, useRef, useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Chip, Pagination,
  Stack, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import { visuallyHidden } from "@mui/utils";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import TextInput from "../../../../components/inputs/TextInput";
import {
  fitsFlashcardImportRequest, flashcardCollectionTitleKey, flashcardImportDestinationSchema, flashcardImportLimit, parseFlashcardImport, selectedFlashcardSetDecks,
  type FlashcardImportBatch, type FlashcardImportIssue, type FlashcardImportPlan, type FlashcardImportReceipt,
} from "../../infrastructure/flashcardImport";
import {
  flashcardCategoryLimit, flashcardDeckTitleLimit, flashcardGeneralDeck, flashcardSourceLabelLimit, flashcardTextLimit,
  type FlashcardDeck, type FlashcardSet,
} from "../../infrastructure/flashcards";
import CalendarDrawer from "../StudyCalendar/CalendarDrawer";
import { FlashcardActions } from "./styles";

type Props = {
  decks: readonly FlashcardDeck[];
  sets: readonly FlashcardSet[];
  setsUnavailable?: boolean;
  initialSetId?: string;
  newDeckOnly?: boolean;
  busy: boolean;
  save: (batch: FlashcardImportBatch, requestKey: string) => Promise<FlashcardImportReceipt | null>;
  onImported: (receipt: FlashcardImportReceipt) => void;
  onClose: () => void;
};

type ReviewDraft = {
  plan: FlashcardImportPlan;
  selected: boolean[];
  mode: "existing" | "new";
  deckId: string;
  title: string;
  category: string;
};
type WriteIntent = { batch: FlashcardImportBatch; key: string };
type ExampleMode = "one" | "deck" | "set";
const previewPageSize = 6;

export default function FlashcardImportDrawer({ decks, sets, setsUnavailable, initialSetId, newDeckOnly = false, busy, save, onImported, onClose }: Props) {
  const { t } = useTranslation("teacher");
  const pasteId = useId();
  const instructionsId = useId();
  const pasteErrorId = useId();
  const previewId = useId();
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const returnToInput = useRef(false);
  const currentWrite = useRef<WriteIntent | null>(null);
  const writing = useRef(false);
  const [input, setInput] = useState("");
  const [issue, setIssue] = useState<FlashcardImportIssue>();
  const [review, setReview] = useState<ReviewDraft>();
  const [setId, setSetId] = useState<string | null>(initialSetId ?? null);
  const [page, setPage] = useState(1);
  const [exampleMode, setExampleMode] = useState<ExampleMode>("deck");
  const [clipboardFallback, setClipboardFallback] = useState<string>();
  const [announcement, setAnnouncement] = useState<{ id: string; title: string }>();
  const [copying, setCopying] = useState(false);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const requestInProgress = busy || pending;
  const locked = requestInProgress || uncertain;
  const previewing = Boolean(review);

  useEffect(() => {
    if (previewing) previewHeading.current?.focus();
    else if (returnToInput.current) {
      returnToInput.current = false;
      document.getElementById(pasteId)?.focus();
    }
  }, [pasteId, previewing]);

  const exampleDeck = { title: t("flashcard_import.example.title"), category: t("flashcard_import.example.category") };
  const firstExample = {
    question: t("flashcard_import.example.question"),
    answer: t("flashcard_import.example.answer"),
    source: t("flashcard_import.example.source"),
  };
  const secondExample = {
    question: t("flashcard_import.example.second_question"),
    answer: t("flashcard_import.example.second_answer"),
  };
  const example = JSON.stringify(exampleMode === "set" ? {
    version: 1,
    set: { title: t("flashcard_import.example.set_title") },
    decks: [
      { ...exampleDeck, cards: [firstExample] },
      { title: t("flashcard_import.example.second_deck"), cards: [secondExample] },
    ],
  } : {
    version: 1,
    ...(exampleMode === "deck" ? { deck: exampleDeck } : {}),
    cards: exampleMode === "deck" ? [firstExample, secondExample] : [firstExample],
  }, null, 2);

  const changeInput = (value: string) => {
    setInput(value);
    setIssue(undefined);
    setReview(undefined);
  };

  const confirm = (label: "copied" | "example_loaded") => {
    const title = t("flashcard_import." + label);
    setAnnouncement({ id: sileo.success({ title }), title });
  };

  const showPreview = () => {
    const result = parseFlashcardImport(input, newDeckOnly);
    if (result.issue) {
      setIssue(result.issue);
      document.getElementById(pasteId)?.focus();
      return;
    }
    setIssue(undefined);
    setPage(1);
    const { plan } = result;
    const deck = "decks" in plan ? (newDeckOnly ? plan.decks[0] : undefined) : plan.deck;
    setReview({
      plan,
      selected: ("decks" in plan ? plan.decks.flatMap(deck => deck.cards) : plan.cards).map(() => true),
      mode: deck ? "new" : "existing",
      deckId: flashcardGeneralDeck,
      title: deck?.title ?? "",
      category: deck?.category ?? "",
    });
  };

  const copyFormat = async () => {
    if (copying) return;
    const prompt = t("flashcard_import.prompt_" + exampleMode, {
      example, limit: flashcardImportLimit, titleLimit: flashcardDeckTitleLimit, categoryLimit: flashcardCategoryLimit,
      textLimit: flashcardTextLimit, sourceLimit: flashcardSourceLabelLimit,
    });
    setCopying(true);
    try {
      await navigator.clipboard.writeText(prompt);
      setClipboardFallback(undefined);
      confirm("copied");
    } catch {
      setClipboardFallback(prompt);
      sileo.error({ title: t("flashcard_import.copy_failed"), description: t("flashcard_import.copy_manual") });
    } finally {
      setCopying(false);
    }
  };

  const plan = review?.plan;
  const wrappedSetPlan = plan && "decks" in plan ? plan : undefined;
  const setPlan = newDeckOnly && setId ? undefined : wrappedSetPlan;
  const previewCards = wrappedSetPlan
    ? wrappedSetPlan.decks.flatMap(deck => deck.cards.map(card => ({ card, deck: setPlan ? deck : undefined })))
    : (plan && "cards" in plan ? plan.cards : []).map(card => ({ card, deck: undefined }));
  const selectedCards = previewCards.filter((_, index) => review?.selected[index]).map(({ card }) => card);
  const previewStart = (page - 1) * previewPageSize;
  const previewPages = Math.ceil(previewCards.length / previewPageSize);
  const selectedDeck = decks.find(deck => deck.id === review?.deckId);
  const selectedSet = sets.find(set => set.id === setId);
  const setUnavailable = Boolean(setId && !selectedSet) || setsUnavailable;
  const namedSet = setPlan && sets.find(set =>
    flashcardCollectionTitleKey(set.title) === flashcardCollectionTitleKey(setPlan.set.title));
  const destination = flashcardImportDestinationSchema.safeParse(review?.mode === "existing"
    ? { kind: "existing", deck_id: selectedDeck?.id }
    : { kind: "new", title: review?.title, category: review?.category.trim() || undefined, set_id: selectedSet?.id });
  const validDestination = destination.success && (destination.data.kind === "existing" || (selectedSet && !setUnavailable));
  const batch: FlashcardImportBatch | null = !review || !selectedCards.length ? null
    : setPlan ? { set: setPlan.set, decks: selectedFlashcardSetDecks(setPlan.decks, review.selected) }
    : validDestination ? { destination: destination.data, cards: selectedCards } : null;
  const tooLarge = batch !== null && !fitsFlashcardImportRequest(batch);
  const category = review?.mode === "new" ? review.category.trim() : selectedDeck?.category;
  const updateReview = (changes: Partial<Omit<ReviewDraft, "plan">>) => {
    setReview(current => current && { ...current, ...changes });
  };

  const saveBatch = async () => {
    if (writing.current || requestInProgress) return;
    const intent = currentWrite.current ?? (batch && !tooLarge ? { batch, key: crypto.randomUUID() } : null);
    if (!intent) return;
    currentWrite.current = intent;
    writing.current = true;
    setPending(true);
    try {
      const receipt = await save(intent.batch, intent.key);
      if (!receipt) {
        setUncertain(true);
        return;
      }
      currentWrite.current = null;
      setUncertain(false);
      onImported(receipt);
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const possiblySaved = status === undefined || status === 408 || status >= 500;
      if (!possiblySaved) currentWrite.current = null;
      setUncertain(possiblySaved);
    } finally {
      writing.current = false;
      setPending(false);
    }
  };

  return <CalendarDrawer title={t(newDeckOnly ? "flashcard_sets.create_from_json" : "flashcard_import.title")}
    busy={requestInProgress} onClose={onClose}>
    <Stack spacing={2}>
      {review ? <>
        <Stack component="section" aria-labelledby={previewId} spacing={1.5}>
          <Typography id={previewId} ref={previewHeading} tabIndex={-1} variant="h6" component="h3">
            {t("flashcard_import.preview")}
          </Typography>
          {review.mode === "new" && (newDeckOnly || !setPlan) &&
            <SelectSingleInput label={t("flashcard_sets.set_required")} value={setId} onChange={setSetId}
              placeholder={t(wrappedSetPlan ? "flashcard_import.set_from_json" : "flashcard_sets.set_placeholder")}
              required={!wrappedSetPlan} clearable={Boolean(wrappedSetPlan)} disabled={locked || setsUnavailable}
              error={setUnavailable} helperText={setUnavailable ? t("flashcard_sets.set_unavailable")
                : !setId && !wrappedSetPlan ? t("flashcard_sets.set_needed") : undefined}
              options={sets.map(set => ({ value: set.id, label: set.title }))} />}
          {setPlan ? <>
            <Typography variant="subtitle1" sx={{ overflowWrap: "anywhere" }}>
              {t(namedSet ? "flashcard_import.existing_set_destination"
                : setsUnavailable ? "flashcard_import.set_destination_unknown" : "flashcard_import.set_destination",
              { title: namedSet?.title ?? setPlan.set.title })}
            </Typography>
            <Typography variant="body2" color="text.secondary">{t("flashcard_import.set_selection")}</Typography>
          </> : <>
            {!newDeckOnly && <ToggleButtonGroup exclusive size="small" value={review.mode} disabled={locked}
              aria-label={t("flashcard_import.destination")} onChange={(_, mode: ReviewDraft["mode"] | null) => {
                if (mode) updateReview({ mode });
              }} sx={{ alignSelf: "start", "& .MuiToggleButton-root": { minHeight: 44 } }}>
              <ToggleButton value="existing">{t("flashcard_import.existing_deck")}</ToggleButton>
              <ToggleButton value="new">{t("flashcards.new_deck")}</ToggleButton>
            </ToggleButtonGroup>}
            {review.mode === "existing" ? <SelectSingleInput label={t("flashcards.deck")} value={review.deckId}
              disabled={locked} clearable={false} onChange={id => { if (id) updateReview({ deckId: id }); }}
              options={decks.map(deck => ({
                value: deck.id,
                label: deck.id === flashcardGeneralDeck ? t("flashcards.general") : deck.title,
              }))} /> : <>
                <TextInput label={t("flashcards.deck_title")} required value={review.title} disabled={locked}
                  onChange={event => updateReview({ title: event.target.value })} />
                <TextInput label={t("flashcard_import.category_optional")} value={review.category} disabled={locked}
                  onChange={event => updateReview({ category: event.target.value })} />
                {!destination.success && <Typography variant="body2" color="text.secondary">
                  {t("flashcard_import.destination_invalid", { titleLimit: flashcardDeckTitleLimit, categoryLimit: flashcardCategoryLimit })}
                </Typography>}
              </>}
            {review.mode === "existing" && !selectedDeck && <Alert severity="warning">{t("flashcard_import.deck_unavailable")}</Alert>}
            {category && <Chip size="small" label={category} sx={{ alignSelf: "start", maxWidth: "100%" }} />}
          </>}
        </Stack>
        <Typography role="status" variant="body2" color="text.secondary">
          {t("flashcard_import.selected_count", { count: selectedCards.length, total: previewCards.length })}
        </Typography>
        <Stack component="ul" spacing={1} sx={{ m: 0, p: 0, listStyle: "none" }}>
          {previewCards.slice(previewStart, previewStart + previewPageSize).map(({ card, deck }, localIndex) => {
            const index = previewStart + localIndex;
            const cardId = previewId + "-" + index;
            return <Box component="li" key={index} sx={{ display: "flex", alignItems: "start", minWidth: 0, gap: 0.5 }}>
              <Checkbox checked={review.selected[index]} disabled={locked}
                slotProps={{ input: { "aria-labelledby": deck ? cardId + " " + cardId + "-deck" : cardId } }}
                onChange={(_, checked) => updateReview({ selected: review.selected.map((value, position) => position === index ? checked : value) })}
                sx={{ minWidth: 44, minHeight: 44 }} />
              <Stack sx={{ minWidth: 0, flex: 1 }}>
                {deck && <Typography id={cardId + "-deck"} variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                  {t("flashcard_import.card_deck", { title: deck.title })}{deck.category && " · " + deck.category}
                </Typography>}
                <Accordion defaultExpanded={localIndex === 0} disableGutters elevation={0} variant="outlined"
                  slotProps={{ transition: { unmountOnExit: true } }} sx={{
                    minWidth: 0, flex: 1, borderRadius: 1, "&:before": { display: "none" },
                    "& .MuiAccordionSummary-root:not(.Mui-expanded) .MuiTypography-root": {
                      display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden",
                    },
                  }}>
                  <AccordionSummary id={cardId} aria-controls={cardId + "-details"} expandIcon={<ExpandMoreOutlined />}>
                    <Typography component="span" variant="subtitle2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{card.question}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={0.5}>
                      <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{card.answer}</Typography>
                      {card.source && <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                        {t("flashcard_import.source", { source: card.source })}
                      </Typography>}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Stack>
            </Box>;
          })}
        </Stack>
        {previewPages > 1 && <Pagination count={previewPages} page={page} disabled={requestInProgress}
          siblingCount={0} boundaryCount={1} onChange={(_, next) => setPage(next)}
          aria-label={t("flashcard_import.pagination")}
          getItemAriaLabel={(type, value) => t("flashcard_import.pagination_" + type, { page: value })}
          sx={{ "& .MuiPaginationItem-root": { minWidth: 44, minHeight: 44 } }} />}
        {tooLarge && <Alert severity="error">{t("flashcard_import.errors.request_size")}</Alert>}
        {uncertain && <Alert severity="warning">{t("flashcard_import.uncertain")}</Alert>}
        <FlashcardActions sx={{ justifyContent: "flex-end" }}>
          <Button variant="outlined" disabled={locked} onClick={() => {
            returnToInput.current = true;
            setReview(undefined);
          }}>{t("flashcard_import.edit_json")}</Button>
          <Button variant="contained" disabled={requestInProgress || (!uncertain && (!batch || tooLarge))}
            loading={pending} onClick={() => void saveBatch()}>
            {uncertain ? t("core:retry") : t("flashcard_import.save_selected", { count: selectedCards.length })}
          </Button>
        </FlashcardActions>
      </> : <>
        <Typography id={instructionsId} variant="body2" color="text.secondary">
          {t(newDeckOnly ? "flashcard_import.deck_instructions" : "flashcard_import.instructions")}
        </Typography>
        {!newDeckOnly && <ToggleButtonGroup exclusive size="small" value={exampleMode} disabled={requestInProgress || copying}
          aria-label={t("flashcard_import.template_type")} onChange={(_, mode: ExampleMode | null) => {
            if (mode) { setExampleMode(mode); setClipboardFallback(undefined); }
          }} sx={{ alignSelf: "start", maxWidth: "100%", "& .MuiToggleButton-root": { minHeight: 44, minWidth: 0 } }}>
          <ToggleButton value="one">{t("flashcard_import.single_example")}</ToggleButton>
          <ToggleButton value="deck">{t("flashcard_import.deck_example")}</ToggleButton>
          <ToggleButton value="set">{t("flashcard_import.set_example")}</ToggleButton>
        </ToggleButtonGroup>}
        <FlashcardActions>
          <Button variant="outlined" startIcon={<ContentCopyOutlined />} disabled={requestInProgress} loading={copying}
            onClick={() => void copyFormat()}>{t("flashcard_import.copy_format")}</Button>
          <Button variant="outlined" disabled={requestInProgress} onClick={() => {
            changeInput(example);
            confirm("example_loaded");
          }}>
            {t("flashcard_import.load_example")}
          </Button>
        </FlashcardActions>
        <Box component="span" role="status" sx={visuallyHidden}>
          {announcement && <span key={announcement.id}>{announcement.title}</span>}
        </Box>
        {clipboardFallback && <Box>
          <Typography variant="body2">{t("flashcard_import.copy_manual")}</Typography>
          <Box component="pre" tabIndex={0} aria-label={t("flashcard_import.copy_format")}
            sx={{ m: 0, p: 1, whiteSpace: "pre-wrap", overflowWrap: "anywhere", bgcolor: "action.hover", borderRadius: 1 }}>
            {clipboardFallback}
          </Box>
        </Box>}
        <TextInput id={pasteId} label={t("flashcard_import.input")} value={input} multiline minRows={9} maxRows={14}
          disabled={requestInProgress} error={Boolean(issue)} aria-describedby={issue ? pasteErrorId : instructionsId}
          onChange={event => changeInput(event.target.value)} />
        {issue && <Alert severity="error" id={pasteErrorId}>
          {t("flashcard_import.errors." + issue.code, {
            limit: flashcardImportLimit,
            index: "index" in issue ? issue.index : undefined,
            deckIndex: "deckIndex" in issue ? issue.deckIndex : undefined,
          })}
        </Alert>}
        <FlashcardActions sx={{ justifyContent: "flex-end" }}>
          <Button variant="outlined" disabled={requestInProgress} onClick={onClose}>{t("core:cancel")}</Button>
          <Button variant="contained" disabled={requestInProgress || !input.trim()}
            onClick={showPreview}>{t("flashcard_import.review")}</Button>
        </FlashcardActions>
      </>}
    </Stack>
  </CalendarDrawer>;
}
