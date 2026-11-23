import { useEffect, useId, useRef, useState } from "react";
import { Alert, Button, IconButton, LinearProgress, Stack, Tooltip, Typography } from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import ReplayOutlined from "@mui/icons-material/ReplayOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import { flashcardGeneralDeck, flashcardPageSize, type Flashcard, type FlashcardDeck } from "../../infrastructure/flashcards";
import { useFlashcards } from "../../infrastructure/useFlashcards";
import TeacherLoading from "../TeacherLoading";
import FlashcardContent from "./FlashcardContent";
import { FlashcardActions, FlashcardReviewLayout, FlashcardStudySurface } from "./styles";

type RateCard = (id: string, remembered: boolean, requestKey: string) => Promise<boolean>;

type Props = {
  deckId: string;
  decks: readonly FlashcardDeck[];
  active: boolean;
  busy: boolean;
  rateCard: RateCard;
  onSelectDeck: (id: string) => void;
  onClose: () => void;
};

export default function FlashcardReview({ deckId, decks, active, busy, rateCard, onSelectDeck, onClose }: Props) {
  const { t } = useTranslation();
  const headingId = useId();
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const [index, setIndex] = useState(0);
  const [remembered, setRemembered] = useState(0);
  const [missed, setMissed] = useState<Flashcard[]>([]);
  const [repeat, setRepeat] = useState<Flashcard[]>();
  const [rating, setRating] = useState(false);
  const [lastTotal, setLastTotal] = useState<number>();
  const page = Math.floor(index / flashcardPageSize) + 1;
  const pastLast = lastTotal !== undefined && index >= lastTotal;
  const cards = useFlashcards(deckId, page, active && repeat === undefined && !pastLast);
  const result = cards.data?.meta.page === page ? cards.data : undefined;
  const total = repeat?.length ?? (pastLast ? lastTotal : result?.meta.total);
  const card = repeat ? repeat[index] : result?.data[index % flashcardPageSize];
  const loading = !pastLast && repeat === undefined && !result && !cards.isError;
  const done = total !== undefined && total > 0 && index >= total;
  const locked = busy || rating;

  useEffect(() => {
    if (done && active) doneHeading.current?.focus();
  }, [active, done]);

  const retryMissed = () => {
    setRepeat(missed);
    setMissed([]);
    setRemembered(0);
    setIndex(0);
    setLastTotal(undefined);
  };

  return <FlashcardReviewLayout aria-labelledby={headingId}>
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Tooltip title={t("teacher:flashcards.back_to_decks")}>
        <span><IconButton aria-label={t("teacher:flashcards.back_to_decks")} disabled={locked} onClick={onClose}
          sx={{ width: 44, height: 44 }}><ArrowBackOutlined /></IconButton></span>
      </Tooltip>
      <Typography id={headingId} component="h2" variant="h5">{t("teacher:flashcards.review_heading")}</Typography>
    </Stack>
    <SelectSingleInput label={t("teacher:flashcards.deck")} value={deckId} clearable={false}
      disabled={locked} onChange={id => { if (id && id !== deckId) onSelectDeck(id); }}
      options={decks.map(deck => ({ value: deck.id, label: deck.id === flashcardGeneralDeck ? t("teacher:flashcards.general") : deck.title }))} />
    {repeat === undefined && <QueryErrorAlert retryVariant="outlined" isError={cards.isError} isFetching={cards.isFetching} onRetry={cards.refetch} />}
    <TeacherLoading loading={loading}>
      {card && !done && total !== undefined && total > 0 && <Stack spacing={2}>
        <Stack spacing={0.75}>
          <Typography variant="body2" color="text.secondary">
            {t("teacher:flashcards.review_position", { position: index + 1, total })}
          </Typography>
          <LinearProgress variant="determinate" value={Math.min(100, (index + 1) / total * 100)}
            aria-label={t("teacher:flashcards.review_progress")} aria-valuetext={t("teacher:flashcards.review_position", { position: index + 1, total })}
            sx={{ height: 6, borderRadius: 999 }} />
        </Stack>
        <ReviewQuestion key={index + ":" + card.id} card={card} busy={locked || (repeat === undefined && cards.isFetching)}
          active={active} rateCard={rateCard} onRating={setRating} onRated={known => {
            if (known) setRemembered(count => count + 1);
            else setMissed(items => [...items, card]);
            setLastTotal(total);
            setIndex(position => position + 1);
          }} />
      </Stack>}
      {done && <FlashcardStudySurface>
        <Typography ref={doneHeading} tabIndex={-1} component="h3" variant="h6">{t("teacher:flashcards.review_done")}</Typography>
        <Typography color="text.secondary">{t("teacher:flashcards.review_summary", { remembered, missed: missed.length })}</Typography>
        <FlashcardActions>
          {missed.length > 0 && <Button variant="contained" startIcon={<ReplayOutlined />} disabled={locked} onClick={retryMissed}>
            {t("teacher:flashcards.review_again")}
          </Button>}
          <Button variant="outlined" disabled={locked} onClick={onClose}>{t("teacher:flashcards.back_to_decks")}</Button>
        </FlashcardActions>
      </FlashcardStudySurface>}
      {!loading && !card && !done && !cards.isError && (
        <FlashcardStudySurface>
          <Typography color="text.secondary">{t("teacher:flashcards.empty_deck")}</Typography>
        </FlashcardStudySurface>
      )}
    </TeacherLoading>
  </FlashcardReviewLayout>;
}

