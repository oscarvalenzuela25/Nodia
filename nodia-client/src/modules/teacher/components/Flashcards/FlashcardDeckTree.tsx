import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ChevronLeftOutlined from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import InboxOutlined from "@mui/icons-material/InboxOutlined";
import LayersOutlined from "@mui/icons-material/LayersOutlined";
import { useTranslation } from "react-i18next";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import { flashcardDeckPage } from "../../infrastructure/flashcardLibrary";
import { flashcardDeckPageSize, type FlashcardDeck, type FlashcardSet } from "../../infrastructure/flashcards";
import TeacherLoading from "../TeacherLoading";
import {
  CompactTreeTrigger, LibraryMark, LibraryTreePanel, PageControls, SetBranch, SetGroup,
  TreeFilters, TreeIconButton, TreeList, TreeName, TreeRow, TreeTrash,
} from "./flashcardDeckTreeStyles";
import { DeckButton, DeckCount } from "./styles";

type LibraryKind = "set" | "deck" | "general";
const libraryIcons = { set: FolderOutlined, deck: LayersOutlined, general: InboxOutlined };
const allFilterOption = "all";
const categoryOptionPrefix = "category:";

export function FlashcardLibraryMark({ kind }: { kind: LibraryKind }) {
  const Icon = libraryIcons[kind];
  return <LibraryMark data-kind={kind} aria-hidden="true"><Icon fontSize="inherit" /></LibraryMark>;
}

type PaginationProps = { page: number; total: number; disabled: boolean; onPageChange: (page: number) => void };

