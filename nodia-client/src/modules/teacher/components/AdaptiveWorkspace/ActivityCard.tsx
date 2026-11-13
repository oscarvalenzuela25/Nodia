import { useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import type { Activity } from "../../infrastructure/enrichmentSchemas";
import type { CommandResult } from "../../infrastructure/schemas";
import LessonMarkdown from "../LessonMarkdown";

type ActivityProps = { activity: Activity; disabled: boolean; respond: (answer: unknown) => Promise<CommandResult | null> };
export default function ActivityCard(props: ActivityProps) {
  const { t } = useTranslation();
  if (props.activity.availability === "unsupported") return <Stack sx={{ gap: 1 }}><Typography>{props.activity.prompt}</Typography><Alert severity="info">{t("teacher:adaptive.unsupported_activity")}</Alert></Stack>;
  return <SupportedActivityCard {...props} activity={props.activity} />;
}

function SupportedActivityCard({ activity, disabled, respond }: Omit<ActivityProps, "activity"> & { activity: Extract<Activity, { availability: "available" }> }) {
  const { t } = useTranslation();
  const [order, setOrder] = useState(() => activity.kind === "ordering" ? activity.payload.items : []);
  const [classes, setClasses] = useState<Record<string, string>>({});
  const [line, setLine] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const move = (index: number, delta: number) => setOrder(current => { const next = [...current]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next; });
  const answer = activity.kind === "ordering" ? order : activity.kind === "classification" ? classes : activity.kind === "error_location" ? Number(line) : text;
  const valid = activity.kind === "classification" ? activity.payload.items.every(item => classes[item]) : activity.kind === "error_location" ? line !== null : activity.kind === "completion" ? text.trim().length > 0 && text.length <= 2000 : true;
  return <Stack sx={{ gap: 2, border: 1, borderColor: "divider", borderRadius: 2, p: 2, minWidth: 0 }}>
    <Typography variant="overline">{t(`teacher:adaptive.activity_kinds.${activity.kind}`)}</Typography>
    <LessonMarkdown text={activity.prompt} />
    {activity.kind === "ordering" && order.map((item, index) => <Stack key={item} direction="row" sx={{ gap: 1, alignItems: "center" }}><Typography sx={{ flex: 1, overflowWrap: "anywhere" }}>{item}</Typography><Button variant="outlined" disabled={disabled || index === 0} aria-label={t("teacher:adaptive.move_up", { value: item })} onClick={() => move(index, -1)}>↑</Button><Button variant="outlined" disabled={disabled || index === order.length - 1} aria-label={t("teacher:adaptive.move_down", { value: item })} onClick={() => move(index, 1)}>↓</Button></Stack>)}
    {activity.kind === "classification" && activity.payload.items.map(item => <SelectSingleInput key={item} label={item} options={activity.payload.categories} value={classes[item] ?? null} disabled={disabled} onChange={value => setClasses(current => { const next = { ...current }; if (value === null) delete next[item]; else next[item] = value; return next; })} />)}
    {activity.kind === "error_location" && <SelectSingleInput label={t("teacher:adaptive.choose_line")} options={activity.payload.lines.map((item, index) => ({ value: String(index + 1), label: `${index + 1}. ${item}` }))} value={line} onChange={setLine} disabled={disabled} />}
    {activity.kind === "completion" && <TextInput label={t("teacher:your_answer")} value={text} multiline disabled={disabled} onChange={event => setText(event.target.value)} />}
    {result !== null && <Alert severity={result ? "success" : "info"}>{t(result ? "teacher:adaptive.activity_correct" : "teacher:adaptive.activity_incorrect")}</Alert>}
    {activity.answered && result === null && <Typography>{t("teacher:adaptive.previously_answered")}</Typography>}
    <Button variant="contained" disabled={disabled || !valid} onClick={async () => { const receipt = await respond(answer); if (receipt && receipt.observation?.correct !== undefined) setResult(receipt.observation.correct); }}>{t("teacher:submit_answer")}</Button>
  </Stack>;
}
