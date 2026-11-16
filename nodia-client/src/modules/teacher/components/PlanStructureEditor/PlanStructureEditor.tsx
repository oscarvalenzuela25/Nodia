import { useId, useState } from "react";
import { AccordionDetails, AccordionSummary, Button, FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import type { Outline } from "../../infrastructure/schemas";
import AssessmentPolicyEditor from "../AssessmentPolicyEditor";
import { Editor, EditorActions, Section, SectionFields, UnitFields } from "./styles";
import type { PlanStructureEditorProps } from "./types";

type SectionValue = Outline["sections"][number];

export default function PlanStructureEditor({ value, busy, onChange, onValidation }: PlanStructureEditorProps) {
  const { t } = useTranslation();
  const prefix = useId();
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const updateSection = (id: string, update: (section: SectionValue) => SectionValue) => {
    onChange(current => ({ ...current, sections: current.sections.map(section => section.id === id ? update(section) : section) }));
  };
  const moveSection = (id: string, delta: number) => {
    onChange(current => {
      const index = current.sections.findIndex(section => section.id === id);
      const other = index + delta;
      if (index < 0 || other < 0 || other >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[other]] = [sections[other], sections[index]];
      return { ...current, sections };
    });
  };
  const addSection = () => {
    const sectionId = crypto.randomUUID();
    const objectiveId = crypto.randomUUID();
    const unitId = crypto.randomUUID();
    onChange(current => ({ ...current, sections: [...current.sections, {
      id: sectionId, title: "", required: true, prerequisite_section_ids: [],
      objectives: [{ id: objectiveId, description: "" }],
      units: [{ id: unitId, title: "", objective_ids: [objectiveId], day_start: null, day_end: null }],
    }] }));
    setExpandedSectionId(sectionId);
  };
  const unitCount = value.sections.reduce((sum, section) => sum + section.units.length, 0);

  return <Editor>
    <Stack sx={{ gap: 2 }}>
      <TextInput label={t("teacher:fields.title")} value={value.title} disabled={busy}
        onChange={event => onChange(current => ({ ...current, title: event.target.value }))} />
      <TextInput label={t("teacher:fields.objective")} value={value.objective} disabled={busy} multiline minRows={2}
        onChange={event => onChange(current => ({ ...current, objective: event.target.value }))} />
      <SelectSingleInput label={t("teacher:fields.organization")} value={value.organization}
        options={["days", "topics"].map(organization => ({ value: organization, label: t(`teacher:organization.${organization}`) }))}
        disabled={busy} clearable={false} onChange={organization => {
          if (organization !== "days" && organization !== "topics") return;
          onChange(current => ({ ...current, organization,
            day_count: organization === "topics" ? null : current.day_count,
            sections: organization === "topics" ? current.sections.map(section => ({ ...section,
              units: section.units.map(unit => ({ ...unit, day_start: null, day_end: null })),
            })) : current.sections,
          }));
        }} />
      {value.organization === "days" && <TextInput label={t("teacher:fields.day_count")} value={value.day_count === null ? "" : String(value.day_count)}
        type="number" inputMode="numeric" disabled={busy}
        onChange={event => onChange(current => ({ ...current, day_count: event.target.value === "" ? null : Number(event.target.value) }))} />}
    </Stack>

    <Stack sx={{ gap: 2 }}>
      {value.sections.map((section, index) => <Section key={section.id} disableGutters elevation={0}
        expanded={expandedSectionId === section.id} disabled={busy}
        onChange={(_, expanded) => setExpandedSectionId(expanded ? section.id : null)}>
        <AccordionSummary id={`${prefix}-${section.id}-summary`} aria-controls={`${prefix}-${section.id}-content`} expandIcon={<ExpandMoreOutlined />}>
          <Stack sx={{ gap: .5, minWidth: 0, overflowWrap: "anywhere" }}>
            <Typography component="span" sx={{ fontWeight: 600 }}>{section.title || t("teacher:review_ui.section_fallback", { number: index + 1 })}</Typography>
            <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap" }}>
              <Typography component="span" variant="body2" color="text.secondary">{t("teacher:review_ui.section_units", { count: section.units.length })}</Typography>
              <Typography component="span" variant="body2" color="text.secondary">{t("teacher:review_ui.section_objectives", { count: section.objectives.length })}</Typography>
            </Stack>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <SectionFields>
            <TextInput label={t("teacher:section_title", { number: index + 1 })} value={section.title} disabled={busy}
              onChange={event => updateSection(section.id, current => ({ ...current, title: event.target.value }))} />
            <FormControlLabel label={t("teacher:required_section")} sx={{ minHeight: 44 }}
              control={<Switch disabled={busy} checked={section.required} onChange={(_, required) => updateSection(section.id, current => ({ ...current, required }))} />} />
            <SelectMultipleInput label={t("teacher:prerequisites")} value={section.prerequisite_section_ids}
              options={value.sections.filter(item => item.id !== section.id).map(item => ({ value: item.id, label: item.title }))}
              disabled={busy} onChange={prerequisite_section_ids => updateSection(section.id, current => ({ ...current, prerequisite_section_ids }))} />
            {section.objectives.map((objective, objectiveIndex) => <TextInput key={objective.id}
              label={t("teacher:objective_number", { number: objectiveIndex + 1 })} value={objective.description} disabled={busy} multiline
              onChange={event => updateSection(section.id, current => ({ ...current,
                objectives: current.objectives.map(item => item.id === objective.id ? { ...item, description: event.target.value } : item),
              }))} />)}
            {section.units.map((unit, unitIndex) => <UnitFields key={unit.id}>
              <TextInput label={t("teacher:unit_title", { number: unitIndex + 1 })} value={unit.title} disabled={busy}
                onChange={event => updateSection(section.id, current => ({ ...current,
                  units: current.units.map(item => item.id === unit.id ? { ...item, title: event.target.value } : item),
                }))} />
              <SelectMultipleInput label={t("teacher:unit_objectives")} value={unit.objective_ids}
                options={section.objectives.map(item => ({ value: item.id, label: item.description }))} disabled={busy}
                onChange={objective_ids => updateSection(section.id, current => ({ ...current,
                  units: current.units.map(item => item.id === unit.id ? { ...item, objective_ids } : item),
                }))} />
              {value.organization === "days" && <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2 }}>
                {(["day_start", "day_end"] as const).map(field => <TextInput key={field} label={t(`teacher:fields.${field}`)}
                  value={unit[field] === null ? "" : String(unit[field])} type="number" inputMode="numeric" disabled={busy}
                  onChange={event => updateSection(section.id, current => ({ ...current,
                    units: current.units.map(item => item.id === unit.id ? { ...item, [field]: event.target.value === "" ? null : Number(event.target.value) } : item),
                  }))} />)}
              </Stack>}
              <EditorActions>
                <Button variant="outlined" disabled={busy || unitIndex === 0} onClick={() => updateSection(section.id, current => {
                  const units = [...current.units];
                  const position = units.findIndex(item => item.id === unit.id);
                  if (position <= 0) return current;
                  [units[position], units[position - 1]] = [units[position - 1], units[position]];
                  return { ...current, units };
                })}>{t("teacher:move_unit_up")}</Button>
                <Button variant="outlined" color="error" disabled={busy || section.units.length === 1}
                  onClick={() => updateSection(section.id, current => ({ ...current, units: current.units.filter(item => item.id !== unit.id) }))}>{t("teacher:exclude_unit")}</Button>
              </EditorActions>
            </UnitFields>)}
            <EditorActions>
              <Button variant="outlined" disabled={busy || section.objectives.length >= 12} onClick={() => {
                const id = crypto.randomUUID();
                updateSection(section.id, current => ({ ...current, objectives: [...current.objectives, { id, description: "" }],
                  units: current.units.map((unit, i) => i === 0 ? { ...unit, objective_ids: [...unit.objective_ids, id] } : unit),
                }));
              }}>{t("teacher:add_objective")}</Button>
              <Button variant="outlined" disabled={busy || unitCount >= 60} onClick={() => {
                const id = crypto.randomUUID();
                updateSection(section.id, current => ({ ...current, units: [...current.units, {
                  id, title: "", objective_ids: current.objectives.map(item => item.id), day_start: null, day_end: null,
                }] }));
              }}>{t("teacher:add_unit")}</Button>
            </EditorActions>
            <EditorActions>
              <Button variant="outlined" disabled={busy || index === 0} onClick={() => moveSection(section.id, -1)}>{t("teacher:move_up")}</Button>
              <Button variant="outlined" disabled={busy || index === value.sections.length - 1} onClick={() => moveSection(section.id, 1)}>{t("teacher:move_down")}</Button>
              <Button variant="outlined" color="error" disabled={busy || value.sections.length === 1}
                onClick={() => onChange(current => ({ ...current, sections: current.sections.filter(item => item.id !== section.id) }))}>{t("teacher:exclude_section")}</Button>
            </EditorActions>
          </SectionFields>
        </AccordionDetails>
      </Section>)}
    </Stack>
    <EditorActions><Button variant="outlined" disabled={busy || value.sections.length >= 24} onClick={addSection}>{t("teacher:add_section")}</Button></EditorActions>
    <AssessmentPolicyEditor value={value.assessment_policy} maximumSectionObjectives={Math.max(0, ...value.sections.map(section => section.objectives.length))}
      busy={busy} onValidation={onValidation} onChange={assessment_policy => onChange(current => ({ ...current, assessment_policy }))} />
  </Editor>;
}
