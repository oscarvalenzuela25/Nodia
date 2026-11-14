import { Controller, useWatch, type Control, type FieldErrors } from "react-hook-form";
import { Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import type { CreateSession } from "../../infrastructure/schemas";
import FieldHelp from "../FieldHelp";
import { FieldGrid, FieldSlot, Introduction } from "./styles";

type Props = { control: Control<CreateSession>; errors: FieldErrors<CreateSession>; busy: boolean };
const languageTags = ["es", "en", "pt", "fr", "de", "it", "ja", "ko", "zh", "ar", "ru", "hi"];

export default function SessionFields({ control, errors, busy }: Props) {
  const { t } = useTranslation();
  const organization = useWatch({ control, name: "organization" });
  const language = useWatch({ control, name: "explanation_language" });
  const languageOptions = languageTags.map(value => ({ value, label: t(`teacher:languages.${value}`) }));
  // Keep the exact persisted tag, including regional variants, until the user
  // explicitly chooses another language. The menu is not a provider capability list.
  if (language && !languageTags.includes(language)) languageOptions.push({ value: language, label: t("teacher:stored_language", { language }) });
  const help = (name: string) => <FieldHelp label={t(`teacher:fields.${name}`)} message={t(`teacher:form_help.${name}`)} />;
  return <>
    <Introduction>
      <Typography component="h2" variant="h6">{t("teacher:form_heading")}</Typography>
      <Typography variant="body2" color="text.secondary">{t("teacher:form_intro")}</Typography>
    </Introduction>
    <FieldGrid>
      {(["title", "topic", "objective", "declared_base", "context"] as const).map(name => <FieldSlot key={name} wide={name === "topic" || name === "objective" || name === "title"}>
        <Controller name={name} control={control} render={({ field }) => <TextInput name={name} label={t(`teacher:fields.${name}`)} labelAdornment={help(name)} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} multiline={name === "objective" || name === "declared_base" || name === "context"} minRows={name === "objective" ? 2 : 3} required={name === "topic" || name === "objective"} disabled={busy} error={Boolean(errors[name])} helperText={errors[name] ? t("teacher:invalid_field") : name === "declared_base" || name === "context" ? t(`teacher:form_hints.${name}`) : undefined} />} />
      </FieldSlot>)}
      <FieldSlot><Controller name="explanation_language" control={control} render={({ field }) => <SelectSingleInput label={t("teacher:fields.explanation_language")} labelAdornment={help("explanation_language")} value={field.value} options={languageOptions} onChange={value => { if (value !== null) field.onChange(value); }} required clearable={false} disabled={busy} error={Boolean(errors.explanation_language)} helperText={errors.explanation_language ? t("teacher:invalid_field") : undefined} />} /></FieldSlot>
      <FieldSlot><Controller name="organization" control={control} render={({ field }) => <SelectSingleInput label={t("teacher:fields.organization")} labelAdornment={help("organization")} value={field.value} options={["teacher_suggests", "days", "topics"].map(value => ({ value, label: t(`teacher:organization.${value}`) }))} onChange={value => { if (value !== null) field.onChange(value); }} clearable={false} disabled={busy} error={Boolean(errors.organization)} helperText={errors.organization ? t("teacher:invalid_field") : undefined} />} /></FieldSlot>
      {organization === "days" && <FieldSlot><Controller name="day_count" control={control} render={({ field }) => <TextInput label={t("teacher:fields.day_count")} labelAdornment={help("day_count")} value={field.value === null ? "" : String(field.value)} type="number" inputMode="numeric" onChange={event => field.onChange(event.target.value === "" ? null : Number(event.target.value))} disabled={busy} error={Boolean(errors.day_count)} helperText={errors.day_count ? t("teacher:days_required") : undefined} />} /></FieldSlot>}
    </FieldGrid>
  </>;
}
