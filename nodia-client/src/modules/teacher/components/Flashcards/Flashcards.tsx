import { useEffect, useId, useRef, useState } from "react";
import { Box, Button, Chip, IconButton, LinearProgress, Pagination, Stack, Tooltip, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import ContentPasteOutlined from "@mui/icons-material/ContentPasteOutlined";
import LayersOutlined from "@mui/icons-material/LayersOutlined";
import PlayArrowOutlined from "@mui/icons-material/PlayArrowOutlined";
import { useTranslation } from "react-i18next";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import TextInput from "../../../../components/inputs/TextInput";
import {
  flashcardCategoryLimit, flashcardDeckTitleLimit, flashcardGeneralDeck, type Flashcard, type FlashcardDraft, type FlashcardSide,
} from "../../infrastructure/flashcards";
import type { FlashcardProposalParts } from "../../infrastructure/flashcardLibraryProposal";
import { useFlashcardDecks, useFlashcards, useFlashcardWrites } from "../../infrastructure/useFlashcards";
import CalendarDrawer from "../StudyCalendar/CalendarDrawer";
import TeacherLoading from "../TeacherLoading";
import FlashcardContent from "./FlashcardContent";
import FlashcardCreateDrawer from "./FlashcardCreateDrawer";
import FlashcardEditor from "./FlashcardEditor";
import FlashcardImportDrawer from "./FlashcardImportDrawer";
import FlashcardRegenerateDrawer from "./FlashcardRegenerateDrawer";
import FlashcardReview from "./FlashcardReview";
import FlashcardRow from "./FlashcardRow";
import { DeckButton, DeckCount, FlashcardActions, FlashcardGrid, FlashcardHeader, FlashcardList, FlashcardPanel, FlashcardWorkspace } from "./styles";

type Drawer = { kind: "deck" | "create" | "notes" | "import" } | { kind: "edit" | "browse"; card: Flashcard }
  | { kind: "regenerate"; card: Flashcard; parts: FlashcardProposalParts };
const categoryKey = (label?: string | null) => label?.toLocaleLowerCase("es").normalize("NFKC");

export default function Flashcards({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const headingId = useId();
  const listId = useId();
  const decksId = useId();
  const focusAfterBrowse = useRef(false);
  const activeDeckHeading = useRef<HTMLHeadingElement>(null);
  const [deckId, setDeckId] = useState<string>(flashcardGeneralDeck);
  const [categoryFilter, setCategoryFilter] = useState<string>();
  const [page, setPage] = useState(1);
  const [review, setReview] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>();
  const [deleting, setDeleting] = useState<Flashcard>();
  const decks = useFlashcardDecks(active);
  const deck = decks.data?.find(item => item.id === deckId);
  const categories = new Map<string, string>();
  for (const item of decks.data ?? []) {
    const key = categoryKey(item.category);
    if (key && item.category && !categories.has(key)) categories.set(key, item.category);
  }
  const activeCategory = categoryFilter && categories.has(categoryFilter) ? categoryFilter : undefined;
  const visibleDecks = activeCategory ? decks.data?.filter(item => categoryKey(item.category) === activeCategory) : decks.data;
  const cards = useFlashcards(deckId, page, active && !review && Boolean(deck));
  const writes = useFlashcardWrites();
  const deckTitle = deckId === flashcardGeneralDeck ? t("teacher:flashcards.general") : deck?.title;
  const busy = decks.isFetching || cards.isFetching || writes.busy;
  const canCreate = !busy && Boolean(deck) && !decks.isError;
  const cardsInPage = cards.data?.meta.page === page ? cards.data.data : undefined;
  const closeDrawer = () => setDrawer(undefined);
  const selectDeck = (id: string, category = decks.data?.find(item => item.id === id)?.category) => {
    if (activeCategory && activeCategory !== categoryKey(category)) setCategoryFilter(undefined);
    setDeckId(id);
    setPage(1);
  };
  const filterByCategory = (key?: string) => {
    setCategoryFilter(key);
    if (!key || key === categoryKey(deck?.category)) return;
    const firstMatch = decks.data?.find(item => categoryKey(item.category) === key);
    if (firstMatch) {
      setDeckId(firstMatch.id);
      setPage(1);
    }
  };
  const openNewCard = () => setDrawer({ kind: "create" });

  useEffect(() => {
    if (!active || review || busy || drawer || deleting || !focusAfterBrowse.current) return;
    activeDeckHeading.current?.focus();
    focusAfterBrowse.current = false;
  }, [active, review, busy, drawer, deleting]);

  const saveDeck = async (title: string, category?: string) => {
    try {
      const created = await writes.createDeck(title, category);
      if (!created) return;
      selectDeck(created.id, created.category);
      closeDrawer();
      focusAfterBrowse.current = true;
    } catch {
      // Keep title and drawer available after the transport reports the error.
    }
  };

  const saveCard = async (existing: Flashcard, draft: FlashcardDraft, side: FlashcardSide) => {
    try {
      const updated = await writes.updateCard(existing.id, {
        ...draft, revision: existing.revision,
        ...(existing.image && draft.image === undefined && side !== existing.image.side ? { image_side: side } : {}),
      });
      if (!updated) return false;
      if (updated.deck_id !== existing.deck_id) {
        selectDeck(updated.deck_id);
        focusAfterBrowse.current = true;
      }
      closeDrawer();
      return true;
    } catch {
      return false;
    }
  };

  const deleteCard = async (card: Flashcard) => {
    try {
      if (!await writes.deleteCard(card.id)) return;
      if (page > 1 && cardsInPage?.length === 1) setPage(page - 1);
      setDeleting(undefined);
      focusAfterBrowse.current = true;
    } catch {
      // Keep the explicit confirmation intact for a retry.
    }
  };

  if (review) return <FlashcardReview key={deckId} deckId={deckId} decks={decks.data ?? []} active={active}
    busy={writes.busy || decks.isFetching} rateCard={writes.rateCard} onSelectDeck={selectDeck}
    onClose={() => { focusAfterBrowse.current = true; setReview(false); }} />;

  return <Stack component="section" aria-labelledby={headingId} spacing={3} sx={{ minWidth: 0 }}>
    <FlashcardHeader>
      <Typography component="h2" id={headingId} variant="h5" sx={{ fontWeight: 700 }}>
        {t("teacher:flashcards.heading")}
      </Typography>
      <FlashcardActions>
        <Button variant="outlined" startIcon={<ContentPasteOutlined />} disabled={!canCreate} onClick={() => setDrawer({ kind: "import" })}>
          {t("teacher:flashcard_import.title")}
        </Button>
        <Button variant="outlined" startIcon={<AutoAwesomeOutlined />} disabled={!canCreate} onClick={() => setDrawer({ kind: "notes" })}>
          {t("teacher:flashcard_proposal.from_notes")}
        </Button>
        <Button variant="contained" startIcon={<AddOutlined />} disabled={!canCreate} onClick={openNewCard}>
          {t("teacher:flashcards.new_card")}
        </Button>
      </FlashcardActions>
    </FlashcardHeader>
    <FlashcardWorkspace>
      <FlashcardPanel aria-labelledby={decksId}>
        <Stack spacing={1}>
          <FlashcardHeader>
            <Typography id={decksId} component="h3" variant="h6">{t("teacher:flashcards.decks")}</Typography>
            <Tooltip title={t("teacher:flashcards.new_deck")}>
              <span>
                <IconButton type="button" aria-label={t("teacher:flashcards.new_deck")} disabled={busy}
                  onClick={() => setDrawer({ kind: "deck" })} sx={{ width: 44, height: 44 }}><AddOutlined /></IconButton>
              </span>
            </Tooltip>
          </FlashcardHeader>
          <QueryErrorAlert retryVariant="outlined" isError={decks.isError} isFetching={decks.isFetching} onRetry={decks.refetch} />
          {categories.size > 0 && <Stack role="group" aria-label={t("teacher:flashcard_import.category_filter")}
            direction="row" useFlexGap spacing={0.75} sx={{ flexWrap: "wrap", "& .MuiChip-root": { minHeight: 44, maxWidth: "100%" } }}>
            <Chip component="button" type="button" label={t("teacher:flashcard_import.category_all")}
              color={!activeCategory ? "primary" : "default"} variant={!activeCategory ? "filled" : "outlined"}
              aria-pressed={!activeCategory} onClick={() => filterByCategory()} disabled={busy} />
            {[...categories].map(([key, category]) => (
              <Chip component="button" type="button" key={key} label={category}
                color={activeCategory === key ? "primary" : "default"} variant={activeCategory === key ? "filled" : "outlined"}
                aria-pressed={activeCategory === key} onClick={() => filterByCategory(key)} disabled={busy} />
            ))}
          </Stack>}
          <TeacherLoading loading={decks.isLoading}>
            {visibleDecks?.length ? <FlashcardList>
              {visibleDecks.map(item => <li key={item.id}>
                <DeckButton type="button" variant="outlined" aria-pressed={deckId === item.id}
                  disabled={busy} onClick={() => { if (item.id !== deckId) selectDeck(item.id); }}>
                  <LayersOutlined fontSize="small" sx={{ flexShrink: 0 }} />
                  <Stack component="span" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    <Typography component="span" variant="subtitle2">
                      {item.id === flashcardGeneralDeck ? t("teacher:flashcards.general") : item.title}
                    </Typography>
                    {item.category && <Typography component="span" variant="caption" color="text.secondary">{item.category}</Typography>}
                  </Stack>
                  <DeckCount aria-label={t("teacher:flashcards.card_count", { count: item.card_count })}>{item.card_count}</DeckCount>
                </DeckButton>
              </li>)}
            </FlashcardList> : decks.data && <Typography color="text.secondary">{t("teacher:flashcards.empty_decks")}</Typography>}
          </TeacherLoading>
        </Stack>
      </FlashcardPanel>
      <FlashcardPanel aria-labelledby={listId}>
        <Stack spacing={2}>
          <FlashcardHeader>
            <Box>
              <Typography id={listId} ref={activeDeckHeading} tabIndex={-1} component="h3" variant="h6">
                {deckTitle ?? t("teacher:flashcards.deck_cards")}
              </Typography>
              {deck && <Typography variant="body2" color="text.secondary">
                {t("teacher:flashcards.card_count", { count: deck.card_count })}
              </Typography>}
              {deck?.category && <Chip size="small" label={deck.category} sx={{ mt: 0.5, maxWidth: "100%" }} />}
            </Box>
            <FlashcardActions>
              <Button variant="outlined" startIcon={<PlayArrowOutlined />} disabled={busy || !deck?.card_count}
                onClick={() => setReview(true)}>{t("teacher:flashcards.start_review")}</Button>
            </FlashcardActions>
          </FlashcardHeader>
          <QueryErrorAlert retryVariant="outlined" isError={cards.isError} isFetching={cards.isFetching} onRetry={cards.refetch} />
          {cards.isFetching && !cards.isLoading && cardsInPage && <LinearProgress aria-label={t("core:loading_route")} />}
          <TeacherLoading loading={decks.isLoading || cards.isLoading}>
            {cardsInPage && (cardsInPage.length ? <FlashcardGrid>
              {cardsInPage.map(card => <FlashcardRow key={card.id} card={card} busy={busy} active={active}
                onOpen={() => setDrawer({ kind: "browse", card })}
                onEdit={() => setDrawer({ kind: "edit", card })}
                onRegenerate={parts => setDrawer({ kind: "regenerate", card, parts })}
                onDelete={() => setDeleting(card)} />)}
            </FlashcardGrid> : <Box sx={{ px: 2, py: 3, textAlign: "center", border: 1, borderColor: "divider", borderRadius: 1.5 }}>
              <Typography color="text.secondary">{t("teacher:flashcards.empty_deck")}</Typography>
            </Box>)}
          </TeacherLoading>
          {cards.data && cards.data.meta.total_pages > 1 && <Pagination variant="outlined" page={page}
            count={cards.data.meta.total_pages} disabled={busy} siblingCount={0}
            sx={{ "& .MuiPaginationItem-root": { minWidth: 44, height: 44 }, "& .MuiPagination-ul": { rowGap: 0.5 } }}
            onChange={(_, value) => setPage(value)} />}
        </Stack>
      </FlashcardPanel>
    </FlashcardWorkspace>

    {drawer?.kind === "deck" && <CreateDeckDrawer busy={writes.busy} onClose={closeDrawer} onSave={saveDeck} />}
    {drawer?.kind === "import" && <FlashcardImportDrawer decks={decks.data ?? []}
      busy={writes.busy || decks.isFetching} save={writes.importCards} onClose={closeDrawer} onImported={({ deck: imported }) => {
        selectDeck(imported.id, imported.category);
        closeDrawer();
        focusAfterBrowse.current = true;
      }} />}
    {(drawer?.kind === "create" || drawer?.kind === "notes") && <FlashcardCreateDrawer decks={decks.data ?? []}
      title={drawer.kind === "notes" ? t("teacher:flashcard_proposal.from_notes") : undefined}
      libraryRequest={drawer.kind === "notes" ? { origin: { kind: "notes" } } : undefined}
      initialValues={{ deck_id: deckId, question: "", answer: "" }} busy={writes.busy || decks.isFetching}
      createCard={writes.createCard} onClose={closeDrawer} onCreated={card => {
        selectDeck(card.deck_id);
        closeDrawer();
        focusAfterBrowse.current = true;
      }} />}
    {drawer?.kind === "edit" && <FlashcardEditor decks={decks.data ?? []} mode="edit" card={drawer.card}
      busy={writes.busy || decks.isFetching} onClose={closeDrawer} onSave={(draft, side) => saveCard(drawer.card, draft, side)} />}
    {drawer?.kind === "regenerate" && <FlashcardRegenerateDrawer decks={decks.data ?? []} card={drawer.card} parts={drawer.parts}
      busy={writes.busy || decks.isFetching} onClose={closeDrawer} onSave={(draft, side) => saveCard(drawer.card, draft, side)} />}
    {drawer?.kind === "browse" && <CalendarDrawer title={t("teacher:flashcards.view_card")}
      description={deckTitle} onClose={closeDrawer}>
      <FlashcardContent card={drawer.card} revealed />
    </CalendarDrawer>}
    {deleting && <ConfirmDialog open title={t("teacher:flashcards.delete_card")}
      message={t("teacher:flashcards.delete_message", { question: deleting.question, deck: deckTitle })}
      onClose={() => setDeleting(undefined)} onConfirm={() => { void deleteCard(deleting); }}
      confirmText={t("teacher:flashcards.delete")} isLoading={writes.busy} />}
  </Stack>;
}

const deckFields = z.object({
  title: z.string().trim().min(1, "teacher:flashcards.required").max(flashcardDeckTitleLimit, "teacher:flashcards.deck_title_limit"),
  category: z.string().trim().max(flashcardCategoryLimit, "teacher:flashcard_import.category_limit"),
});

type CreateDeckProps = { busy: boolean; onClose: () => void; onSave: (title: string, category?: string) => Promise<void> };
function CreateDeckDrawer({ busy, onClose, onSave }: CreateDeckProps) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof deckFields>>({
    resolver: zodResolver(deckFields), defaultValues: { title: "", category: "" },
  });
  const locked = busy || isSubmitting;
  return <CalendarDrawer title={t("teacher:flashcards.new_deck")} busy={locked} onClose={onClose}>
    <Stack component="form" noValidate spacing={2} onSubmit={handleSubmit(({ title, category }) => onSave(title, category || undefined))}>
      <Controller name="title" control={control} render={({ field }) => (
        <TextInput {...field} required disabled={locked} label={t("teacher:flashcards.deck_title")}
          error={Boolean(errors.title)} helperText={errors.title?.message && t(errors.title.message, { limit: flashcardDeckTitleLimit })} />
      )} />
      <Controller name="category" control={control} render={({ field }) => (
        <TextInput {...field} disabled={locked} label={t("teacher:flashcard_import.category_optional")}
          error={Boolean(errors.category)} helperText={errors.category?.message && t(errors.category.message, { limit: flashcardCategoryLimit })} />
      )} />
      <FlashcardActions sx={{ justifyContent: "flex-end" }}>
        <Button variant="outlined" disabled={locked} onClick={onClose}>{t("core:cancel")}</Button>
        <Button variant="contained" type="submit" disabled={locked}>{t("teacher:flashcards.create_deck")}</Button>
      </FlashcardActions>
    </Stack>
  </CalendarDrawer>;
}
