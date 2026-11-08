import { Controller, useWatch, type Control, type FieldErrors } from "react-hook-form";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import type { CreateSession } from "../../infrastructure/schemas";

type Props = { control: Control<CreateSession>; errors: FieldErrors<CreateSession>; busy: boolean };

export default function SessionFields({ control, errors, busy }: Props) {
  const { t } = useTranslation();
  const organization = useWatch({ control, name: "organization" });
  return <>
    {(["topic", "objective", "title", "declared_base", "context", "explanation_language"] as const).map(name => <Controller key={name} name={name} control={control} render={({ field }) => <TextInput name={name} label={t(`teacher:fields.${name}`)} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} multiline={name === "objective" || name === "declared_base" || name === "context"} minRows={name === "objective" ? 2 : 1} required={name === "topic" || name === "objective" || name === "explanation_language"} disabled={busy} error={Boolean(errors[name])} helperText={errors[name] ? t("teacher:invalid_field") : undefined} />} />)}
    <Controller name="organization" control={control} render={({ field }) => <SelectSingleInput label={t("teacher:fields.organization")} value={field.value} options={["teacher_suggests", "days", "topics"].map(value => ({ value, label: t(`teacher:organization.${value}`) }))} onChange={value => field.onChange(value)} clearable={false} disabled={busy} />} />
    {organization === "days" && <Controller name="day_count" control={control} render={({ field }) => <TextInput label={t("teacher:fields.day_count")} value={field.value === null ? "" : String(field.value)} type="number" inputMode="numeric" onChange={event => field.onChange(event.target.value === "" ? null : Number(event.target.value))} disabled={busy} error={Boolean(errors.day_count)} helperText={errors.day_count ? t("teacher:days_required") : undefined} />} />}
  </>;
}
