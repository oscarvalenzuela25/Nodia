import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Box, Button, Chip, IconButton, LinearProgress, Pagination, Stack, Tooltip, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import ContentPasteOutlined from "@mui/icons-material/ContentPasteOutlined";
import CreateNewFolderOutlined from "@mui/icons-material/CreateNewFolderOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PlayArrowOutlined from "@mui/icons-material/PlayArrowOutlined";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import {
  flashcardDeckPageSize, flashcardGeneralDeck, type Flashcard, type FlashcardDeck, type FlashcardDeckFields,
  type FlashcardDraft, type FlashcardSet, type FlashcardSide,
} from "../../infrastructure/flashcards";
import { filterFlashcardLibrary, flashcardCategoryKey, flashcardDeckPage } from "../../infrastructure/flashcardLibrary";
import type { FlashcardProposalParts } from "../../infrastructure/flashcardLibraryProposal";
import { useFlashcardDecks, useFlashcards, useFlashcardSets, useFlashcardWrites } from "../../infrastructure/useFlashcards";
import CalendarDrawer from "../StudyCalendar/CalendarDrawer";
import TeacherLoading from "../TeacherLoading";
import { FlashcardCollectionDeck, FlashcardCollectionItems, FlashcardCollectionViewToggle, type FlashcardCollectionView } from "./FlashcardCollection";
import FlashcardContent from "./FlashcardContent";
import FlashcardCreateDrawer from "./FlashcardCreateDrawer";
import FlashcardDeckDrawer from "./FlashcardDeckDrawer";
import { FlashcardDeckPagination, FlashcardDeckTree, FlashcardLibraryMark } from "./FlashcardDeckTree";
import FlashcardEditor from "./FlashcardEditor";
import FlashcardImportDrawer from "./FlashcardImportDrawer";
import FlashcardRegenerateDrawer from "./FlashcardRegenerateDrawer";
import FlashcardReview from "./FlashcardReview";
import FlashcardRow from "./FlashcardRow";
import { FlashcardActions, FlashcardDetailHeader, FlashcardDetailPanel, FlashcardHeader, FlashcardWorkspace } from "./styles";

type Drawer = { kind: "create" | "notes" | "new-set" } | { kind: "new-deck"; setId?: string }
  | { kind: "import"; newDeckOnly?: boolean; setId?: string }
  | { kind: "edit-deck"; deck: FlashcardDeck } | { kind: "edit" | "browse"; card: Flashcard }
  | { kind: "regenerate"; card: Flashcard; parts: FlashcardProposalParts };
type Selection = { kind: "deck" | "set"; id: string };
type Deletion = { kind: "deck"; item: FlashcardDeck } | { kind: "set"; item: FlashcardSet } | { kind: "card"; item: Flashcard };
const noDecks: readonly FlashcardDeck[] = [];
const noSets: readonly FlashcardSet[] = [];

