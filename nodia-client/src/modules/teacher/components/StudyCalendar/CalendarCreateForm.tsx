import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, Box, Button, Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import DateInput from "../../../../components/inputs/DateInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import TextInput from "../../../../components/inputs/TextInput";
import { calendarMaxCategories, calendarMaxDays, calendarMaxTitle, calendarRangeLength, calendarScheduleSchema, type CalendarCategory } from "../../infrastructure/studyCalendar";
import type { StudyCalendarImportPlan } from "../../infrastructure/studyCalendarImport";
import { CalendarActions } from "./styles";

const fields = z.object({
  title: z.string().trim().min(1, "teacher:calendar.required").max(calendarMaxTitle, "teacher:calendar.title_limit"),
  kind: z.enum(["numbered", "dated"]),
  count: z.string(),
  start: z.string(),
  end: z.string(),
  categories: z.array(z.string()).max(calendarMaxCategories, "teacher:calendar.categories_limit"),
}).superRefine((value, ctx) => {
  if (!calendarScheduleSchema.safeParse(scheduleFor(value)).success) {
    ctx.addIssue({ code: "custom", path: [value.kind === "numbered" ? "count" : "end"], message: "teacher:calendar.invalid_schedule" });
  }
});

type Fields = z.input<typeof fields>;
const scheduleFor = (value: Pick<Fields, "kind" | "count" | "start" | "end">) => value.kind === "numbered"
  ? { kind: "numbered" as const, days: Number(value.count) }
  : { kind: "dated" as const, start: value.start, end: value.end };

type Props = {
  categories: readonly CalendarCategory[];
  busy: boolean;
  uncertain: boolean;
  onCancel: () => void;
  onSave: (plan: StudyCalendarImportPlan) => void;
  onRetry: () => void;
};
export default function CalendarCreateForm({ categories, busy, uncertain, onCancel, onSave, onRetry }: Props) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors } } = useForm<Fields>({
    resolver: zodResolver(fields),
    defaultValues: { title: "", kind: "numbered", count: "30", start: "", end: "", categories: [] },
  });
  const [kind, count, start, end, selectedCategories] = useWatch({ control, name: ["kind", "count", "start", "end", "categories"] });
  const days = kind === "numbered" ? Number(count) : calendarRangeLength(start, end);
  const locked = busy || uncertain;
  const unavailableCategory = selectedCategories.some(id => !categories.some(category => category.id === id && category.active));
  return (
    <Stack component="form" noValidate spacing={2} onSubmit={handleSubmit(values => onSave({
      version: 1, title: values.title, categories: categories.filter(category => values.categories.includes(category.id)).map(category => category.name), schedule: scheduleFor(values),
    }))}>
      <Controller control={control} name="title" render={({ field }) => (
        <TextInput {...field} label={t("teacher:calendar.title")} autoFocus required disabled={locked} error={Boolean(errors.title)} helperText={errors.title?.message && t(errors.title.message)} />
      )} />
      <Controller control={control} name="kind" render={({ field }) => (
        <SelectSingleInput label={t("teacher:calendar.organization")} value={field.value} clearable={false} disabled={locked}
          options={[{ value: "numbered", label: t("teacher:calendar.numbered") }, { value: "dated", label: t("teacher:calendar.dated") }]}
          onChange={value => { if (value === "numbered" || value === "dated") field.onChange(value); }} />
      )} />
      {kind === "numbered" ? (
        <Controller control={control} name="count" render={({ field }) => (
          <TextInput {...field} label={t("teacher:calendar.day_count")} inputMode="numeric" type="number" required disabled={locked}
            error={Boolean(errors.count)} helperText={errors.count?.message && t(errors.count.message, { max: calendarMaxDays })} />
        )} />
      ) : (
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" } }}>
          <Controller control={control} name="start" render={({ field }) => <DateInput {...field} label={t("teacher:calendar.start")} required disabled={locked} />} />
          <Controller control={control} name="end" render={({ field }) => (
            <DateInput {...field} label={t("teacher:calendar.end")} required disabled={locked}
              error={Boolean(errors.end)} helperText={errors.end?.message && t(errors.end.message, { max: calendarMaxDays })} />
          )} />
        </Box>
      )}
      {Number.isInteger(days) && days > 0 && days <= calendarMaxDays && (
        <Alert severity="info" role="status">{t("teacher:calendar.created_day_count", { count: days })}</Alert>
      )}
      {categories.some(category => category.active || selectedCategories.includes(category.id)) && (
        <Controller control={control} name="categories" render={({ field }) => (
          <Stack component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
            <Typography component="legend" variant="body2">{t("teacher:calendar.categories")}</Typography>
            {categories.filter(category => category.active || field.value.includes(category.id)).map(category =>
              <FormControlLabel key={category.id} label={category.name} sx={{ m: 0, minHeight: 44 }}
                control={<Checkbox disabled={locked || (!field.value.includes(category.id) && field.value.length >= calendarMaxCategories)}
                  checked={field.value.includes(category.id)} onChange={(_, checked) => {
                  field.onChange(checked ? [...field.value, category.id] : field.value.filter(id => id !== category.id));
                }} />} />,
            )}
          </Stack>
        )} />
      )}
      {selectedCategories.length >= calendarMaxCategories && <Typography variant="body2" color="text.secondary">{t("teacher:calendar.categories_limit")}</Typography>}
      {unavailableCategory && <Alert severity="warning">{t("teacher:calendar.category_unavailable")}</Alert>}
      {uncertain && <Alert severity="warning">{t("teacher:calendar.uncertain")}</Alert>}
      <CalendarActions sx={{ justifyContent: "flex-end" }}>
        <Button variant="outlined" disabled={busy} onClick={onCancel}>{t("teacher:calendar.cancel")}</Button>
        {uncertain
          ? <Button variant="contained" disabled={busy} onClick={onRetry}>{t("core:retry")}</Button>
          : <Button variant="contained" disabled={busy || unavailableCategory} type="submit">{t("teacher:calendar.new")}</Button>}
      </CalendarActions>
    </Stack>
  );
}
