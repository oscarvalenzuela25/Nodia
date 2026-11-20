import { useRef } from "react";
import { Box, Button, FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import type { Outline } from "../../infrastructure/schemas";
import { Actions, DetailFields, Details, FieldGrid } from "./styles";
import type { PlanStructureEditorProps } from "./types";

type Section = Outline["sections"][number];
type Unit = Section["units"][number];
type Props = Pick<PlanStructureEditorProps, "busy" | "onChange"> & {
  outline: Outline;
  section: Section;
  index: number;
  onExclude: () => void;
};

export default function PlanSectionFields({ outline, section, index, busy, onChange, onExclude }: Props) {
  const { t } = useTranslation();
  const newUnit = useRef<string | null>(null);
  const unitCount = outline.sections.reduce((count, item) => count + item.units.length, 0);
  const update = (edit: (value: Section) => Section) => onChange(current => ({
    ...current,
    sections: current.sections.map(item => item.id === section.id ? edit(item) : item),
  }));
  const updateUnit = (id: string, patch: Partial<Unit>) => update(current => ({
    ...current, units: current.units.map(unit => unit.id === id ? { ...unit, ...patch } : unit),
  }));
  const moveSection = (delta: number) => onChange(current => {
    const index = current.sections.findIndex(item => item.id === section.id);
    const destination = index + delta;
    if (index < 0 || destination < 0 || destination >= current.sections.length) return current;
    const sections = [...current.sections];
    [sections[index], sections[destination]] = [sections[destination], sections[index]];
    return { ...current, sections };
  });
  const addUnit = () => {
    const id = crypto.randomUUID();
    newUnit.current = id;
    update(current => ({ ...current, units: [...current.units, {
      id, title: "", objective_ids: current.objectives.map(item => item.id), day_start: null, day_end: null,
    }] }));
  };
  const addObjective = () => {
    const id = crypto.randomUUID();
    update(current => ({
      ...current,
      objectives: [...current.objectives, { id, description: "" }],
      units: current.units.map((unit, i) => i === 0 ? { ...unit, objective_ids: [...unit.objective_ids, id] } : unit),
    }));
  };

  return <Stack sx={{ gap: 2.5 }}>
    <TextInput label={t("teacher:section_title", { number: index + 1 })} value={section.title} disabled={busy}
      onChange={event => update(current => ({ ...current, title: event.target.value }))} />

    <Stack sx={{ gap: 1.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap",
        "& > button": { minHeight: 44, width: { xs: "100%", sm: "auto" } } }}>
        <Typography component="h5" variant="subtitle1" sx={{ fontWeight: 700 }}>{t("teacher:review_ui.section_content")}</Typography>
        <Button variant="outlined" startIcon={<AddOutlined />} disabled={busy || unitCount >= 60} onClick={addUnit}>
          {t("teacher:add_unit")}
        </Button>
      </Box>
      {!section.units.length && <Typography variant="body2" color="text.secondary">{t("teacher:structure_ui.empty_units")}</Typography>}
      {section.units.map((unit, unitIndex) => <Details key={unit.id} ref={details => {
        if (!details || newUnit.current !== unit.id) return;
        newUnit.current = null;
        details.open = true;
        details.querySelector("input")?.focus();
      }}>
        <summary aria-disabled={busy || undefined} onClick={busy ? event => event.preventDefault() : undefined}>
          <Typography component="span" variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
            {unit.title.trim() || t("teacher:unit_title", { number: unitIndex + 1 })}
          </Typography>
          <ExpandMoreOutlined fontSize="small" color="action" />
        </summary>
        <DetailFields>
          <TextInput label={t("teacher:unit_title", { number: unitIndex + 1 })} value={unit.title} disabled={busy}
            onChange={event => updateUnit(unit.id, { title: event.target.value })} />
          <SelectMultipleInput label={t("teacher:unit_objectives")} value={unit.objective_ids}
            options={section.objectives.map(item => ({ value: item.id, label: item.description }))} disabled={busy}
            onChange={objective_ids => updateUnit(unit.id, { objective_ids })} />
          {outline.organization === "days" && <FieldGrid>
            {(["day_start", "day_end"] as const).map(field => <TextInput key={field} label={t("teacher:fields." + field)}
              value={unit[field] === null ? "" : String(unit[field])} type="number" inputMode="numeric" disabled={busy}
              onChange={event => updateUnit(unit.id, { [field]: event.target.value === "" ? null : Number(event.target.value) })} />)}
          </FieldGrid>}
          <Actions>
            <Button variant="outlined" disabled={busy || unitIndex === 0} onClick={() => update(current => {
              const position = current.units.findIndex(item => item.id === unit.id);
              if (position <= 0) return current;
              const units = [...current.units];
              [units[position], units[position - 1]] = [units[position - 1], units[position]];
              return { ...current, units };
            })}>{t("teacher:move_unit_up")}</Button>
            <Button variant="outlined" color="error" disabled={busy || section.units.length === 1}
              onClick={() => update(current => ({ ...current, units: current.units.filter(item => item.id !== unit.id) }))}>
              {t("teacher:exclude_unit")}
            </Button>
          </Actions>
        </DetailFields>
      </Details>)}
    </Stack>

    <Details>
      <summary aria-disabled={busy || undefined} onClick={busy ? event => event.preventDefault() : undefined}>
        <Typography component="span" variant="subtitle2">{t("teacher:review_ui.learning_outcomes")}</Typography>
        <Typography component="span" variant="caption" color="text.secondary">
          {t("teacher:review_ui.section_objectives", { count: section.objectives.length })}
        </Typography>
        <ExpandMoreOutlined fontSize="small" color="action" />
      </summary>
      <DetailFields>
        {section.objectives.map((objective, objectiveIndex) => <TextInput key={objective.id}
          label={t("teacher:objective_number", { number: objectiveIndex + 1 })} value={objective.description} disabled={busy} multiline
          onChange={event => update(current => ({ ...current, objectives: current.objectives.map(item =>
            item.id === objective.id ? { ...item, description: event.target.value } : item,
          ) }))} />)}
        <Actions><Button variant="outlined" startIcon={<AddOutlined />} disabled={busy || section.objectives.length >= 12}
          onClick={addObjective}>{t("teacher:add_objective")}</Button></Actions>
      </DetailFields>
    </Details>

    <Details>
      <summary aria-disabled={busy || undefined} onClick={busy ? event => event.preventDefault() : undefined}>
        <Typography component="span" variant="subtitle2">{t("teacher:structure_ui.section_settings")}</Typography>
        <ExpandMoreOutlined fontSize="small" color="action" />
      </summary>
      <DetailFields>
        <FormControlLabel label={t("teacher:required_section")} sx={{ minHeight: 44 }}
          control={<Switch disabled={busy} checked={section.required}
            onChange={(_, required) => update(current => ({ ...current, required }))} />} />
        <SelectMultipleInput label={t("teacher:prerequisites")} value={section.prerequisite_section_ids}
          options={outline.sections.filter(item => item.id !== section.id).map(item => ({ value: item.id, label: item.title }))}
          disabled={busy} onChange={prerequisite_section_ids => update(current => ({ ...current, prerequisite_section_ids }))} />
        <Actions>
          <Button variant="outlined" disabled={busy || index === 0} onClick={() => moveSection(-1)}>{t("teacher:move_up")}</Button>
          <Button variant="outlined" disabled={busy || index === outline.sections.length - 1}
            onClick={() => moveSection(1)}>{t("teacher:move_down")}</Button>
          <Button variant="outlined" color="error" disabled={busy || outline.sections.length === 1}
            onClick={onExclude}>{t("teacher:exclude_section")}</Button>
        </Actions>
      </DetailFields>
    </Details>
  </Stack>;
}
