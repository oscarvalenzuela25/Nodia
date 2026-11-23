import { Button, IconButton } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export type FlashcardCollectionView = "list" | "grid";

const collectionTones = ["info", "warning", "primary", "success"] as const;
const compactCollectionActions = "@container collectible (width < 10.5rem)";
type CollectionTone = typeof collectionTones[number];

export function collectionTone(key: string): CollectionTone {
  let total = 0;
  for (const letter of key.normalize("NFKC").toLowerCase()) {
    total += letter.codePointAt(0) ?? 0;
  }
  return collectionTones[total % collectionTones.length];
}

export const CollectionItems = styled("ul", {
  shouldForwardProp: prop => prop !== "mode",
})<{ mode: FlashcardCollectionView }>(({ theme, mode }) => ({
  display: "grid",
  inlineSize: "100%",
  minInlineSize: 0,
  margin: 0,
  padding: 0,
  listStyle: "none",
  gap: theme.spacing(mode === "grid" ? 2 : 0.75),
  ...(mode === "grid" && {
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, max(7.25rem, min(9rem, 42%))), 1fr))",
    paddingBlockEnd: theme.spacing(0.75),
  }),
}));

export const CollectionCell = styled("li", {
  shouldForwardProp: prop => prop !== "mode",
})<{ mode: FlashcardCollectionView }>(({ theme, mode }) => ({
  position: "relative",
  minInlineSize: 0,
  display: "grid",
  gap: theme.spacing(0.5),
  ...(mode === "grid"
    ? { gridTemplateColumns: "minmax(0, 1fr)", maxInlineSize: "13rem", container: "collectible / inline-size" }
    : { gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center" }),
}));

export const CollectionListButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "start",
  minInlineSize: 0,
  minBlockSize: 48,
  padding: theme.spacing(0.75, 1),
  gap: theme.spacing(1),
  textAlign: "start",
  textTransform: "none",
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.default,
  borderColor: theme.palette.divider,
  borderRadius: theme.spacing(1),
  "&:hover": { borderColor: theme.palette.primary.main },
  "&.Mui-focusVisible": { outline: "2px solid", outlineColor: theme.palette.primary.main, outlineOffset: 1 },
}));

export const CollectionRowText = styled("span")({
  display: "grid",
  flex: 1,
  minInlineSize: 0,
  overflowWrap: "anywhere",
});

export const CollectionRowMark = styled("span")(({ theme }) => ({
  position: "relative",
  display: "grid",
  placeItems: "center",
  flex: "0 0 2.5rem",
  aspectRatio: "1 / 1",
  overflow: "clip",
  borderRadius: theme.spacing(0.75),
  color: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.12),
  "& > img": {
    position: "absolute",
    inset: 0,
    inlineSize: "100%",
    blockSize: "100%",
    objectFit: "cover",
  },
}));

