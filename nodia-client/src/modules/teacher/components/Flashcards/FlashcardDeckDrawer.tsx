import { Button, Stack } from "@mui/material";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import TextInput from "../../../../components/inputs/TextInput";
import { flashcardCategoryLimit, flashcardDeckTitleLimit, type FlashcardDeckFields, type FlashcardSet } from "../../infrastructure/flashcards";
import CalendarDrawer from "../StudyCalendar/CalendarDrawer";
import { FlashcardActions } from "./styles";

const fields = z.object({
  title: z.string().trim().min(1, "teacher:flashcards.required").max(flashcardDeckTitleLimit, "teacher:flashcards.deck_title_limit"),
  category: z.string().trim().max(flashcardCategoryLimit, "teacher:flashcard_import.category_limit"),
  set_id: z.uuid().nullable(),
});

type Props = {
  kind: "new-set" | "new-deck" | "edit-deck";
  initial?: Partial<FlashcardDeckFields>;
  sets: readonly FlashcardSet[];
  setsUnavailable?: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: FlashcardDeckFields) => Promise<void>;
};

export default function FlashcardDeckDrawer({ kind, initial, sets, setsUnavailable, busy, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof fields>>({
    resolver: zodResolver(fields),
    defaultValues: { title: initial?.title ?? "", category: initial?.category ?? "", set_id: initial?.set_id ?? null },
  });
  const locked = busy || isSubmitting;
  const creatingSet = kind === "new-set";
  const title = creatingSet ? t("teacher:flashcard_sets.new_set")
    : kind === "edit-deck" ? t("teacher:flashcard_sets.edit_deck") : t("teacher:flashcards.new_deck");
  const saveLabel = creatingSet ? t("teacher:flashcard_sets.create_set")
    : kind === "edit-deck" ? t("teacher:flashcards.save_changes") : t("teacher:flashcards.create_deck");

  return <CalendarDrawer title={title} busy={locked} onClose={onClose}>
    <Stack component="form" noValidate spacing={2} onSubmit={handleSubmit(draft => onSave({
      title: draft.title, category: draft.category || null, ...(!setsUnavailable && { set_id: draft.set_id }),
    }))}>
      <Controller name="title" control={control} render={({ field }) => (
        <TextInput {...field} required disabled={locked} label={creatingSet ? t("teacher:flashcard_sets.set_title") : t("teacher:flashcards.deck_title")}
          error={Boolean(errors.title)} helperText={errors.title?.message && t(errors.title.message, { limit: flashcardDeckTitleLimit })} />
      )} />
      {!creatingSet && <>
        <Controller name="category" control={control} render={({ field }) => (
          <TextInput {...field} disabled={locked} label={t("teacher:flashcard_import.category_optional")}
            error={Boolean(errors.category)} helperText={errors.category?.message && t(errors.category.message, { limit: flashcardCategoryLimit })} />
        )} />
        <Controller name="set_id" control={control} render={({ field }) => (
          <SelectSingleInput label={t("teacher:flashcard_sets.set_optional")} value={field.value} onChange={field.onChange}
            placeholder={t("teacher:flashcard_sets.unassigned")} disabled={locked || setsUnavailable}
            options={sets.map(set => ({ value: set.id, label: set.title }))} />
        )} />
      </>}
      <FlashcardActions sx={{ justifyContent: "flex-end" }}>
        <Button variant="outlined" disabled={locked} onClick={onClose}>{t("core:cancel")}</Button>
        <Button variant="contained" type="submit" disabled={locked}>{saveLabel}</Button>
      </FlashcardActions>
    </Stack>
  </CalendarDrawer>;
}
