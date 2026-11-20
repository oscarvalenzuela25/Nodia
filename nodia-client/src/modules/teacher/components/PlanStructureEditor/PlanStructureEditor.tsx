import { useEffect, useId, useRef, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import AssessmentPolicyEditor from "../AssessmentPolicyEditor";
import PlanSectionFields from "./PlanSectionFields";
import { CompactNavigator, DesktopNavigator, Editor, EditorLayout, FieldGrid, Navigator, SectionOrder, ViewButton, Workspace, WorkspaceHeading } from "./styles";
import type { PlanStructureEditorProps } from "./types";

const planData = "plan";
const evaluation = "evaluation";
const sectionView = (id: string) => "section:" + id;

export default function PlanStructureEditor({ value, busy, onChange, onValidation }: PlanStructureEditorProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const focusPending = useRef(false);
  const [selection, setSelection] = useState(planData);
  const sectionIndex = value.sections.findIndex(section => sectionView(section.id) === selection);
  const selectedSection = value.sections[sectionIndex];
  const view = selectedSection ? selection : selection === evaluation ? evaluation : planData;
  const planLabel = t("teacher:structure_ui.plan_details");
  const evaluationLabel = t("teacher:assessment_policy");
  const sectionItems = value.sections.map((section, index) => ({
    value: sectionView(section.id),
    label: section.title.trim() || t("teacher:review_ui.section_fallback", { number: index + 1 }),
    count: section.units.length,
  }));
  const activeLabel = sectionItems[sectionIndex]?.label ?? (view === evaluation ? evaluationLabel : planLabel);

  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    heading.current?.focus();
  }, [view]);

  const switchView = (next: string | null, focus: boolean) => {
    if (busy || !next || view === next) return;
    focusPending.current = focus;
    setSelection(next);
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
    switchView(sectionView(sectionId), true);
  };

  return <Editor>
    <EditorLayout>
      <Navigator>
        <CompactNavigator>
          <SelectSingleInput label={t("teacher:structure_ui.choose_view")} value={view} clearable={false} disabled={busy}
            options={[{ value: planData, label: planLabel }, ...sectionItems, { value: evaluation, label: evaluationLabel }]}
            onChange={next => switchView(next, false)} />
        </CompactNavigator>
        <DesktopNavigator aria-label={t("teacher:structure_ui.choose_view")}>
          <ViewButton variant="outlined" aria-current={view === planData ? "true" : undefined} disabled={busy}
            onClick={() => switchView(planData, true)}><TuneOutlined fontSize="small" />{planLabel}</ViewButton>
          {sectionItems.length > 0 && <Typography variant="caption" color="text.secondary" sx={{ px: 1.25, mt: .5, fontWeight: 700 }}>
            {t("teacher:structure_ui.sections")}
          </Typography>}
          {sectionItems.map((item, index) => <ViewButton key={item.value} variant="outlined" aria-current={view === item.value ? "true" : undefined}
            disabled={busy} onClick={() => switchView(item.value, true)}>
            <SectionOrder aria-hidden>{index + 1}</SectionOrder>
            <Box component="span" sx={{ minWidth: 0 }}>
              <Typography component="span" variant="body2" sx={{ display: "block", fontWeight: 600, overflowWrap: "anywhere" }}>{item.label}</Typography>
              <Typography component="span" variant="caption" color="text.secondary">{t("teacher:review_ui.section_units", { count: item.count })}</Typography>
            </Box>
          </ViewButton>)}
          <ViewButton variant="outlined" aria-current={view === evaluation ? "true" : undefined} disabled={busy}
            onClick={() => switchView(evaluation, true)}><FactCheckOutlined fontSize="small" />{evaluationLabel}</ViewButton>
        </DesktopNavigator>
        <Button variant="outlined" startIcon={<AddOutlined />} disabled={busy || value.sections.length >= 24}
          sx={{ minHeight: 44 }} onClick={addSection}>{t("teacher:add_section")}</Button>
      </Navigator>

      <Workspace aria-labelledby={headingId}>
        <Stack sx={{ gap: 2.5 }}>
          <WorkspaceHeading ref={heading} id={headingId} tabIndex={-1}>{activeLabel}</WorkspaceHeading>
          <Box hidden={view !== planData}>
            <Stack sx={{ gap: 2.5, maxWidth: "56ch" }}>
              <TextInput label={t("teacher:fields.title")} value={value.title} disabled={busy}
                onChange={event => onChange(current => ({ ...current, title: event.target.value }))} />
              <TextInput label={t("teacher:fields.objective")} value={value.objective} disabled={busy} multiline minRows={2}
                onChange={event => onChange(current => ({ ...current, objective: event.target.value }))} />
              <FieldGrid>
                <SelectSingleInput label={t("teacher:fields.organization")} value={value.organization}
                  options={["days", "topics"].map(organization => ({ value: organization, label: t("teacher:organization." + organization) }))}
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
              </FieldGrid>
            </Stack>
          </Box>
          {selectedSection && <PlanSectionFields key={selectedSection.id} outline={value} section={selectedSection} index={sectionIndex}
            busy={busy} onChange={onChange} onExclude={() => {
              const neighbor = value.sections[sectionIndex + 1] ?? value.sections[sectionIndex - 1];
              switchView(neighbor ? sectionView(neighbor.id) : planData, true);
              onChange(current => ({ ...current, sections: current.sections.filter(section => section.id !== selectedSection.id) }));
            }} />}
          <Box hidden={view !== evaluation}>
            <AssessmentPolicyEditor value={value.assessment_policy} maximumSectionObjectives={Math.max(0, ...value.sections.map(section => section.objectives.length))}
              busy={busy} onValidation={onValidation} onChange={assessment_policy => onChange(current => ({ ...current, assessment_policy }))} />
          </Box>
        </Stack>
      </Workspace>
    </EditorLayout>
  </Editor>;
}
