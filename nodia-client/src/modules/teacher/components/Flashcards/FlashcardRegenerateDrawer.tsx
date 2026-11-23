import { LinearProgress } from "@mui/material";
import { useTranslation } from "react-i18next";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import type { FlashcardProposalParts } from "../../infrastructure/flashcardLibraryProposal";
import { useTeacherSession } from "../../infrastructure/useServices";
import FlashcardEditor, { type FlashcardEditorProps } from "./FlashcardEditor";

type Props = Pick<FlashcardEditorProps, "decks" | "busy" | "onClose" | "onSave">
  & { card: NonNullable<FlashcardEditorProps["card"]>; parts: FlashcardProposalParts };

export default function FlashcardRegenerateDrawer({ card, parts, ...props }: Props) {
  const { t } = useTranslation();
  const originId = parts === "text" ? card.source?.anchor?.session_id : undefined;
  const origin = useTeacherSession(originId);
  const session = !origin.isError && origin.data?.id === originId ? origin.data : undefined;

  return <FlashcardEditor {...props} card={card} mode="edit" title={t(`teacher:flashcard_proposal.regenerate.${parts}`)}
    libraryRequest={{ origin: { kind: "card", id: card.id, revision: card.revision }, initialParts: parts }}
    textRequest={session && {
      target: { card_id: card.id, revision: card.revision, parts: "text" },
      selection: session.selection,
    }}
    status={<>
      {origin.isFetching && <LinearProgress aria-label={t("core:loading_route")} />}
      <QueryErrorAlert retryVariant="outlined" isError={origin.isError} isFetching={origin.isFetching} onRetry={origin.refetch} />
    </>} />;
}
