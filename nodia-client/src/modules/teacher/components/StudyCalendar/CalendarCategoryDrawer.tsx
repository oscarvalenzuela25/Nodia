import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Chip, Stack, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import { useTranslation } from "react-i18next";
import ActiveStatusSelect, { type ActiveFilterStatus } from "../../../../components/Filter/components/ActiveStatusSelect";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import TextInput from "../../../../components/inputs/TextInput";
import { calendarColors, calendarMaxCategoryName, type CalendarCategory, type CalendarColor } from "../../infrastructure/studyCalendar";
import CalendarDrawer from "./CalendarDrawer";
import { calendarChipColors, CalendarActions, CalendarPanel } from "./styles";

const categoryFields = z.object({
  name: z.string().transform(value => value.normalize("NFKC").replace(/[\p{White_Space}\uFEFF]+/gu, " ").trim())
    .pipe(z.string().min(1, "teacher:calendar.required").max(calendarMaxCategoryName, "teacher:calendar.category_limit")),
  color: z.enum(calendarColors),
});

type Props = {
  categories: readonly CalendarCategory[];
  busy: boolean;
  onClose: () => void;
  onSave: (name: string, color: CalendarColor, id?: string) => Promise<boolean>;
  onToggle: (id: string, active: boolean) => Promise<boolean>;
};

export default function CalendarCategoryDrawer({ categories, busy, onClose, onSave, onToggle }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ActiveFilterStatus>("active");
  const [formCategory, setFormCategory] = useState<CalendarCategory | "new" | null>(null);
  const [toggleCategory, setToggleCategory] = useState<CalendarCategory>();
  const { control, reset, handleSubmit, formState: { errors } } = useForm<z.input<typeof categoryFields>>({
    resolver: zodResolver(categoryFields), defaultValues: { name: "", color: "violet" },
  });

  const filtered = categories.filter(category => status === "all" || category.active === (status === "active"));
  const edit = (category: CalendarCategory | "new") => {
    reset(category === "new" ? { name: "", color: "violet" } : { name: category.name, color: category.color });
    setFormCategory(category);
  };
  const editableId = formCategory && formCategory !== "new" ? formCategory.id : undefined;
  const save = handleSubmit(async values => {
    try {
      if (await onSave(values.name, values.color, editableId)) setFormCategory(null);
    } catch {
      // The shared HTTP layer presents the error. Keep the user's draft in the drawer.
    }
  });
  const changeActive = async (category: CalendarCategory) => {
    try {
      if (await onToggle(category.id, !category.active)) setToggleCategory(undefined);
    } catch {
      // Keep the confirmation open for retry.
    }
  };
  return (
    <CalendarDrawer title={t("teacher:calendar.categories")} busy={busy} onClose={onClose}>
      <Stack spacing={2}>
        {formCategory === null ? (
          <>
            <Stack spacing={1}>
              <ActiveStatusSelect value={status} onChange={setStatus} disabled={busy} />
              <CalendarActions sx={{ justifyContent: "flex-end" }}>
                <Button variant="contained" startIcon={<AddOutlined />} disabled={busy} onClick={() => edit("new")}>
                  {t("teacher:calendar.add_category")}
                </Button>
              </CalendarActions>
            </Stack>
            {!filtered.length && <Typography color="text.secondary">{t("teacher:calendar.empty_categories")}</Typography>}
            {filtered.map(category => (
              <CalendarPanel variant="outlined" key={category.id} sx={{ p: 1 }}>
                <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { xs: "stretch", sm: "center" }, gap: 1, justifyContent: "space-between" }}>
                  <Chip color={calendarChipColors[category.color]} label={category.name} size="small" sx={{ maxWidth: "100%", alignSelf: "flex-start" }} />
                  <CalendarActions sx={{ justifyContent: "flex-end" }}>
                    <Button variant="outlined" size="small" disabled={busy} onClick={() => edit(category)}>
                      {t("teacher:calendar.edit")}
                    </Button>
                    <Button variant="outlined" size="small" disabled={busy} onClick={() => setToggleCategory(category)}>
                      {t(category.active ? "teacher:calendar.deactivate_category" : "teacher:calendar.activate_category")}
                    </Button>
                  </CalendarActions>
                </Stack>
              </CalendarPanel>
            ))}
          </>
        ) : (
          <Stack component="form" noValidate spacing={2} onSubmit={save}>
            <Controller control={control} name="name" render={({ field }) => (
              <TextInput {...field} label={t("teacher:calendar.category_name")} autoFocus required disabled={busy}
                error={Boolean(errors.name)} helperText={errors.name?.message && t(errors.name.message)} />
            )} />
            <Controller control={control} name="color" render={({ field }) => (
              <SelectSingleInput label={t("teacher:calendar.category_color")} value={field.value} disabled={busy} clearable={false}
                options={calendarColors.map(color => ({ value: color, label: t("teacher:calendar.colors." + color) }))}
                onChange={value => {
                  const color = calendarColors.find(option => option === value);
                  if (color) field.onChange(color);
                }} />
            )} />
            <CalendarActions sx={{ justifyContent: "flex-end" }}>
              <Button variant="outlined" disabled={busy} onClick={() => setFormCategory(null)}>{t("teacher:calendar.cancel")}</Button>
              <Button variant="contained" type="submit" disabled={busy}>{t("teacher:calendar.save_category")}</Button>
            </CalendarActions>
          </Stack>
        )}
      </Stack>
      {toggleCategory && (
        <ConfirmDialog open onClose={() => setToggleCategory(undefined)} onConfirm={() => { void changeActive(toggleCategory); }}
          isLoading={busy}
          title={t(toggleCategory.active ? "teacher:calendar.deactivate_category" : "teacher:calendar.activate_category")}
          message={t(toggleCategory.active ? "teacher:calendar.deactivate_question" : "teacher:calendar.activate_question", { name: toggleCategory.name })}
          confirmText={t(toggleCategory.active ? "teacher:calendar.deactivate_category" : "teacher:calendar.activate_category")} />
      )}
    </CalendarDrawer>
  );
}
