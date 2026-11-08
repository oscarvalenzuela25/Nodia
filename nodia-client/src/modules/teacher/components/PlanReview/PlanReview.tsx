import { useState } from "react";
import { Alert, Button, Chip, FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import type { Plan, Outline } from "../../infrastructure/schemas";
import { outlineSchema } from "../../infrastructure/schemas";
import { Actions } from "../../pages/Teacher/styles";
import { SectionEditor } from "./styles";
import AssessmentPolicyEditor from "../AssessmentPolicyEditor";

type Props = { plan: Plan; busy: boolean; canAccept: boolean; futureRevision?: boolean; onSave: (outline: Outline) => Promise<void>; onAccept: () => Promise<void>; onAdjust: (text: string) => Promise<void> };
export default function PlanReview({ plan, busy, canAccept, futureRevision = false, onSave, onAccept, onAdjust }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => structuredClone(plan.outline));
  const [adjustment, setAdjustment] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [policyValid, setPolicyValid] = useState(true);
  const changed = JSON.stringify(draft) !== JSON.stringify(plan.outline);
  const updateSection = (index: number, patch: Partial<Outline["sections"][number]>) => setDraft(current => ({ ...current, sections: current.sections.map((section, i) => i === index ? { ...section, ...patch } : section) }));
  const moveSection = (index: number, delta: number) => setDraft(current => { const sections = [...current.sections]; const other = index + delta; if (other < 0 || other >= sections.length) return current; [sections[index], sections[other]] = [sections[other], sections[index]]; return { ...current, sections }; });
  const addSection = () => {
    const objectiveId = crypto.randomUUID();
    setDraft(current => ({ ...current, sections: [...current.sections, { id: crypto.randomUUID(), title: "", required: true, prerequisite_section_ids: [], objectives: [{ id: objectiveId, description: "" }], units: [{ id: crypto.randomUUID(), title: "", objective_ids: [objectiveId], day_start: null, day_end: null }] }] }));
  };
  const save = async () => {
    const result = outlineSchema.safeParse(draft);
    setInvalid(!result.success);
    if (result.success && policyValid) await onSave(result.data);
  };
  return <Stack sx={{ gap: 2 }}>
    <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}><Typography variant="h5" sx={{ fontSize: 22, fontWeight: 700 }}>{t("teacher:review_plan")}</Typography><Chip label={t("teacher:revision", { revision: plan.revision_no })} size="small" /></Stack>
    <Typography color="text.secondary">{t("teacher:review_description")}</Typography>
    {invalid && <Alert severity="error">{t("teacher:invalid_plan")}</Alert>}
    <TextInput label={t("teacher:fields.title")} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} disabled={busy} />
    <TextInput label={t("teacher:fields.objective")} value={draft.objective} onChange={event => setDraft({ ...draft, objective: event.target.value })} disabled={busy} multiline minRows={2} />
    <SelectSingleInput label={t("teacher:fields.organization")} value={draft.organization} options={["days", "topics"].map(value => ({ value, label: t(`teacher:organization.${value}`) }))} onChange={value => { if (value === "days" || value === "topics") setDraft({ ...draft, organization: value, day_count: value === "topics" ? null : draft.day_count, sections: value === "topics" ? draft.sections.map(section => ({ ...section, units: section.units.map(unit => ({ ...unit, day_start: null, day_end: null })) })) : draft.sections }); }} disabled={busy} clearable={false} />
    {draft.organization === "days" && <TextInput label={t("teacher:fields.day_count")} value={draft.day_count === null ? "" : String(draft.day_count)} type="number" inputMode="numeric" onChange={event => setDraft({ ...draft, day_count: event.target.value === "" ? null : Number(event.target.value) })} disabled={busy} />}
    {draft.sections.map((section, index) => <SectionEditor key={section.id}>
      <TextInput label={t("teacher:section_title", { number: index + 1 })} value={section.title} onChange={event => updateSection(index, { title: event.target.value })} disabled={busy} />
      <FormControlLabel label={t("teacher:required_section")} control={<Switch disabled={busy} checked={section.required} onChange={(_, required) => updateSection(index, { required })} />} />
      <SelectMultipleInput label={t("teacher:prerequisites")} value={section.prerequisite_section_ids} options={draft.sections.filter(item => item.id !== section.id).map(item => ({ value: item.id, label: item.title }))} onChange={prerequisite_section_ids => updateSection(index, { prerequisite_section_ids })} disabled={busy} />
      {section.objectives.map((objective, objectiveIndex) => <TextInput key={objective.id} label={t("teacher:objective_number", { number: objectiveIndex + 1 })} value={objective.description} onChange={event => updateSection(index, { objectives: section.objectives.map(item => item.id === objective.id ? { ...item, description: event.target.value } : item) })} disabled={busy} multiline />)}
      {section.units.map((unit, unitIndex) => <Stack key={unit.id} sx={{ gap: 1 }}>
        <TextInput label={t("teacher:unit_title", { number: unitIndex + 1 })} value={unit.title} onChange={event => updateSection(index, { units: section.units.map(item => item.id === unit.id ? { ...item, title: event.target.value } : item) })} disabled={busy} />
        <SelectMultipleInput label={t("teacher:unit_objectives")} value={unit.objective_ids} options={section.objectives.map(item => ({ value: item.id, label: item.description }))} onChange={objective_ids => updateSection(index, { units: section.units.map(item => item.id === unit.id ? { ...item, objective_ids } : item) })} disabled={busy} />
        <Actions><Button variant="contained" disabled={busy || unitIndex === 0} onClick={() => { const units = [...section.units]; [units[unitIndex], units[unitIndex - 1]] = [units[unitIndex - 1], units[unitIndex]]; updateSection(index, { units }); }}>{t("teacher:move_unit_up")}</Button><Button variant="contained" disabled={busy || section.units.length === 1} onClick={() => updateSection(index, { units: section.units.filter(item => item.id !== unit.id) })}>{t("teacher:exclude_unit")}</Button></Actions>
        {draft.organization === "days" && <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2 }}>
          {(["day_start", "day_end"] as const).map(field => <TextInput key={field} label={t(`teacher:fields.${field}`)} value={unit[field] === null ? "" : String(unit[field])} type="number" inputMode="numeric" onChange={event => updateSection(index, { units: section.units.map(item => item.id === unit.id ? { ...item, [field]: event.target.value === "" ? null : Number(event.target.value) } : item) })} disabled={busy} />)}
        </Stack>}
      </Stack>)}
      <Actions><Button variant="contained" disabled={busy || section.objectives.length >= 12} onClick={() => { const id = crypto.randomUUID(); updateSection(index, { objectives: [...section.objectives, { id, description: "" }], units: section.units.map((unit, i) => i === 0 ? { ...unit, objective_ids: [...unit.objective_ids, id] } : unit) }); }}>{t("teacher:add_objective")}</Button><Button variant="contained" disabled={busy || draft.sections.reduce((sum, item) => sum + item.units.length, 0) >= 60} onClick={() => updateSection(index, { units: [...section.units, { id: crypto.randomUUID(), title: "", objective_ids: section.objectives.map(item => item.id), day_start: null, day_end: null }] })}>{t("teacher:add_unit")}</Button></Actions>
      <Actions><Button variant="contained" disabled={busy || index === 0} onClick={() => moveSection(index, -1)}>{t("teacher:move_up")}</Button><Button variant="contained" disabled={busy || index === draft.sections.length - 1} onClick={() => moveSection(index, 1)}>{t("teacher:move_down")}</Button><Button variant="contained" color="error" disabled={busy || draft.sections.length === 1} onClick={() => setDraft(current => ({ ...current, sections: current.sections.filter(item => item.id !== section.id) }))}>{t("teacher:exclude_section")}</Button></Actions>
    </SectionEditor>)}
    <Button variant="contained" disabled={busy || draft.sections.length >= 24} onClick={addSection}>{t("teacher:add_section")}</Button>
    <Alert severity="info">{t("teacher:final_policy")}</Alert>
    <AssessmentPolicyEditor value={draft.assessment_policy} maximumSectionObjectives={Math.max(0, ...draft.sections.map(section => section.objectives.length))} busy={busy} onValidation={setPolicyValid} onChange={assessment_policy => setDraft(current => ({ ...current, assessment_policy }))} />
    {changed && <Alert severity="warning">{t("teacher:unsaved_plan")}</Alert>}
    <Actions><Button variant="contained" disabled={busy || !changed || !policyValid} onClick={() => void save()}>{t("teacher:save_changes")}</Button><Button variant="contained" disabled={busy || changed || !canAccept || !policyValid} onClick={() => void onAccept()}>{t(futureRevision ? "teacher:activate_revision" : "teacher:create_plan")}</Button></Actions>
    <SectionEditor>
      <TextInput label={t("teacher:adjustment")} value={adjustment} onChange={event => setAdjustment(event.target.value)} multiline minRows={2} disabled={busy} />
      <Button variant="contained" disabled={busy || changed || !adjustment.trim()} onClick={() => void onAdjust(adjustment)}>{t("teacher:ask_adjustment")}</Button>
    </SectionEditor>
  </Stack>;
}
