import { type RefObject } from "react";
import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import TeacherLoading from "../TeacherLoading";
import { type Flashcard } from "../../infrastructure/flashcards";
import { useFlashcardImage } from "../../infrastructure/useFlashcards";

type Props = {
  card: Flashcard;
  revealed: boolean;
  questionRef?: RefObject<HTMLHeadingElement | null>;
  answerRef?: RefObject<HTMLHeadingElement | null>;
  active?: boolean;
};

export default function FlashcardContent({ card, revealed, questionRef, answerRef, active = true }: Props) {
  const { t } = useTranslation();
  const showImage = Boolean(card.image && (revealed || card.image.side === "question"));
  const image = useFlashcardImage(card, showImage && active);
  const media = showImage && <>
    <QueryErrorAlert retryVariant="outlined" isError={image.isError} isFetching={image.isLoading} onRetry={image.refetch} />
    <TeacherLoading loading={image.isLoading} compact>
      {image.src && <Box component="img" alt="" src={image.src} sx={{
        display: "block", width: "100%", maxHeight: { xs: 196, sm: 300 }, objectFit: "contain",
        borderRadius: 1.5, bgcolor: "action.hover",
      }} />}
    </TeacherLoading>
  </>;

  return <Stack spacing={2} sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
    <Typography component="h3" variant="h6" ref={questionRef} tabIndex={questionRef ? -1 : undefined} sx={{ whiteSpace: "pre-wrap" }}>
      {card.question}
    </Typography>
    {card.image?.side === "question" && media}
    {revealed && <>
      <Divider />
      <Stack spacing={0.75}>
        <Typography component="h4" variant="subtitle2" color="text.secondary" ref={answerRef} tabIndex={answerRef ? -1 : undefined}>
          {t("teacher:flashcards.answer")}
        </Typography>
        <Typography sx={{ whiteSpace: "pre-wrap" }}>{card.answer}</Typography>
        {card.image?.side === "answer" && media}
      </Stack>
      {card.source && <Stack spacing={0.75}>
        <Typography component="h4" variant="subtitle2" color="text.secondary">{t("teacher:flashcards.source")}</Typography>
        <Typography variant="body2">{card.source.label}</Typography>
        {card.source.anchor && <>
          <Typography component="blockquote" variant="body2" color="text.secondary"
            sx={{ m: 0, borderInlineStart: 2, borderColor: "divider", paddingInlineStart: 1.25 }}>
            {card.source.anchor.selection}
          </Typography>
          <Button variant="outlined" component={Link}
            to={"/nodia-teacher/" + encodeURIComponent(card.source.anchor.session_id)}
            sx={{ minHeight: 44, alignSelf: { xs: "stretch", sm: "flex-start" } }} endIcon={<OpenInNewOutlined />}>
            {t("teacher:flashcards.open_source")}
          </Button>
        </>}
      </Stack>}
    </>}
  </Stack>;
}
