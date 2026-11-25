import { useId, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { z } from "zod";
import { Alert, Button, Checkbox, Chip, Stack, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import {
  calendarActivityProgress, calendarMaxActivities, calendarMaxActivityText, calendarMaxMinutes, calendarMaxNotes,
  calendarMaxSourceLabel, calendarMaxSourceUrl, calendarMaxTitle, validSourceUrl,
  type CalendarDay, type DayUpdate,
} from "../../infrastructure/studyCalendar";
import {
  CalendarActions, CalendarActivityCard, CalendarActivityFields,
  CalendarActivitySource, CalendarActivitySummary, CalendarActivityToggle,
} from "./styles";

const activityFields = z.object({
  localKey: z.string(),
  activityId: z.string().optional(),
  text: z.string().trim().min(1, "teacher:calendar.required").max(calendarMaxActivityText, "teacher:calendar.activity_limit"),
  sourceLabel: z.string().trim().max(calendarMaxSourceLabel, "teacher:calendar.source_label_limit"),
  sourceUrl: z.string().trim().max(calendarMaxSourceUrl, "teacher:calendar.source_url_invalid"),
  completed: z.boolean(),
}).superRefine((activity, ctx) => {
  if (!activity.sourceLabel && !activity.sourceUrl) return;
  if (!activity.sourceLabel) ctx.addIssue({ code: "custom", path: ["sourceLabel"], message: "teacher:calendar.required" });
  if (!validSourceUrl(activity.sourceUrl)) ctx.addIssue({ code: "custom", path: ["sourceUrl"], message: "teacher:calendar.source_url_invalid" });
});

const dayFields = z.object({
  title: z.string().trim().max(calendarMaxTitle, "teacher:calendar.day_title_limit"),
  minutes: z.string().trim().refine(value => value === "" || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= calendarMaxMinutes), "teacher:calendar.minutes_invalid"),
  notes: z.string().trim().max(calendarMaxNotes, "teacher:calendar.notes_limit"),
  activities: z.array(activityFields).max(calendarMaxActivities, "teacher:calendar.activities_limit"),
});

type DayFields = z.input<typeof dayFields>;
function activityInput<Field extends keyof DayFields["activities"][number]>(
  index: number, field: Field,
): `activities.${number}.${Field}` {
  return `activities.${index}.${field}`;
}

function valuesFor(day: CalendarDay): DayFields {
  return {
    title: day.title ?? "",
    notes: day.notes ?? "",
    minutes: day.minutes === null ? "" : String(day.minutes),
    activities: day.activities.map(activity => ({
      localKey: activity.id, activityId: activity.id, text: activity.text,
      sourceLabel: activity.source?.label ?? "", sourceUrl: activity.source?.url ?? "",
      completed: activity.completed,
    })),
  };
}

type Props = {
  day: CalendarDay;
  busy: boolean;
  onCancel: () => void;
  onSave: (update: DayUpdate) => Promise<unknown>;
  onReload: () => Promise<CalendarDay | undefined>;
};

export default function CalendarDayEditor({ day, busy, onCancel, onSave, onReload }: Props) {
  const { t } = useTranslation();
  const activitiesTitleId = useId();
  const [revision, setRevision] = useState(day.revision);
  const [editing, setEditing] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const { handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<DayFields>({
    resolver: zodResolver(dayFields), defaultValues: valuesFor(day),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "activities" });
  const activities = useWatch({ control, name: "activities" });
  const progress = calendarActivityProgress(activities);
  const disabled = busy || isSubmitting;

  const save = handleSubmit(async values => {
    try {
      await onSave({
        revision, title: values.title || null, notes: values.notes || null,
        minutes: values.minutes ? Number(values.minutes) : null,
        activities: values.activities.map(activity => ({
          ...(activity.activityId ? { id: activity.activityId } : {}),
          text: activity.text, completed: activity.completed,
          ...(activity.sourceUrl ? { source: { label: activity.sourceLabel, url: activity.sourceUrl } } : {}),
        })),
      });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) setConflict(true);
    }
  }, invalid => {
    const index = invalid.activities?.findIndex?.(error => Boolean(error)) ?? -1;
    if (index >= 0) setEditing(fields[index]?.localKey ?? null);
  });

  return (
    <Stack component="form" noValidate spacing={2} onSubmit={save}>
      <Controller control={control} name="title" render={({ field }) => (
        <TextInput {...field} label={t("teacher:calendar.day_title")} disabled={disabled}
          error={Boolean(errors.title)} helperText={errors.title?.message && t(errors.title.message)} />
      )} />
      <Controller control={control} name="minutes" render={({ field }) => (
        <TextInput {...field} label={t("teacher:calendar.minutes")} disabled={disabled} inputMode="numeric" type="number"
          error={Boolean(errors.minutes)} helperText={errors.minutes?.message && t(errors.minutes.message)} />
      )} />
      <Stack component="section" useFlexGap spacing={1.5} aria-labelledby={activitiesTitleId}>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { xs: "stretch", sm: "center" }, gap: 1, justifyContent: "space-between" }}>
          <Typography component="h3" variant="subtitle2" id={activitiesTitleId}>{t("teacher:calendar.activities")}</Typography>
          <Button variant="outlined" startIcon={<AddOutlined />} disabled={disabled || fields.length >= calendarMaxActivities} sx={{ minHeight: 44 }}
            onClick={() => {
              const localKey = crypto.randomUUID();
              append({ localKey, text: "", sourceLabel: "", sourceUrl: "", completed: false }, { shouldFocus: false });
              setEditing(localKey);
            }}>
            {t("teacher:calendar.add_activity")}
          </Button>
        </Stack>
        <Stack role="status" direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <Chip size="small" color={progress.complete ? "success" : "default"}
            label={t(progress.complete ? "teacher:calendar.day_complete" : "teacher:calendar.day_pending")} />
          <Typography variant="body2" color="text.secondary">
            {t("teacher:calendar.activity_progress", { done: progress.done, count: progress.total })}
          </Typography>
        </Stack>
        {fields.length === 0 ? (
          <Typography variant="body2" color="text.secondary">{t("teacher:calendar.empty_activities")}</Typography>
        ) : (
          <Stack component="ul" role="list" useFlexGap spacing={1} sx={{ listStyle: "none", m: 0, p: 0 }}>
            {fields.map((item, index) => {
              const activity = activities[index];
              if (!activity) return null;
              const expanded = editing === item.localKey;
              const invalid = errors.activities?.[index];
              const checkboxId = `${activitiesTitleId}-${item.id}`;
              return (
                <CalendarActivityCard key={item.id} data-done={activity.completed}>
                  <CalendarActivitySummary>
                    <Controller control={control} name={activityInput(index, "completed")} render={({ field }) => (
                      <CalendarActivityToggle htmlFor={checkboxId}
                        label={activity.text || t("teacher:calendar.new_activity")}
                        control={<Checkbox id={checkboxId} checked={field.value}
                          onChange={(_, checked) => field.onChange(checked)} disabled={disabled} />} />
                    )} />
                    <Button variant="outlined" size="small" aria-expanded={expanded} disabled={disabled}
                      onClick={() => setEditing(expanded ? null : item.localKey)} sx={{ gridArea: "edit", minHeight: 44 }}>
                      {t(expanded ? "teacher:calendar.done" : "teacher:calendar.edit")}
                    </Button>
                    {activity.sourceLabel && validSourceUrl(activity.sourceUrl) && (
                      <CalendarActivitySource variant="body2" href={activity.sourceUrl} target="_blank" rel="noopener noreferrer">
                        <span>{activity.sourceLabel}</span>
                        <OpenInNewOutlined aria-hidden />
                      </CalendarActivitySource>
                    )}
                  </CalendarActivitySummary>
                  {expanded && (
                    <CalendarActivityFields spacing={1.5}>
                      <Controller control={control} name={activityInput(index, "text")} render={({ field }) => (
                        <TextInput {...field} label={t("teacher:calendar.activity")} multiline minRows={2} disabled={disabled} required autoFocus
                          error={Boolean(invalid?.text)} helperText={invalid?.text?.message && t(invalid.text.message)} />
                      )} />
                      <Controller control={control} name={activityInput(index, "sourceLabel")} render={({ field }) => (
                        <TextInput {...field} label={t("teacher:calendar.source_label")} disabled={disabled}
                          error={Boolean(invalid?.sourceLabel)} helperText={invalid?.sourceLabel?.message && t(invalid.sourceLabel.message)} />
                      )} />
                      <Controller control={control} name={activityInput(index, "sourceUrl")} render={({ field }) => (
                        <TextInput {...field} label={t("teacher:calendar.source_url")} disabled={disabled} inputMode="url"
                          error={Boolean(invalid?.sourceUrl)} helperText={invalid?.sourceUrl?.message && t(invalid.sourceUrl.message)} />
                      )} />
                      <Button variant="outlined" color="error" disabled={disabled} sx={{ minHeight: 44, alignSelf: "flex-start" }}
                        onClick={() => { remove(index); setEditing(null); }}>{t("teacher:calendar.remove_activity")}</Button>
                    </CalendarActivityFields>
                  )}
                </CalendarActivityCard>
              );
            })}
          </Stack>
        )}
      </Stack>
      <Controller control={control} name="notes" render={({ field }) => (
        <TextInput {...field} label={t("teacher:calendar.notes")} multiline minRows={2} disabled={disabled}
          error={Boolean(errors.notes)} helperText={errors.notes?.message && t(errors.notes.message)} />
      )} />
      {conflict && <Alert severity="warning" action={
        <Button variant="outlined" color="inherit" disabled={disabled} onClick={() => {
          void onReload().then(latest => {
            if (!latest) return;
            reset(valuesFor(latest));
            setRevision(latest.revision);
            setEditing(null);
            setConflict(false);
          });
        }}>{t("teacher:calendar.reload_saved")}</Button>
      }>{t("teacher:calendar.conflict")}</Alert>}
      <CalendarActions sx={{ justifyContent: "flex-end" }}>
        <Button variant="outlined" onClick={onCancel} disabled={disabled}>{t("teacher:calendar.cancel")}</Button>
        <Button variant="contained" type="submit" disabled={disabled || conflict}>{t("teacher:calendar.save_day")}</Button>
      </CalendarActions>
    </Stack>
  );
}
