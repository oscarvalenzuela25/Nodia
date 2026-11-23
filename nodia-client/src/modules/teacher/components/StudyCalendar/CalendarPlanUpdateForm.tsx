import { Button, Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import TextInput from "../../../../components/inputs/TextInput";
import {
  calendarMaxCategories, calendarMaxTitle, type CalendarCategory, type CalendarPlanUpdate, type CalendarSummary,
} from "../../infrastructure/studyCalendar";
import { CalendarActions } from "./styles";

const fields = z.object({
  title: z.string().trim().min(1, "teacher:calendar.required").max(calendarMaxTitle, "teacher:calendar.title_limit"),
  categoryIds: z.array(z.string()).max(calendarMaxCategories, "teacher:calendar.categories_limit"),
});

type Props = {
  plan: CalendarSummary;
  categories: readonly CalendarCategory[];
  busy: boolean;
  onCancel: () => void;
  onSave: (update: CalendarPlanUpdate) => Promise<void>;
};

export default function CalendarPlanUpdateForm({ plan, categories, busy, onCancel, onSave }: Props) {
  const { t } = useTranslation();
  const originalIds = plan.categories.map(category => category.id);
  const assigned = new Set(originalIds);
  const options = new Map(plan.categories.map(category => [category.id, category]));
  for (const category of categories) options.set(category.id, category);
  const { control, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<z.input<typeof fields>>({
    resolver: zodResolver(fields), defaultValues: { title: plan.title, categoryIds: originalIds },
  });
  const selected = useWatch({ control, name: "categoryIds" });
  const unavailable = selected.some(id => !assigned.has(id) && !options.get(id)?.active);
  const locked = busy || isSubmitting;
  const save = handleSubmit(values => {
    if (unavailable || locked) return;
    const update: CalendarPlanUpdate = {};
    if (values.title !== plan.title) update.title = values.title;
    if (values.categoryIds.length !== assigned.size || values.categoryIds.some(id => !assigned.has(id))) {
      update.category_ids = values.categoryIds;
    }
    if (!update.title && !update.category_ids) return;
    return onSave(update);
  });

  return (
    <Stack component="form" noValidate spacing={2} onSubmit={save}>
      <Controller control={control} name="title" render={({ field }) => (
        <TextInput {...field} label={t("teacher:calendar.title")} autoFocus required disabled={locked}
          error={Boolean(errors.title)} helperText={errors.title?.message && t(errors.title.message)} />
      )} />
      <Controller control={control} name="categoryIds" render={({ field }) => {
        const candidates = [...options.values()].filter(category => category.active || assigned.has(category.id) || field.value.includes(category.id));
        if (candidates.length === 0) return <Typography color="text.secondary">{t("teacher:calendar.empty_categories")}</Typography>;
        return (
          <Stack component="fieldset" sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}>
            <Typography component="legend" variant="body2">{t("teacher:calendar.categories")}</Typography>
            {candidates.map(category => {
              const checked = field.value.includes(category.id);
              const canSelect = checked || (category.active || assigned.has(category.id)) && field.value.length < calendarMaxCategories;
              return <FormControlLabel key={category.id} sx={{ m: 0, minHeight: 44, overflowWrap: "anywhere" }}
                label={category.active ? category.name : t("teacher:calendar.category_kept_inactive", { name: category.name })}
                control={<Checkbox disabled={locked || !canSelect} checked={checked} onChange={(_, marked) => {
                  field.onChange(marked ? [...field.value, category.id] : field.value.filter(id => id !== category.id));
                }} />} />;
            })}
          </Stack>
        );
      }} />
      {selected.length >= calendarMaxCategories && <Typography variant="body2" color="text.secondary">{t("teacher:calendar.categories_limit")}</Typography>}
      {unavailable && <Typography variant="body2" color="error.main">{t("teacher:calendar.category_unavailable")}</Typography>}
      <CalendarActions sx={{ justifyContent: "flex-end" }}>
        <Button variant="outlined" disabled={locked} onClick={onCancel}>{t("teacher:calendar.cancel")}</Button>
        <Button variant="contained" type="submit" disabled={locked || unavailable || !isDirty}>{t("teacher:calendar.save_plan")}</Button>
      </CalendarActions>
    </Stack>
  );
}
