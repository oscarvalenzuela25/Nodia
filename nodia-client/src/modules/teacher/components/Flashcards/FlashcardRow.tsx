import { useEffect, useId, useRef, useState } from "react";
import { Box, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from "@mui/material";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import MoreVertOutlined from "@mui/icons-material/MoreVertOutlined";
import StyleOutlined from "@mui/icons-material/StyleOutlined";
import { useTranslation } from "react-i18next";
import type { Flashcard } from "../../infrastructure/flashcards";
import type { FlashcardProposalParts } from "../../infrastructure/flashcardLibraryProposal";
import { useFlashcardImage } from "../../infrastructure/useFlashcards";
import { FlashcardMenuTrigger, FlashcardRowButton, FlashcardRowLayout, FlashcardRowMedia, FlashcardSnippet } from "./styles";

type Action = "edit" | "delete" | FlashcardProposalParts;
const regenerationParts: FlashcardProposalParts[] = ["text", "image", "both"];
type Props = {
  card: Flashcard;
  busy: boolean;
  active: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRegenerate: (parts: FlashcardProposalParts) => void;
};

export default function FlashcardRow({ card, busy, active, onOpen, onEdit, onDelete, onRegenerate }: Props) {
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

  return <FlashcardRowLayout ref={row}>
    <FlashcardRowButton variant="outlined" type="button" disabled={busy}
      aria-label={t("teacher:flashcards.open_named_card", { question: card.question })} onClick={onOpen}>
      <FlashcardRowMedia aria-hidden="true">
        {hasImage && image.src ? <img src={image.src} alt="" loading="lazy" decoding="async" />
          : hasImage ? <ImageOutlined fontSize="small" /> : <StyleOutlined fontSize="small" />}
      </FlashcardRowMedia>
      <Box component="span" sx={{ minWidth: 0, display: "grid", alignContent: "start", gap: 0.5, p: 1.25 }}>
        <Typography component={FlashcardSnippet} variant="subtitle2">{card.question}</Typography>
        {card.source && <Typography component={FlashcardSnippet} variant="body2" color="text.secondary">
          {card.source.label}
        </Typography>}
      </Box>
    </FlashcardRowButton>
    <Tooltip title={t("teacher:flashcards.actions")}>
      <FlashcardMenuTrigger>
        <IconButton id={triggerId} type="button" aria-label={t("teacher:flashcards.card_actions", { question: card.question })}
          aria-haspopup="menu" aria-controls={open ? menuId : undefined} aria-expanded={open} disabled={busy}
          sx={{
            width: 44, height: 44, bgcolor: "background.paper", boxShadow: 1,
            "&:hover": { bgcolor: "background.default" },
            "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main" },
          }} onClick={event => setAnchor(event.currentTarget)}
          onKeyDown={event => {
            if (event.key !== "ArrowDown") return;
            event.preventDefault();
            setAnchor(event.currentTarget);
          }}>
          <MoreVertOutlined />
        </IconButton>
      </FlashcardMenuTrigger>
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
  </FlashcardRowLayout>;
}