type ReviewQuestionProps = {
  card: Flashcard;
  active: boolean;
  busy: boolean;
  rateCard: RateCard;
  onRating: (rating: boolean) => void;
  onRated: (remembered: boolean) => void;
};

function ReviewQuestion({ card, active, busy, rateCard, onRating, onRated }: ReviewQuestionProps) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const answerHeading = useRef<HTMLHeadingElement>(null);
  const intent = useRef<{ remembered: boolean; key: string } | null>(null);
  const sending = useRef(false);
  useEffect(() => {
    if (active) (revealed ? answerHeading : questionHeading).current?.focus();
  }, [active, revealed]);

  const rate = async (remembered: boolean) => {
    if (!revealed || busy || sending.current) return;
    const request = intent.current ?? { remembered, key: crypto.randomUUID() };
    intent.current = request;
    sending.current = true;
    onRating(true);
    try {
      if (await rateCard(card.id, request.remembered, request.key)) {
        onRated(request.remembered);
      } else {
        setUncertain(true);
      }
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const acknowledgementLost = status === undefined || status === 408 || status >= 500;
      if (!acknowledgementLost) intent.current = null;
      setUncertain(acknowledgementLost);
    } finally {
      sending.current = false;
      onRating(false);
    }
  };

  return <Stack spacing={2}>
    <FlashcardStudySurface>
      <FlashcardContent card={card} revealed={revealed} questionRef={questionHeading} answerRef={answerHeading} active={active} />
    </FlashcardStudySurface>
    {uncertain && <Alert severity="warning">{t("teacher:flashcards.review_uncertain")}</Alert>}
    <FlashcardActions>
      {!revealed ? <Button variant="contained" startIcon={<VisibilityOutlined />} disabled={busy} onClick={() => setRevealed(true)}>
        {t("teacher:flashcards.reveal_answer")}
      </Button> : uncertain ? <Button variant="contained" disabled={busy} onClick={() => {
        if (intent.current) void rate(intent.current.remembered);
      }}>{t("core:retry")}</Button> : <>
        <Button variant="outlined" startIcon={<ReplayOutlined />} disabled={busy} onClick={() => { void rate(false); }}>
          {t("teacher:flashcards.review_again")}
        </Button>
        <Button variant="contained" startIcon={<CheckOutlined />} disabled={busy} onClick={() => { void rate(true); }}>
          {t("teacher:flashcards.remembered")}
        </Button>
      </>}
    </FlashcardActions>
  </Stack>;
}
