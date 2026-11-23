import { useEffect, useId, useRef, useState } from "react";
import { Box, Button, IconButton, LinearProgress, Pagination, Stack, Tooltip, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
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
  flashcardDeckTitleLimit, flashcardGeneralDeck, type Flashcard, type FlashcardDraft, type FlashcardSide,
} from "../../infrastructure/flashcards";
import { useFlashcardDecks, useFlashcards, useFlashcardWrites } from "../../infrastructure/useFlashcards";
import CalendarDrawer from "../StudyCalendar/CalendarDrawer";
import TeacherLoading from "../TeacherLoading";
import FlashcardContent from "./FlashcardContent";
import FlashcardCreateDrawer from "./FlashcardCreateDrawer";
import FlashcardEditor from "./FlashcardEditor";
import FlashcardReview from "./FlashcardReview";
import FlashcardRow from "./FlashcardRow";
import { DeckButton, DeckCount, FlashcardActions, FlashcardGrid, FlashcardHeader, FlashcardList, FlashcardPanel, FlashcardWorkspace } from "./styles";

type Drawer = { kind: "deck" | "create" } | { kind: "edit" | "browse"; card: Flashcard };

export default function Flashcards({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const headingId = useId();
  const listId = useId();
  const decksId = useId();
  const focusAfterBrowse = useRef(false);
  const activeDeckHeading = useRef<HTMLHeadingElement>(null);
  const [deckId, setDeckId] = useState<string>(flashcardGeneralDeck);
  const [page, setPage] = useState(1);
  const [review, setReview] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>();
  const [deleting, setDeleting] = useState<Flashcard>();
  const decks = useFlashcardDecks(active);
  const deck = decks.data?.find(item => item.id === deckId);
  const cards = useFlashcards(deckId, page, active && !review && Boolean(deck));
  const writes = useFlashcardWrites();
  const deckTitle = deckId === flashcardGeneralDeck ? t("teacher:flashcards.general") : deck?.title;
  const busy = decks.isFetching || cards.isFetching || writes.busy;
  const canCreate = !busy && Boolean(deck) && !decks.isError;
  const cardsInPage = cards.data?.meta.page === page ? cards.data.data : undefined;
  const closeDrawer = () => setDrawer(undefined);
  const selectDeck = (id: string) => {
    setDeckId(id);
    setPage(1);
  };
  const openNewCard = () => setDrawer({ kind: "create" });

  useEffect(() => {
    if (!active || review || busy || drawer || deleting || !focusAfterBrowse.current) return;
    activeDeckHeading.current?.focus();
    focusAfterBrowse.current = false;
  }, [active, review, busy, drawer, deleting]);

  const saveDeck = async (title: string) => {
    try {
      const created = await writes.createDeck(title);
      if (!created) return;
      selectDeck(created.id);
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
          <TeacherLoading loading={decks.isLoading}>
            {decks.data?.length ? <FlashcardList>
              {decks.data.map(item => <li key={item.id}>
                <DeckButton type="button" variant="outlined" aria-pressed={deckId === item.id}
                  disabled={busy} onClick={() => { if (item.id !== deckId) selectDeck(item.id); }}>
                  <LayersOutlined fontSize="small" sx={{ flexShrink: 0 }} />
                  <Typography component="span" variant="subtitle2" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {item.id === flashcardGeneralDeck ? t("teacher:flashcards.general") : item.title}
                  </Typography>
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
    {drawer?.kind === "create" && <FlashcardCreateDrawer decks={decks.data ?? []}
      initialValues={{ deck_id: deckId, question: "", answer: "" }} busy={writes.busy || decks.isFetching}
      createCard={writes.createCard} onClose={closeDrawer} onCreated={card => {
        selectDeck(card.deck_id);
        closeDrawer();
        focusAfterBrowse.current = true;
      }} />}
    {drawer?.kind === "edit" && <FlashcardEditor decks={decks.data ?? []} mode="edit" card={drawer.card}
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
});

type CreateDeckProps = { busy: boolean; onClose: () => void; onSave: (title: string) => Promise<void> };
function CreateDeckDrawer({ busy, onClose, onSave }: CreateDeckProps) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof deckFields>>({
    resolver: zodResolver(deckFields), defaultValues: { title: "" },
  });
  const locked = busy || isSubmitting;
  return <CalendarDrawer title={t("teacher:flashcards.new_deck")} busy={locked} onClose={onClose}>
    <Stack component="form" noValidate spacing={2} onSubmit={handleSubmit(({ title }) => onSave(title))}>
      <Controller name="title" control={control} render={({ field }) => (
        <TextInput {...field} required disabled={locked} label={t("teacher:flashcards.deck_title")}
          error={Boolean(errors.title)} helperText={errors.title?.message && t(errors.title.message, { limit: flashcardDeckTitleLimit })} />
      )} />
      <FlashcardActions sx={{ justifyContent: "flex-end" }}>
        <Button variant="outlined" disabled={locked} onClick={onClose}>{t("core:cancel")}</Button>
        <Button variant="contained" type="submit" disabled={locked}>{t("teacher:flashcards.create_deck")}</Button>
      </FlashcardActions>
    </Stack>
  </CalendarDrawer>;
}
