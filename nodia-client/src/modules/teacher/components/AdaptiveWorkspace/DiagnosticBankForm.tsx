import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, Button, Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import type { AdaptivePanelProps } from "./types";

type Entry = { id: string; description: string; prompt: string; answer: string; explanation: string };
const entrySchema = z.object({ id: z.uuid(), description: z.string().trim().min(1).max(2000), prompt: z.string().trim().min(1).max(2000), answer: z.string().trim().min(1).max(2000), explanation: z.string().trim().min(1).max(2000) });
const bankDraftSchema = z.object({ title: z.string().trim().min(1).max(160), entries: z.array(entrySchema).min(1).max(4), reviewed: z.boolean() });
const emptyEntry = (): Entry => ({ id: crypto.randomUUID(), description: "", prompt: "", answer: "", explanation: "" });

export default function DiagnosticBankForm({ session, command, revision, disabled, onSaved }: AdaptivePanelProps & { revision: number; disabled: boolean; onSaved: () => void }) {
  const { t } = useTranslation();
  const { control, setValue, handleSubmit } = useForm({ resolver: zodResolver(bankDraftSchema), defaultValues: { title: "", entries: [emptyEntry()], reviewed: false } });
  const title = useWatch({ control, name: "title" });
  const entries = useWatch({ control, name: "entries" });
  const reviewed = useWatch({ control, name: "reviewed" });
  const setTitle = (value: string) => setValue("title", value, { shouldDirty: true });
  const setReviewed = (value: boolean) => setValue("reviewed", value, { shouldDirty: true });
  const setEntries = (update: Entry[] | ((current: Entry[]) => Entry[])) => setValue("entries", typeof update === "function" ? update(entries) : update, { shouldDirty: true });
  const valid = title.trim().length > 0 && title.length <= 160 && entries.every(item => item.description.trim() && item.prompt.trim() && item.answer.trim() && item.explanation.trim() && item.description.length <= 2000 && item.prompt.length <= 2000 && item.answer.length <= 2000 && item.explanation.length <= 2000);
  const update = (id: string, field: keyof Omit<Entry, "id">, value: string) => { setReviewed(false); setEntries(current => current.map(item => item.id === id ? { ...item, [field]: value } : item)); };
  const save = handleSubmit(async () => {
    if (disabled || !valid) return;
    const result = await command.execute(`sessions/${session.id}/learning/diagnostic-blueprints`, { expected_session_revision: revision, title: title.trim(), reviewed, dimensions: entries.map(item => ({ id: item.id, description: item.description })), items: entries.map(item => ({ dimension_id: item.id, kind: "completion", prompt: item.prompt, private_key: { kind: "completion", alternatives: [item.answer], case_sensitive: false }, explanation: item.explanation })) });
    if (result) onSaved();
  });
  return <Stack sx={{ gap: 2 }}>
    <Alert severity="info">{t("teacher:adaptive.bank_author_notice")}</Alert>
    <TextInput label={t("teacher:adaptive.bank_title")} value={title} disabled={disabled} onChange={event => { setReviewed(false); setTitle(event.target.value); }} />
    {entries.map((item, index) => <Stack key={item.id} sx={{ gap: 2, border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
      <Typography variant="subtitle1" component="h4">{t("teacher:adaptive.bank_item", { number: index + 1 })}</Typography>
      <TextInput label={t("teacher:adaptive.dimension")} value={item.description} disabled={disabled} onChange={event => update(item.id, "description", event.target.value)} />
      <TextInput label={t("teacher:adaptive.question")} value={item.prompt} multiline disabled={disabled} onChange={event => update(item.id, "prompt", event.target.value)} />
      <TextInput label={t("teacher:adaptive.expected_answer")} value={item.answer} disabled={disabled} onChange={event => update(item.id, "answer", event.target.value)} />
      <TextInput label={t("teacher:adaptive.explanation")} value={item.explanation} multiline disabled={disabled} onChange={event => update(item.id, "explanation", event.target.value)} />
      {entries.length > 1 && <Button variant="outlined" disabled={disabled} onClick={() => { setReviewed(false); setEntries(current => current.filter(value => value.id !== item.id)); }}>{t("teacher:adaptive.remove_item")}</Button>}
    </Stack>)}
    <Button variant="outlined" disabled={disabled || entries.length >= 4} onClick={() => { setReviewed(false); setEntries(current => [...current, emptyEntry()]); }}>{t("teacher:adaptive.add_item")}</Button>
    <FormControlLabel control={<Checkbox checked={reviewed} disabled={disabled} onChange={(_, value) => setReviewed(value)} />} label={t("teacher:adaptive.reviewed_confirmation")} />
    <Button variant="contained" disabled={disabled || !valid} onClick={() => void save()}>{t("teacher:adaptive.save_bank")}</Button>
  </Stack>;
}
