import { useEffect, useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import { parseDeclaredConfidence } from "../../infrastructure/learningSchemas";

type Reflection = { self_explanation: string | null; confidence: number | null };
export default function ResponseReflection({ value, disabled, canSave, onDirty, onSave }: { value: Reflection; disabled: boolean; canSave: boolean; onDirty: (dirty: boolean) => void; onSave: (value: Reflection) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [text, setText] = useState(value.self_explanation ?? "");
  const [confidence, setConfidence] = useState(value.confidence === null ? "" : String(value.confidence));
  const [confirmed, setConfirmed] = useState(value);
  const parsed = parseDeclaredConfidence(confidence);
  const next = { self_explanation: text.trim() || null, confidence: parsed ?? null };
  const dirty = text !== (confirmed.self_explanation ?? "") || confidence !== (confirmed.confidence === null ? "" : String(confirmed.confidence));
  const remoteChanged = value.self_explanation !== confirmed.self_explanation || value.confidence !== confirmed.confidence;
  if (remoteChanged && !dirty) { setText(value.self_explanation ?? ""); setConfidence(value.confidence === null ? "" : String(value.confidence)); setConfirmed(value); }
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  return <Stack sx={{ gap: 1 }}>
    <Typography variant="subtitle1" component="h4">{t("teacher:adaptive.reflection")}</Typography>
    <Typography variant="body2" color="text.secondary">{t("teacher:adaptive.reflection_notice")}</Typography>
    <TextInput label={t("teacher:adaptive.your_reasoning")} value={text} multiline disabled={disabled} onChange={event => setText(event.target.value)} error={text.length > 2000} />
    <TextInput label={t("teacher:adaptive.confidence")} value={confidence} disabled={disabled} onChange={event => setConfidence(event.target.value)} error={parsed === undefined} helperText={t("teacher:adaptive.confidence_notice")} />
    {dirty && !canSave && <Alert severity="info">{t("teacher:adaptive.save_answer_first")}</Alert>}
    {dirty && remoteChanged && <Alert severity="warning">{t("teacher:adaptive.reflection_changed")}</Alert>}
    <Button variant="outlined" disabled={disabled || !canSave || !dirty || parsed === undefined || text.length > 2000} onClick={async () => { if (await onSave(next)) { setText(next.self_explanation ?? ""); setConfidence(next.confidence === null ? "" : String(next.confidence)); setConfirmed(next); } }}>{t("teacher:adaptive.save_reflection")}</Button>
  </Stack>;
}