export const CollectibleButton = styled(Button, {
  shouldForwardProp: prop => prop !== "tone" && prop !== "pack",
})<{ tone: CollectionTone; pack?: boolean }>(({ theme, tone, pack }) => {
  const accent = theme.palette[tone].light;
  const ink = theme.palette.background.default;
  return {
    "--collectible-foil": accent,
    "--collectible-ink": ink,
    "--collectible-border": `color-mix(in srgb, ${accent} 52%, ${theme.palette.divider})`,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start",
    position: "relative",
    isolation: "isolate",
    boxSizing: "border-box",
    minInlineSize: 0,
    minBlockSize: "13.25rem",
    padding: theme.spacing(0.625),
    gap: theme.spacing(0.625),
    textAlign: "start",
    textTransform: "none",
    color: theme.palette.text.primary,
    border: "1px solid var(--collectible-border)",
    borderRadius: theme.spacing(1.5),
    backgroundColor: ink,
    backgroundImage: `linear-gradient(145deg, ${alpha(accent, 0.25)}, transparent 40%, ${alpha(accent, 0.14)})`,
    boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.2)}, ${theme.shadows[2]}`,
    "&:hover": { borderColor: theme.palette[tone].main, boxShadow: theme.shadows[4] },
    "&.Mui-focusVisible": { outline: "2px solid", outlineColor: theme.palette.primary.main, outlineOffset: 2 },
    "&.Mui-disabled": {
      borderColor: theme.palette.divider,
      color: theme.palette.text.secondary,
    },
    ...(pack && {
      marginInlineEnd: theme.spacing(0.75),
      "&::before, &::after": {
        content: '""',
        position: "absolute",
        zIndex: -1,
        inset: 0,
        pointerEvents: "none",
        borderRadius: "inherit",
      },
      "&::before": {
        boxShadow: `2px 2px 0 -1px ${ink}, 3px 3px 0 -1px var(--collectible-border)`,
      },
      "&::after": {
        boxShadow: `4px 4px 0 -1px ${ink}, 5px 5px 0 -1px var(--collectible-border)`,
      },
    }),
  };
});

export const CollectibleTag = styled("span")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  minInlineSize: 0,
  minBlockSize: theme.spacing(5),
  paddingInlineStart: theme.spacing(0.5),
  paddingInlineEnd: theme.spacing(5.5),
  gap: theme.spacing(0.5),
  ...theme.typography.caption,
  lineHeight: 1.25,
  fontWeight: 700,
  overflowWrap: "anywhere",
  "& > .MuiSvgIcon-root": { fontSize: "0.875rem", flexShrink: 0 },
  "& > span": { display: "block", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  [compactCollectionActions]: {
    fontSize: theme.typography.pxToRem(11),
    paddingInlineEnd: theme.spacing(0.5),
  },
}));

export const CollectibleArt = styled("span")(({ theme }) => ({
  "--collectible-shadow": `color-mix(in srgb, ${theme.palette.common.black} 78%, var(--collectible-foil))`,
  display: "grid",
  placeItems: "center",
  position: "relative",
  isolation: "isolate",
  inlineSize: "100%",
  aspectRatio: "5 / 4",
  flexShrink: 0,
  overflow: "clip",
  border: "1px solid var(--collectible-border)",
  borderRadius: theme.spacing(1),
  background: [
    "radial-gradient(circle at 24% 20%, var(--collectible-foil) 0 1px, transparent 2px)",
    "radial-gradient(circle at 80% 75%, var(--collectible-foil) 0 1px, transparent 2px)",
    "radial-gradient(circle at 84% 17%, var(--collectible-foil) 0 1px, transparent 3px)",
    "repeating-linear-gradient(128deg, transparent 0 6px, color-mix(in srgb, var(--collectible-foil) 26%, transparent) 7px 8px)",
    "radial-gradient(ellipse at 45% 34%, color-mix(in srgb, var(--collectible-foil) 62%, var(--collectible-shadow)), var(--collectible-shadow))",
  ].join(", "),
  "&::before, &::after": {
    content: '""',
    position: "absolute",
    inlineSize: "57%",
    aspectRatio: "1 / 1",
    border: "1px solid var(--collectible-border)",
    pointerEvents: "none",
  },
  "&::before": { transform: "rotate(45deg)" },
  "&::after": { borderRadius: "50%", borderStyle: "dotted" },
  "& > img": {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    inlineSize: "100%",
    blockSize: "100%",
    objectFit: "cover",
  },
}));

export const CollectibleEmblem = styled("span")(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  display: "grid",
  placeItems: "center",
  inlineSize: "47%",
  maxInlineSize: "4.5rem",
  aspectRatio: "1 / 1",
  borderRadius: "50%",
  border: "1px solid var(--collectible-foil)",
  background: "radial-gradient(circle at 42% 28%, color-mix(in srgb, var(--collectible-foil) 36%, var(--collectible-shadow)), var(--collectible-shadow) 82%)",
  boxShadow: "0 0 0 3px var(--collectible-border), 0 0 18px var(--collectible-foil)",
  color: theme.palette.common.white,
  "& > .MuiSvgIcon-root": { inlineSize: "50%", blockSize: "50%" },
}));

export const CollectibleCaption = styled("span")(({ theme }) => ({
  display: "grid",
  alignContent: "center",
  gap: theme.spacing(0.25),
  flex: "1 0 auto",
  minInlineSize: 0,
  minBlockSize: theme.spacing(8.5),
  padding: theme.spacing(0.75, 1),
  border: "1px solid var(--collectible-border)",
  borderRadius: theme.spacing(1),
  backgroundColor: "color-mix(in srgb, var(--collectible-ink) 92%, var(--collectible-foil))",
  "& > strong": {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: "0.9rem",
    lineHeight: 1.2,
  },
  "@container collectible (width < 8.5rem)": {
    paddingInline: theme.spacing(0.75),
    "& > strong": { fontSize: "0.825rem", WebkitLineClamp: 4, lineClamp: 4 },
  },
}));

export const CollectionSnippet = styled("span")({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
  lineClamp: 3,
  minInlineSize: 0,
  overflow: "hidden",
  overflowWrap: "anywhere",
});

export const CollectionAction = styled(IconButton, {
  shouldForwardProp: prop => prop !== "mode",
})<{ mode: FlashcardCollectionView }>(({ theme, mode }) => ({
  inlineSize: 44,
  blockSize: 44,
  borderRadius: theme.spacing(1.25),
  "&.Mui-focusVisible": { outline: "2px solid", outlineColor: theme.palette.primary.main, outlineOffset: -2 },
  ...(mode === "grid" && {
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[1],
    "&:hover": { backgroundColor: theme.palette.background.paper, color: theme.palette.primary.main },
    [compactCollectionActions]: {
      backgroundColor: "transparent",
      boxShadow: "none",
      "&::before": {
        content: '""', position: "absolute", inset: theme.spacing(1), borderRadius: theme.spacing(0.75),
        backgroundColor: theme.palette.background.paper, boxShadow: theme.shadows[1],
      },
      "& > .MuiSvgIcon-root": { position: "relative" },
      "&:hover": { backgroundColor: "transparent" },
    },
  }),
}));

export const CollectionActionSlot = styled("span", {
  shouldForwardProp: prop => prop !== "mode" && prop !== "pack",
})<{ mode: FlashcardCollectionView; pack?: boolean }>(({ theme, mode, pack }) => ({
  display: "inline-flex",
  ...(mode === "grid" && {
    position: "absolute",
    zIndex: 1,
    insetBlockStart: theme.spacing(0.375),
    insetInlineEnd: theme.spacing(pack ? 1.125 : 0.375),
    [compactCollectionActions]: {
      insetBlockStart: theme.spacing(6.375),
    },
  }),
}));
