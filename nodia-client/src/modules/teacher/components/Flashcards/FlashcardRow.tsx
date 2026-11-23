import { useEffect, useId, useRef, useState } from "react";
import { ListItemIcon, Menu, MenuItem, Tooltip } from "@mui/material";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import MoreVertOutlined from "@mui/icons-material/MoreVertOutlined";
import { useTranslation } from "react-i18next";
import type { Flashcard } from "../../infrastructure/flashcards";
import type { FlashcardProposalParts } from "../../infrastructure/flashcardLibraryProposal";
import { useFlashcardImage } from "../../infrastructure/useFlashcards";
import { FlashcardCollectionFace } from "./FlashcardCollection";
import { CollectionAction, CollectionActionSlot, CollectionCell, type FlashcardCollectionView } from "./FlashcardCollectionStyles";

type Action = "edit" | "delete" | FlashcardProposalParts;
const regenerationParts: FlashcardProposalParts[] = ["text", "image", "both"];
type Props = {
  card: Flashcard;
  busy: boolean;
  active: boolean;
  mode: FlashcardCollectionView;
  category?: string | null;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRegenerate: (parts: FlashcardProposalParts) => void;
};

export default function FlashcardRow({ card, busy, active, mode, category, onOpen, onEdit, onDelete, onRegenerate }: Props) {
  const { t } = useTranslation();
  const triggerId = useId();
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const pendingAction = useRef<Action | null>(null);
  const row = useRef<HTMLLIElement>(null);
  const [seen, setSeen] = useState(false);
  const canObserve = typeof IntersectionObserver === "function";
  const hasImage = Boolean(card.image);
  const image = useFlashcardImage(card, active && (seen || !canObserve));
  const open = Boolean(anchor);

  useEffect(() => {
    if (!active || !hasImage || seen || !canObserve || !row.current) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      setSeen(true);
    });
    observer.observe(row.current);
    return () => observer.disconnect();
  }, [active, canObserve, hasImage, seen]);

  const selectAction = (action: Action) => {
    pendingAction.current = action;
    setAnchor(null);
  };

  return <CollectionCell ref={row} mode={mode}>
    <FlashcardCollectionFace identity={card.id} mode={mode} busy={busy} category={category}
      question={card.question} source={card.source?.label} hasImage={hasImage} imageSrc={image.src} onOpen={onOpen} />
    <Tooltip title={t("teacher:flashcards.actions")}>
      <CollectionActionSlot mode={mode}>
        <CollectionAction id={triggerId} type="button" mode={mode} aria-label={t("teacher:flashcards.card_actions", { question: card.question })}
          aria-haspopup="menu" aria-controls={open ? menuId : undefined} aria-expanded={open} disabled={busy}
          onClick={event => setAnchor(event.currentTarget)}
          onKeyDown={event => {
            if (event.key !== "ArrowDown") return;
            event.preventDefault();
            setAnchor(event.currentTarget);
          }}>
          <MoreVertOutlined />
        </CollectionAction>
      </CollectionActionSlot>
    </Tooltip>
    <Menu anchorEl={anchor} open={open}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
      onClose={() => { pendingAction.current = null; setAnchor(null); }}
      slotProps={{
        list: { id: menuId, "aria-labelledby": triggerId },
        transition: { onExited: () => {
          const action = pendingAction.current;
          pendingAction.current = null;
          if (action === "edit") onEdit();
          if (action === "delete") onDelete();
          if (action !== null && action !== "edit" && action !== "delete") onRegenerate(action);
        } },
      }}>
      <MenuItem disabled={busy} onClick={() => selectAction("edit")} sx={{ minHeight: 44 }}>
        <ListItemIcon><EditOutlined fontSize="small" /></ListItemIcon>
        {t("teacher:flashcards.edit")}
      </MenuItem>
      {regenerationParts.map(part => <MenuItem key={part} disabled={busy} onClick={() => selectAction(part)} sx={{ minHeight: 44 }}>
        <ListItemIcon><AutoAwesomeOutlined fontSize="small" /></ListItemIcon>
        {t(`teacher:flashcard_proposal.regenerate.${part}`)}
      </MenuItem>)}
      <MenuItem disabled={busy} onClick={() => selectAction("delete")}
        sx={{ minHeight: 44, color: "error.main", "& .MuiListItemIcon-root": { color: "inherit" } }}>
        <ListItemIcon><DeleteOutlineOutlined fontSize="small" /></ListItemIcon>
        {t("teacher:flashcards.delete")}
      </MenuItem>
    </Menu>
  </CollectionCell>;
}
