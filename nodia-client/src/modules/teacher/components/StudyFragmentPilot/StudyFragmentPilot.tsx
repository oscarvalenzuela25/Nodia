import { useId, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { useTranslation } from "react-i18next";
import { Choice, CompareGrid, Feedback, Fragment, Sequence, Tile } from "./styles";

const vowels = [
  { word: "sit", before: "s", sound: "ɪ", after: "t" },
  { word: "seat", before: "s", sound: "iː", after: "t" },
] as const;
const spelling = [
  { character: "B", name: "B", pronunciation: "bee" },
  { character: "E", name: "E", pronunciation: "ee" },
  { character: "E", name: "E", pronunciation: "ee" },
  { character: "-", name: null, pronunciation: "hyphen" },
  { character: "2", name: "2", pronunciation: "two" },
  { character: "2", name: "2", pronunciation: "two" },
] as const;
const spellingChoices = ["ee", "hyphen", "two"] as const;

export function VowelComparison() {
  const { t } = useTranslation("teacher", { keyPrefix: "fragment_pilot.vowels" });
  const titleId = useId();
  const questionId = useId();
  const [answer, setAnswer] = useState<typeof vowels[number]["word"]>();

  return (
    <Fragment aria-labelledby={titleId}>
      <Typography id={titleId} variant="h6" component="h4">{t("title")}</Typography>
      <Typography id={questionId} variant="body2" color="text.secondary">{t("question")}</Typography>
      <CompareGrid role="group" aria-labelledby={questionId}>
        {vowels.map(({ word, before, sound, after }) => (
          <Choice key={word} lang="en" variant="outlined" aria-label={`${word} /${before}${sound}${after}/`}
            aria-pressed={answer === word} onClick={() => setAnswer(word)}>
            <Typography component="span" variant="h5">{word}</Typography>
            <Typography component="span" variant="body1">/{before}<strong>{sound}</strong>{after}/</Typography>
          </Choice>
        ))}
      </CompareGrid>
      <ExerciseFeedback correct={answer === "seat"}>{answer && t(answer === "seat" ? "correct" : "retry")}</ExerciseFeedback>
    </Fragment>
  );
}

export function SpellingSequence() {
  const { t } = useTranslation("teacher", { keyPrefix: "fragment_pilot.spelling" });
  const titleId = useId();
  const hintId = useId();
  const questionId = useId();
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(() => new Set());
  const [answer, setAnswer] = useState<typeof spellingChoices[number]>();

  function toggle(position: number) {
    setRevealed(current => {
      const next = new Set(current);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });
  }

  return (
    <Fragment aria-labelledby={titleId}>
      <Typography id={titleId} variant="h6" component="h4">{t("title", { code: "BEE–22" })}</Typography>
      <Typography id={hintId} variant="body2" color="text.secondary">{t("instruction")}</Typography>
      <Sequence aria-labelledby={titleId} aria-describedby={hintId} role="list">
        {spelling.map(({ character, name, pronunciation }, index) => {
          const position = index + 1;
          const show = revealed.has(position);
          const pronunciationId = `${titleId}-${position}`;
          return (
            <li key={position}>
              <Tile variant="outlined" aria-expanded={show} aria-controls={pronunciationId}
                aria-label={t("tile", { position, character: name ?? t("separator") })}
                aria-describedby={show ? pronunciationId : undefined}
                onClick={() => toggle(position)}>
                <Typography component="span" variant="h5" aria-hidden="true">{character}</Typography>
                <Typography id={pronunciationId} component="span" variant="body2" lang="en" sx={{ visibility: show ? "visible" : "hidden" }}>
                  {pronunciation}
                </Typography>
              </Tile>
            </li>
          );
        })}
      </Sequence>
      <Stack sx={{ gap: 1 }}>
        <Typography id={questionId} variant="body2" sx={{ fontWeight: 700 }}>{t("question")}</Typography>
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }} role="group" aria-labelledby={questionId}>
          {spellingChoices.map(choice => (
            <Button key={choice} lang="en" variant={answer === choice ? "contained" : "outlined"}
              aria-pressed={answer === choice} onClick={() => setAnswer(choice)} sx={{ minHeight: 44 }}>
              {choice}
            </Button>
          ))}
        </Stack>
      </Stack>
      <ExerciseFeedback correct={answer === "hyphen"}>
        {answer && t(answer === "hyphen" ? "correct" : "retry")}
      </ExerciseFeedback>
    </Fragment>
  );
}

function ExerciseFeedback({ correct, children }: { correct: boolean; children?: string }) {
  return (
    <Box role="status">
      {children && (
        <Feedback data-correct={correct}>
          {correct ? <CheckCircleOutlined fontSize="small" /> : <InfoOutlined fontSize="small" />}
          <Typography variant="body2">{children}</Typography>
        </Feedback>
      )}
    </Box>
  );
}