export function FlashcardDeckPagination({ page, total, disabled, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  if (total <= flashcardDeckPageSize) return null;
  const start = (page - 1) * flashcardDeckPageSize + 1;
  const end = Math.min(page * flashcardDeckPageSize, total);
  return <PageControls>
    <TreeIconButton aria-label={t("teacher:flashcard_sets.previous_decks")} disabled={disabled || page === 1}
      onClick={() => onPageChange(page - 1)}>
      <ChevronLeftOutlined fontSize="small" />
    </TreeIconButton>
    <Typography variant="caption" color="text.secondary" aria-live="polite" aria-atomic="true">
      {t("teacher:flashcard_sets.deck_range", { start, end, total })}
    </Typography>
    <TreeIconButton aria-label={t("teacher:flashcard_sets.next_decks")} disabled={disabled || end >= total}
      onClick={() => onPageChange(page + 1)}>
      <ChevronRightOutlined fontSize="small" />
    </TreeIconButton>
  </PageControls>;
}

type Props = {
  sets: readonly FlashcardSet[];
  decksBySet: ReadonlyMap<string, readonly FlashcardDeck[]>;
  generalDeck?: FlashcardDeck;
  setOptions: readonly FlashcardSet[];
  categoryOptions: ReadonlyMap<string, string>;
  setFilter: string;
  categoryFilter: string;
  selectedSetId?: string;
  selectedDeckId?: string;
  expandedSetIds: ReadonlySet<string>;
  pages: ReadonlyMap<string, number>;
  busy: boolean;
  loading?: boolean;
  hasError?: boolean;
  setsUnavailable?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
  onSetFilter: (value: string) => void;
  onCategoryFilter: (value: string) => void;
  onToggleSet: (id: string) => void;
  onSelectSet: (id: string) => void;
  onSelectDeck: (deck: FlashcardDeck) => void;
  onPageChange: (id: string, page: number) => void;
  onDeleteSet: (set: FlashcardSet) => void;
  onDeleteDeck: (deck: FlashcardDeck) => void;
};

export function FlashcardDeckTree(props: Props) {
  const { t } = useTranslation();
  const treeId = useId();
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const contentOpen = !compact || mobileOpen;
  const {
    sets, decksBySet, generalDeck, setOptions, categoryOptions, setFilter, categoryFilter,
    selectedSetId, selectedDeckId, expandedSetIds, pages, busy, loading = false, hasError, setsUnavailable, actions, children,
    onSetFilter, onCategoryFilter, onToggleSet, onSelectSet, onSelectDeck, onPageChange, onDeleteSet, onDeleteDeck,
  } = props;

  const groupingUnavailable = setsUnavailable && setOptions.length === 0;

  const closeCompactTree = useCallback(() => {
    if (!compact) return;
    setMobileOpen(false);
    mobileTrigger.current?.focus();
  }, [compact]);

  function deckEntry(deck: FlashcardDeck, general = false) {
    const title = general ? t("teacher:flashcards.general") : deck.title;
    const subtitle = general ? t("teacher:flashcard_sets.general_hint") : deck.category;
    return <li key={deck.id}>
      <TreeRow>
        <DeckButton type="button" variant="outlined" aria-pressed={selectedDeckId === deck.id}
          disabled={busy} onClick={() => { onSelectDeck(deck); closeCompactTree(); }}>
          <FlashcardLibraryMark kind={general ? "general" : "deck"} />
          <TreeName>
            <Typography component="span" variant="subtitle2">{title}</Typography>
            {subtitle && <Typography component="span" variant="caption" color="text.secondary">{subtitle}</Typography>}
          </TreeName>
          <DeckCount aria-label={t("teacher:flashcards.card_count", { count: deck.card_count })}>{deck.card_count}</DeckCount>
        </DeckButton>
        {!general && <TreeTrash type="button" aria-label={t("teacher:flashcard_sets.delete_deck_label", { title })}
          disabled={busy} onClick={() => onDeleteDeck(deck)}>
          <DeleteOutlineOutlined fontSize="small" />
        </TreeTrash>}
      </TreeRow>
    </li>;
  }

  function setBranch(id: string, title: string, decks: readonly FlashcardDeck[]) {
    const { page, data } = flashcardDeckPage(decks, pages.get(id));
    if (hasError) return null;
    if (!data.length) return <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
      {t("teacher:flashcard_sets.empty_set")}
    </Typography>;
    return <>
      <SetBranch role="list" aria-label={title}>{data.map(deck => deckEntry(deck))}</SetBranch>
      <FlashcardDeckPagination page={page} total={decks.length} disabled={busy}
        onPageChange={value => onPageChange(id, value)} />
    </>;
  }

  const title = t("teacher:flashcard_sets.tree");
  return <LibraryTreePanel aria-label={title}>
    <Stack spacing={1.5}>
      {compact
        ? <CompactTreeTrigger ref={mobileTrigger} variant="outlined" type="button" aria-expanded={contentOpen}
            aria-controls={treeId} onClick={() => setMobileOpen(open => !open)}
            endIcon={contentOpen ? <ExpandMoreOutlined /> : <ChevronRightOutlined />}>
            {title}
          </CompactTreeTrigger>
        : <Typography component="h3" variant="h6">{title}</Typography>}
      {children}
      <Stack id={treeId} spacing={1.5} hidden={!contentOpen} sx={!contentOpen ? { display: "none" } : undefined}>
        {actions}
        <TreeFilters>
          <SelectSingleInput label={t("teacher:flashcard_sets.set_filter")} clearable={false} autoFocusSearch={false}
            disabled={busy || hasError || setsUnavailable} value={setFilter || allFilterOption}
            onChange={value => onSetFilter(value === allFilterOption ? "" : value ?? "")}
            options={[
              { value: allFilterOption, label: t("teacher:flashcard_sets.all_sets") },
              ...setOptions.map(set => ({ value: set.id, label: set.title })),
            ]} />
          <SelectSingleInput label={t("teacher:flashcard_sets.category_filter")} clearable={false} autoFocusSearch={false}
            disabled={busy || hasError} value={categoryFilter ? categoryOptionPrefix + categoryFilter : allFilterOption}
            onChange={value => onCategoryFilter(value?.startsWith(categoryOptionPrefix) ? value.slice(categoryOptionPrefix.length) : "")}
            options={[
              { value: allFilterOption, label: t("teacher:flashcard_import.category_all") },
              ...[...categoryOptions].map(([key, label]) => ({ value: categoryOptionPrefix + key, label })),
            ]} />
        </TreeFilters>
        <TeacherLoading loading={loading}>
          <TreeList role="list">
            {generalDeck && deckEntry(generalDeck, true)}
            {sets.map(set => {
              const children = decksBySet.get(set.id) ?? [];
              const expanded = expandedSetIds.has(set.id);
              const branchId = treeId + "-" + set.id;
              return <SetGroup key={set.id} data-expanded={expanded}>
                <TreeRow>
                  <TreeIconButton type="button" disabled={busy} aria-expanded={expanded} aria-controls={branchId}
                    aria-label={t(expanded ? "teacher:flashcard_sets.collapse" : "teacher:flashcard_sets.expand", { title: set.title })}
                    onClick={() => onToggleSet(set.id)}>
                    {expanded ? <ExpandMoreOutlined fontSize="small" /> : <ChevronRightOutlined fontSize="small" />}
                  </TreeIconButton>
                  <DeckButton type="button" variant="outlined" aria-pressed={selectedSetId === set.id} disabled={busy}
                    onClick={() => { onSelectSet(set.id); closeCompactTree(); }}>
                    <FlashcardLibraryMark kind="set" />
                    <TreeName>
                      <Typography component="span" variant="subtitle2">{set.title}</Typography>
                      {!hasError && <Typography component="span" variant="caption" color="text.secondary">
                        {t("teacher:flashcard_sets.deck_count", { count: children.length })}
                      </Typography>}
                    </TreeName>
                  </DeckButton>
                  <TreeTrash type="button" aria-label={t("teacher:flashcard_sets.delete_set_label", { title: set.title })}
                    disabled={busy} onClick={() => onDeleteSet(set)}>
                    <DeleteOutlineOutlined fontSize="small" />
                  </TreeTrash>
                </TreeRow>
                <div id={branchId} hidden={!expanded}>
                  {expanded && setBranch(set.id, set.title, children)}
                </div>
              </SetGroup>;
            })}
            {groupingUnavailable && decksBySet.size > 0 && <>
              <li><Typography variant="subtitle2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t("teacher:flashcards.decks")}
              </Typography></li>
              {[...decksBySet].map(([id, decks]) => <SetGroup key={id}>
                {setBranch(id, t("teacher:flashcards.decks"), decks)}
              </SetGroup>)}
            </>}
            {!hasError && !groupingUnavailable && sets.length === 0 && <li>
              <Typography variant="body2" color="text.secondary">{t("teacher:flashcard_sets.no_matches")}</Typography>
            </li>}
          </TreeList>
        </TeacherLoading>
      </Stack>
    </Stack>
  </LibraryTreePanel>;
}
