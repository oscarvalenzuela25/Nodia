import { useState, type ComponentPropsWithoutRef } from "react";
import { ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import BookmarkBorderOutlined from "@mui/icons-material/BookmarkBorderOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import ImageNotSupportedOutlined from "@mui/icons-material/ImageNotSupportedOutlined";
import LayersOutlined from "@mui/icons-material/LayersOutlined";
import StyleOutlined from "@mui/icons-material/StyleOutlined";
import ViewListOutlined from "@mui/icons-material/ViewListOutlined";
import ViewModuleOutlined from "@mui/icons-material/ViewModuleOutlined";
import { useTranslation } from "react-i18next";
import type { FlashcardDeck } from "../../infrastructure/flashcards";
import { FlashcardLibraryMark } from "./FlashcardDeckTree";
import {
  CollectibleArt, CollectibleButton, CollectibleCaption, CollectibleEmblem, CollectibleTag,
  collectionTone, CollectionAction, CollectionActionSlot, CollectionCell, CollectionItems, CollectionListButton,
  CollectionRowMark, CollectionRowText, CollectionSnippet, type FlashcardCollectionView,
} from "./FlashcardCollectionStyles";

export type { FlashcardCollectionView } from "./FlashcardCollectionStyles";

export function FlashcardCollectionItems(props: ComponentPropsWithoutRef<"ul"> & { mode: FlashcardCollectionView }) {
  return <CollectionItems {...props} role="list" />;
}

type ViewToggleProps = {
  value: FlashcardCollectionView;
  disabled: boolean;
  onChange: (value: FlashcardCollectionView) => void;
};

export function FlashcardCollectionViewToggle({ value, disabled, onChange }: ViewToggleProps) {
  const { t } = useTranslation();
  return <ToggleButtonGroup exclusive size="small" value={value} disabled={disabled}
    aria-label={t("teacher:flashcards.view_mode")}
    onChange={(_, view: FlashcardCollectionView | null) => { if (view) onChange(view); }}
    sx={{
      alignSelf: "flex-start", flexWrap: "wrap",
      "& .MuiToggleButton-root": { minHeight: 44, gap: 0.5, px: 1.25, textTransform: "none" },
      "& .MuiToggleButton-root.Mui-selected": { color: "primary.main" },
    }}>
    <ToggleButton value="list"><ViewListOutlined fontSize="small" />{t("teacher:flashcards.view_list")}</ToggleButton>
    <ToggleButton value="grid"><ViewModuleOutlined fontSize="small" />{t("teacher:flashcards.view_grid")}</ToggleButton>
  </ToggleButtonGroup>;
}

type DeckProps = {
  deck: FlashcardDeck;
  mode: FlashcardCollectionView;
  busy: boolean;
  onSelect: () => void;
  onDelete: () => void;
};

export function FlashcardCollectionDeck({ deck, mode, busy, onSelect, onDelete }: DeckProps) {
  const { t } = useTranslation();
  const count = t("teacher:flashcards.card_count", { count: deck.card_count });
  const removeLabel = t("teacher:flashcard_sets.delete_deck_label", { title: deck.title });
  return <CollectionCell mode={mode}>
    {mode === "grid" ? <CollectibleButton variant="outlined" type="button" tone={collectionTone(deck.category ?? deck.id)} pack
      disabled={busy} onClick={onSelect}>
      <CollectibleTag><CollectionSnippet title={deck.category ?? undefined}>{deck.category ?? t("teacher:flashcards.deck")}</CollectionSnippet></CollectibleTag>
      <CollectibleArt aria-hidden="true"><CollectibleEmblem><LayersOutlined /></CollectibleEmblem></CollectibleArt>
      <CollectibleCaption>
        <CollectionSnippet as="strong">{deck.title}</CollectionSnippet>
        <Typography component="span" variant="caption" color="text.secondary">{count}</Typography>
      </CollectibleCaption>
    </CollectibleButton> : <CollectionListButton variant="outlined" type="button" disabled={busy} onClick={onSelect}>
      <FlashcardLibraryMark kind="deck" />
      <CollectionRowText>
        <Typography component="span" variant="subtitle2">{deck.title}</Typography>
        {deck.category && <Typography component="span" variant="caption" color="text.secondary">{deck.category}</Typography>}
        <Typography component="span" variant="caption" color="text.secondary">{count}</Typography>
      </CollectionRowText>
    </CollectionListButton>}
    <Tooltip title={removeLabel}>
      <CollectionActionSlot mode={mode} pack>
        <CollectionAction mode={mode} type="button" aria-label={removeLabel} disabled={busy}
          onClick={onDelete} sx={{ "&:hover": { color: "error.main" } }}>
          <DeleteOutlineOutlined fontSize="small" />
        </CollectionAction>
      </CollectionActionSlot>
    </Tooltip>
  </CollectionCell>;
}

type CardFaceProps = {
  mode: FlashcardCollectionView;
  identity: string;
  question: string;
  source?: string;
  category?: string | null;
  hasImage: boolean;
  imageSrc: string | null;
  busy: boolean;
  onOpen: () => void;
};

export function FlashcardCollectionFace({
  mode, identity, question, source, category, hasImage, imageSrc, busy, onOpen,
}: CardFaceProps) {
  const { t } = useTranslation();
  const label = t("teacher:flashcards.open_named_card", { question });
  const artwork = <CollectionArtwork key={imageSrc ?? undefined} mode={mode} hasImage={hasImage} src={imageSrc} />;
  if (mode === "list") return <CollectionListButton variant="outlined" type="button" disabled={busy}
    aria-label={label} onClick={onOpen}>
    <CollectionRowMark aria-hidden="true">{artwork}</CollectionRowMark>
    <CollectionRowText>
      <Typography component={CollectionSnippet} variant="subtitle2">{question}</Typography>
      {source && <Typography component={CollectionSnippet} variant="caption" color="text.secondary">{source}</Typography>}
    </CollectionRowText>
  </CollectionListButton>;
  return <CollectibleButton variant="outlined" type="button" tone={collectionTone(identity)} disabled={busy} aria-label={label} onClick={onOpen}>
    <CollectibleTag>
      <BookmarkBorderOutlined />
      <CollectionSnippet title={category ?? undefined}>{category ?? t("teacher:flashcards.question")}</CollectionSnippet>
    </CollectibleTag>
    <CollectibleArt aria-hidden="true">{artwork}</CollectibleArt>
    <CollectibleCaption>
      <CollectionSnippet as="strong">{question}</CollectionSnippet>
      {source && <Typography component={CollectionSnippet} variant="caption" color="text.secondary">{source}</Typography>}
    </CollectibleCaption>
  </CollectibleButton>;
}

function CollectionArtwork({ mode, src, hasImage }: { mode: FlashcardCollectionView; src: string | null; hasImage: boolean }) {
  const [unavailable, setUnavailable] = useState(false);
  if (src && !unavailable) return <img src={src} alt="" decoding="async" loading="lazy" onError={() => setUnavailable(true)} />;
  const glyph = unavailable && hasImage ? <ImageNotSupportedOutlined fontSize="small" /> : <StyleOutlined fontSize="small" />;
  return mode === "grid" ? <CollectibleEmblem>{glyph}</CollectibleEmblem> : glyph;
}