export default function Flashcards({ active }: { active: boolean }) {
  const { i18n, t } = useTranslation();
  const headingId = useId();
  const listId = useId();
  const focusAfterBrowse = useRef(false);
  const activeDeckHeading = useRef<HTMLHeadingElement>(null);
  const [selection, setSelection] = useState<Selection>({ kind: "deck", id: flashcardGeneralDeck });
  const [categoryFilter, setCategoryFilter] = useState("");
  const [setFilter, setSetFilter] = useState("");
  const [expandedSetIds, setExpandedSetIds] = useState<ReadonlySet<string>>(() => new Set());
  const [deckPages, setDeckPages] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [cardsView, setCardsView] = useState<FlashcardCollectionView>("grid");
  const [decksView, setDecksView] = useState<FlashcardCollectionView>("grid");
  const [page, setPage] = useState(1);
  const [review, setReview] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>();
  const [deleting, setDeleting] = useState<Deletion>();
  const decks = useFlashcardDecks(active);
  const sets = useFlashcardSets(active);
  const collator = useMemo(() => new Intl.Collator(i18n.resolvedLanguage, { numeric: true, sensitivity: "base" }), [i18n.resolvedLanguage]);
  const allDecks = useMemo(() => decks.data?.toSorted((a, b) => collator.compare(a.title, b.title) || a.id.localeCompare(b.id)) ?? noDecks,
    [decks.data, collator]);
  const allSets = sets.data ?? noSets;
  const deckId = selection.kind === "deck" ? selection.id : "";
  const selectedSet = selection.kind === "set" ? allSets.find(item => item.id === selection.id) : undefined;
  const deck = allDecks.find(item => item.id === deckId);
  const deckParent = allSets.find(item => item.id === deck?.set_id);
  const activeSetFilter = allSets.some(set => set.id === setFilter) ? setFilter : "";
  const activeCategory = categoryFilter && allDecks.some(item => flashcardCategoryKey(item.category) === categoryFilter) ? categoryFilter : "";
  const library = useMemo(() => filterFlashcardLibrary(allDecks, allSets, activeSetFilter, activeCategory),
    [allDecks, allSets, activeSetFilter, activeCategory]);
  const setDecks = (selectedSet && library.bySet.get(selectedSet.id)) || noDecks;
  const currentSetPage = flashcardDeckPage(setDecks, selectedSet && deckPages.get(selectedSet.id));
  const cards = useFlashcards(deckId, page, active && !review && Boolean(deck));
  const writes = useFlashcardWrites();
  const deckTitle = deckId === flashcardGeneralDeck ? t("teacher:flashcards.general") : deck?.title;
  const libraryBusy = decks.isFetching || sets.isFetching || writes.busy;
  const busy = libraryBusy || cards.isFetching;
  const canCreate = !busy && Boolean(library.general) && !decks.isError;
  const cardsInPage = cards.data?.meta.page === page ? cards.data.data : undefined;
  const closeDrawer = () => setDrawer(undefined);
  const setDeckPage = (id: string, value: number) => setDeckPages(previous => new Map(previous).set(id, value));
  const toggleSet = (id: string) => setExpandedSetIds(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const expandSet = (id: string) => setExpandedSetIds(previous => previous.has(id) ? previous : new Set(previous).add(id));
  const selectDeck = (id: string, item = allDecks.find(value => value.id === id)) => {
    if (item && id !== flashcardGeneralDeck) {
      const category = flashcardCategoryKey(item.category);
      const clearCategory = Boolean(activeCategory && activeCategory !== category);
      const clearSet = Boolean(activeSetFilter && activeSetFilter !== item.set_id);
      if (clearCategory) setCategoryFilter("");
      if (clearSet) setSetFilter("");
      if (item.set_id) {
        expandSet(item.set_id);
        const previousSiblings = allDecks.filter(candidate => candidate.id !== id && candidate.set_id === item.set_id &&
          (!activeCategory || clearCategory || flashcardCategoryKey(candidate.category) === activeCategory) &&
          (collator.compare(candidate.title, item.title) || candidate.id.localeCompare(item.id)) < 0);
        setDeckPage(item.set_id, Math.floor(previousSiblings.length / flashcardDeckPageSize) + 1);
      }
    }
    if (selection.kind !== "deck" || deckId !== id) {
      setSelection({ kind: "deck", id });
      setPage(1);
    }
  };
  const selectSet = (id: string) => {
    if (activeSetFilter && activeSetFilter !== id) {
      setSetFilter("");
      setDeckPages(new Map());
    }
    expandSet(id);
    setSelection({ kind: "set", id });
  };
  const filterByCategory = (key: string) => {
    setCategoryFilter(key);
    setDeckPages(new Map());
    if (!key || !deck || deck.id === flashcardGeneralDeck || flashcardCategoryKey(deck.category) === key) return;
    const first = filterFlashcardLibrary(allDecks, allSets, activeSetFilter, key).decks[0];
    if (first?.set_id) expandSet(first.set_id);
    setSelection({ kind: "deck", id: first?.id ?? flashcardGeneralDeck });
    setPage(1);
  };
  const filterBySet = (value: string) => {
    setSetFilter(value);
    setDeckPages(new Map());
    if (value) {
      expandSet(value);
      setSelection({ kind: "set", id: value });
    }
  };

  useEffect(() => {
    if (!active || review || busy || drawer || deleting || !focusAfterBrowse.current) return;
    activeDeckHeading.current?.focus();
    focusAfterBrowse.current = false;
  }, [active, review, busy, drawer, deleting]);

  const saveDeck = async (fields: FlashcardDeckFields) => {
    try {
      if (drawer?.kind === "new-set") {
        const created = await writes.createSet(fields.title);
        if (!created) return;
        setCategoryFilter("");
        selectSet(created.id);
        setDrawer({ kind: "new-deck", setId: created.id });
        return;
      }
      const saved = drawer?.kind === "edit-deck"
        ? await writes.updateDeck(drawer.deck.id, fields)
        : await writes.createDeck({ title: fields.title, category: fields.category ?? undefined, set_id: fields.set_id });
      if (!saved) return;
      selectDeck(saved.id, saved);
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

  const confirmDeletion = async (target: Deletion) => {
    try {
      if (target.kind === "card") {
        if (!await writes.deleteCard(target.item.id)) return;
        if (page > 1 && cardsInPage?.length === 1) setPage(page - 1);
      } else if (target.kind === "deck") {
        if (!await writes.deleteDeck(target.item.id)) return;
        if (deckId === target.item.id) {
          if (deckParent) selectSet(deckParent.id);
          else selectDeck(flashcardGeneralDeck);
        }
      } else {
        if (!await writes.deleteSet(target.item.id)) return;
        if (setFilter === target.item.id) setSetFilter("");
        setDeckPages(previous => {
          const next = new Map(previous);
          next.delete(target.item.id);
          return next;
        });
        setExpandedSetIds(previous => {
          const next = new Set(previous);
          next.delete(target.item.id);
          return next;
        });
        if (selectedSet?.id === target.item.id || deck?.set_id === target.item.id)
          selectDeck(flashcardGeneralDeck);
      }
      setDeleting(undefined);
      focusAfterBrowse.current = true;
    } catch {
      // Keep the explicit confirmation intact for a retry.
    }
  };

  if (review) return <FlashcardReview key={deckId} deckId={deckId} decks={decks.data ?? []} active={active}
    busy={libraryBusy} rateCard={writes.rateCard} onSelectDeck={selectDeck}
    onClose={() => { focusAfterBrowse.current = true; setReview(false); }} />;

  const title = selectedSet?.title ?? deckTitle ?? t("teacher:flashcards.deck_cards");
  const removingCard = deleting?.kind === "card";
  const removingSet = deleting?.kind === "set";
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
        <Button variant="contained" startIcon={<AddOutlined />} disabled={!canCreate} onClick={() => setDrawer({ kind: "create" })}>
          {t("teacher:flashcards.new_card")}
        </Button>
      </FlashcardActions>
    </FlashcardHeader>
    <FlashcardWorkspace>
      <FlashcardDeckTree sets={library.sets} decksBySet={library.bySet} generalDeck={library.general} setOptions={allSets}
        categoryOptions={library.categories} setFilter={activeSetFilter} categoryFilter={activeCategory}
        selectedSetId={selectedSet?.id} selectedDeckId={deckId} expandedSetIds={expandedSetIds} pages={deckPages}
        busy={libraryBusy} loading={decks.isLoading || sets.isLoading} hasError={decks.isError && !decks.data} setsUnavailable={sets.isError && !sets.data}
        onSetFilter={filterBySet} onCategoryFilter={filterByCategory} onToggleSet={toggleSet} onSelectSet={selectSet}
        onSelectDeck={item => selectDeck(item.id, item)} onPageChange={setDeckPage}
        onDeleteSet={item => setDeleting({ kind: "set", item })} onDeleteDeck={item => setDeleting({ kind: "deck", item })}
        actions={<FlashcardActions sx={{ "& > .MuiButton-root": { px: 1 } }}>
          <Button variant="outlined" startIcon={<CreateNewFolderOutlined />} disabled={libraryBusy || sets.isError}
            onClick={() => setDrawer({ kind: "new-set" })}>{t("teacher:flashcard_sets.new_set")}</Button>
          <Button variant="outlined" startIcon={<AddOutlined />} disabled={libraryBusy || decks.isError}
            onClick={() => setDrawer({ kind: "new-deck", setId: selectedSet?.id ?? deckParent?.id })}>{t("teacher:flashcards.new_deck")}</Button>
        </FlashcardActions>}
      >
        <QueryErrorAlert retryVariant="outlined" isError={decks.isError} isFetching={decks.isFetching} onRetry={decks.refetch} />
        <QueryErrorAlert retryVariant="outlined" isError={sets.isError} isFetching={sets.isFetching} onRetry={sets.refetch} />
      </FlashcardDeckTree>
      <FlashcardDetailPanel aria-labelledby={listId}>
        <Stack spacing={2}>
          {deckParent && <Button variant="outlined" startIcon={<FlashcardLibraryMark kind="set" />} disabled={libraryBusy}
            onClick={() => selectSet(deckParent.id)} sx={{ alignSelf: "flex-start", textAlign: "start", overflowWrap: "anywhere", maxWidth: "100%" }}>
            {deckParent.title}
          </Button>}
          <FlashcardDetailHeader>
            <Stack spacing={0.5} sx={{ gridArea: "summary", minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {(deck || selectedSet) && <FlashcardLibraryMark kind={selectedSet ? "set" : deckId === flashcardGeneralDeck ? "general" : "deck"} />}
                <Typography id={listId} ref={activeDeckHeading} tabIndex={-1} component="h3" variant="h6" sx={{ overflowWrap: "anywhere" }}>
                  {title}
                </Typography>
              </Stack>
              {deck && <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Typography variant="body2" color="text.secondary">{t("teacher:flashcards.card_count", { count: deck.card_count })}</Typography>
                {deck.category && <Chip size="small" label={deck.category} sx={{ maxWidth: "100%" }} />}
              </Stack>}
              {selectedSet && <Typography variant="body2" color="text.secondary">
                {t("teacher:flashcard_sets.deck_count", { count: setDecks.length })}
              </Typography>}
            </Stack>
            {selectedSet ? <LibraryTrash title={t("teacher:flashcard_sets.delete_set_label", { title })}
              disabled={libraryBusy} onClick={() => setDeleting({ kind: "set", item: selectedSet })} />
              : deck && deckId !== flashcardGeneralDeck && <LibraryTrash title={t("teacher:flashcard_sets.delete_deck_label", { title })}
                disabled={busy} onClick={() => setDeleting({ kind: "deck", item: deck })} />}
            {selectedSet && <FlashcardActions sx={{ gridArea: "actions" }}>
              <Button variant="outlined" startIcon={<AddOutlined />} disabled={libraryBusy || decks.isError}
                onClick={() => setDrawer({ kind: "new-deck", setId: selectedSet.id })}>{t("teacher:flashcards.new_deck")}</Button>
            </FlashcardActions>}
            {deck && <FlashcardActions sx={{ gridArea: "actions" }}>
              {deckId !== flashcardGeneralDeck && <Button variant="outlined" startIcon={<EditOutlined />} disabled={busy}
                onClick={() => setDrawer({ kind: "edit-deck", deck })}>{t("teacher:flashcard_sets.edit_deck")}</Button>}
              <Button variant="outlined" startIcon={<PlayArrowOutlined />} disabled={busy || !deck.card_count}
                onClick={() => setReview(true)}>{t("teacher:flashcards.start_review")}</Button>
            </FlashcardActions>}
          </FlashcardDetailHeader>
          {selectedSet && <>
            {currentSetPage.data.length > 0 ? <>
              <FlashcardCollectionViewToggle value={decksView} onChange={setDecksView} disabled={libraryBusy} />
              <FlashcardCollectionItems mode={decksView} aria-label={t("teacher:flashcard_sets.decks_in_set")}>
                {currentSetPage.data.map(item => <FlashcardCollectionDeck key={item.id} deck={item} mode={decksView} busy={libraryBusy}
                  onSelect={() => selectDeck(item.id, item)} onDelete={() => setDeleting({ kind: "deck", item })} />)}
              </FlashcardCollectionItems>
              <FlashcardDeckPagination page={currentSetPage.page} total={setDecks.length} disabled={libraryBusy}
                onPageChange={value => setDeckPage(selectedSet.id, value)} />
            </> : <LibraryEmpty>{t(activeCategory ? "teacher:flashcard_sets.no_matches" : "teacher:flashcard_sets.empty_set")}</LibraryEmpty>}
          </>}
          {deck && <>
            <QueryErrorAlert retryVariant="outlined" isError={cards.isError} isFetching={cards.isFetching} onRetry={cards.refetch} />
            {cards.isFetching && !cards.isLoading && cardsInPage && <LinearProgress aria-label={t("core:loading_route")} />}
            <TeacherLoading loading={cards.isLoading}>
              {cardsInPage && (cardsInPage.length ? <Stack spacing={1.5}>
                <FlashcardCollectionViewToggle value={cardsView} onChange={setCardsView} disabled={busy} />
                <FlashcardCollectionItems mode={cardsView} aria-label={t("teacher:flashcards.heading")}>
                  {cardsInPage.map(card => <FlashcardRow key={card.id} card={card} mode={cardsView} category={deck.category} busy={busy} active={active}
                    onOpen={() => setDrawer({ kind: "browse", card })}
                    onEdit={() => setDrawer({ kind: "edit", card })}
                    onRegenerate={parts => setDrawer({ kind: "regenerate", card, parts })}
                    onDelete={() => setDeleting({ kind: "card", item: card })} />)}
                </FlashcardCollectionItems>
              </Stack> : <LibraryEmpty>{t("teacher:flashcards.empty_deck")}</LibraryEmpty>)}
            </TeacherLoading>
            {cards.data && cards.data.meta.total_pages > 1 && <Pagination variant="outlined" page={page}
              count={cards.data.meta.total_pages} disabled={busy} siblingCount={0}
              sx={{ "& .MuiPaginationItem-root": { minWidth: 44, height: 44 }, "& .MuiPagination-ul": { rowGap: 0.5 } }}
              onChange={(_, value) => setPage(value)} />}
          </>}
          {!selectedSet && !deck && <TeacherLoading loading={decks.isLoading || sets.isLoading}>
            <LibraryEmpty>{t("teacher:flashcard_sets.selection_unavailable")}</LibraryEmpty>
          </TeacherLoading>}
        </Stack>
      </FlashcardDetailPanel>
    </FlashcardWorkspace>

    {(drawer?.kind === "new-set" || drawer?.kind === "new-deck" || drawer?.kind === "edit-deck") &&
      <FlashcardDeckDrawer key={drawer.kind} kind={drawer.kind} sets={allSets} setsUnavailable={!sets.data} busy={libraryBusy}
        initial={drawer.kind === "edit-deck" ? drawer.deck : drawer.kind === "new-deck" ? { set_id: drawer.setId } : undefined}
        onClose={closeDrawer} onSave={saveDeck}
        onImportJson={setId => setDrawer({ kind: "import", newDeckOnly: true, setId })} />}
    {drawer?.kind === "import" && <FlashcardImportDrawer decks={allDecks} sets={allSets}
      initialSetId={drawer.setId} newDeckOnly={drawer.newDeckOnly} setsUnavailable={!sets.data}
      busy={writes.busy || decks.isFetching || sets.isFetching} save={writes.importCards} onClose={closeDrawer} onImported={receipt => {
        if ("set" in receipt) {
          setCategoryFilter("");
          selectSet(receipt.set.id);
        } else {
          const imported = receipt.deck;
          selectDeck(imported.id, allDecks.find(item => item.id === imported.id) ?? imported);
        }
        closeDrawer();
        focusAfterBrowse.current = true;
      }} />}
    {(drawer?.kind === "create" || drawer?.kind === "notes") && <FlashcardCreateDrawer decks={decks.data ?? []}
      title={drawer.kind === "notes" ? t("teacher:flashcard_proposal.from_notes") : undefined}
      libraryRequest={drawer.kind === "notes" ? { origin: { kind: "notes" } } : undefined}
      initialValues={{ deck_id: deckId || flashcardGeneralDeck, question: "", answer: "" }} busy={writes.busy || decks.isFetching}
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
    {deleting && <ConfirmDialog open
      title={t(removingCard ? "teacher:flashcards.delete_card" : removingSet ? "teacher:flashcard_sets.confirm_set_title" : "teacher:flashcard_sets.confirm_deck_title")}
      message={deleting.kind === "card" ? t("teacher:flashcards.delete_message", { question: deleting.item.question, deck: deckTitle })
        : t(deleting.kind === "set" ? "teacher:flashcard_sets.confirm_set_message" : "teacher:flashcard_sets.confirm_deck_message", { title: deleting.item.title })}
      onClose={() => setDeleting(undefined)} onConfirm={() => { void confirmDeletion(deleting); }}
      confirmText={t("teacher:flashcards.delete")} isLoading={writes.busy}
      confirmDisabled={libraryBusy || (removingCard && cards.isFetching)} />}
  </Stack>;
}

function LibraryEmpty({ children }: { children: string }) {
  return <Box sx={{ px: 2, py: 3, textAlign: "center", border: 1, borderColor: "divider", borderRadius: 1.5 }}>
    <Typography color="text.secondary">{children}</Typography>
  </Box>;
}

function LibraryTrash({ title, disabled, onClick }: { title: string; disabled: boolean; onClick: () => void }) {
  return <Tooltip title={title}>
    <span data-flashcard-detail-trash style={{ gridArea: "trash" }}><IconButton type="button" aria-label={title} disabled={disabled}
      onClick={onClick} sx={{ width: 44, height: 44, color: "text.secondary", "&:hover": { color: "error.main" } }}>
      <DeleteOutlineOutlined />
    </IconButton></span>
  </Tooltip>;
}
