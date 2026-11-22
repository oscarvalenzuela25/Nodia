import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Stack, Tooltip, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PowerSettingsNewOutlined from "@mui/icons-material/PowerSettingsNewOutlined";
import { useTranslation } from "react-i18next";
import ActiveStatusSelect, { type ActiveFilterStatus } from "../../../../components/Filter/components/ActiveStatusSelect";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import TextInput from "../../../../components/inputs/TextInput";
import { calendarColors, calendarMaxCategoryName, type CalendarCategory, type CalendarColor } from "../../infrastructure/studyCalendar";
import CalendarDrawer from "./CalendarDrawer";
import { CalendarActions } from "./styles";
import {
  CalendarCategoryAction, CalendarCategoryChips, CalendarCategoryPill, CalendarCategoryPillLabel,
} from "./calendarCategoryStyles";

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

type CategoryAction = "edit" | "toggle";
type FocusTarget = "add" | { id: string; action: CategoryAction };
const actionKey = (id: string, action: CategoryAction) => action + ":" + id;

export default function CalendarCategoryDrawer({ categories, busy, onClose, onSave, onToggle }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ActiveFilterStatus>("active");
  const [formCategory, setFormCategory] = useState<CalendarCategory | "new" | null>(null);
  const [toggleCategory, setToggleCategory] = useState<CalendarCategory>();
  const addButton = useRef<HTMLButtonElement>(null);
  const categoryButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusTarget = useRef<FocusTarget | null>(null);
  const { control, reset, handleSubmit, formState: { errors } } = useForm<z.input<typeof categoryFields>>({
    resolver: zodResolver(categoryFields), defaultValues: { name: "", color: "violet" },
  });

  const filtered = categories.filter(category => status === "all" || category.active === (status === "active"));
  useEffect(() => {
    const target = focusTarget.current;
    if (!target || busy || formCategory !== null || toggleCategory) return;
    const button = target === "add" ? addButton.current : categoryButtons.current.get(actionKey(target.id, target.action));
    (button ?? addButton.current)?.focus();
    focusTarget.current = null;
  }, [busy, formCategory, toggleCategory]);

  const setCategoryButton = (id: string, action: CategoryAction, button: HTMLButtonElement | null) => {
    const key = actionKey(id, action);
    if (button) categoryButtons.current.set(key, button);
    else categoryButtons.current.delete(key);
  };
  const edit = (category: CalendarCategory | "new") => {
    focusTarget.current = category === "new" ? "add" : { id: category.id, action: "edit" };
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
      if (await onToggle(category.id, !category.active)) {
        if (status !== "all") focusTarget.current = "add";
        setToggleCategory(undefined);
      }
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
                <Button ref={addButton} variant="contained" startIcon={<AddOutlined />} disabled={busy} onClick={() => edit("new")}>
                  {t("teacher:calendar.add_category")}
                </Button>
              </CalendarActions>
            </Stack>
            {filtered.length === 0
              ? <Typography color="text.secondary">{t("teacher:calendar.empty_categories")}</Typography>
              : <CalendarCategoryChips role="list" aria-label={t("teacher:calendar.categories")}>
                {filtered.map(category => {
                  const editLabel = t("teacher:calendar.edit_category_named", { name: category.name });
                  const toggleLabel = t(category.active ? "teacher:calendar.deactivate_category_named" : "teacher:calendar.activate_category_named", { name: category.name });
                  return <CalendarCategoryPill key={category.id} data-color={category.color} data-active={category.active}>
                    <CalendarCategoryPillLabel>
                      {category.name}
                      {!category.active && <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {t("teacher:calendar.category_inactive")}
                      </Typography>}
                    </CalendarCategoryPillLabel>
                    <Tooltip title={editLabel} placement="top">
                      <span>
                        <CalendarCategoryAction type="button" ref={button => { setCategoryButton(category.id, "edit", button); }}
                          aria-label={editLabel} disabled={busy} onClick={() => edit(category)}>
                          <EditOutlined fontSize="small" />
                        </CalendarCategoryAction>
                      </span>
                    </Tooltip>
                    <Tooltip title={toggleLabel} placement="top">
                      <span>
                        <CalendarCategoryAction type="button" ref={button => { setCategoryButton(category.id, "toggle", button); }}
                          aria-label={toggleLabel} disabled={busy} onClick={() => {
                            focusTarget.current = { id: category.id, action: "toggle" };
                            setToggleCategory(category);
                          }}>
                          <PowerSettingsNewOutlined fontSize="small" />
                        </CalendarCategoryAction>
                      </span>
                    </Tooltip>
                  </CalendarCategoryPill>;
                })}
              </CalendarCategoryChips>}
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
