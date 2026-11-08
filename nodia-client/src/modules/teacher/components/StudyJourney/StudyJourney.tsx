import { useId, useState } from "react";
import { AccordionDetails, AccordionSummary, Alert, Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import QuizOutlined from "@mui/icons-material/QuizOutlined";
import { useTranslation } from "react-i18next";
import { enabled } from "../../infrastructure/presentation";
import type { Outline, Session } from "../../infrastructure/schemas";
import { FinalButton, JourneyAccordion, Objectives, SectionAccordion, SectionNumber, SectionSummary, UnitButton, UnitOrdinal } from "./styles";

type Props = {
  outline: Outline;
  sectionStates: Session["section_states"];
  selectedUnitId: string | null;
  busy: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSelectUnit: (sectionId: string, unitId: string) => void;
  onStartFinal: (sectionId: string) => void;
};

export default function StudyJourney({ outline, sectionStates, selectedUnitId, busy, expanded, onExpandedChange, onSelectUnit, onStartFinal }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const selectedSectionId = outline.sections.find(section => section.units.some(unit => unit.id === selectedUnitId))?.id ?? outline.sections[0]?.id ?? null;
  const [navigation, setNavigation] = useState<{ selectedUnitId: string | null; openSectionId: string | null }>({ selectedUnitId, openSectionId: selectedSectionId });
  // Follow an externally chosen unit without overriding manual expansion in the same context.
  let openSectionId = navigation.openSectionId;
  if (navigation.selectedUnitId !== selectedUnitId) {
    openSectionId = selectedSectionId;
    setNavigation({ selectedUnitId, openSectionId: selectedSectionId });
  }

  return <JourneyAccordion expanded={desktop || expanded} onChange={(_, value) => onExpandedChange(value)} disableGutters elevation={0} slots={{ heading: "h2" }}>
    <AccordionSummary expandIcon={<ExpandMoreOutlined sx={{ display: { md: "none" } }} />} tabIndex={desktop ? -1 : 0} aria-controls={`${id}-outline`} id={`${id}-heading`} sx={{ px: 0, minHeight: 44, "& .MuiAccordionSummary-content": { my: 0 } }}>
      <Typography variant="h6" component="span" sx={{ fontSize: 22, fontWeight: 700 }}>{t("teacher:your_route")}</Typography>
    </AccordionSummary>
    <AccordionDetails id={`${id}-outline`} sx={{ px: 0, pb: 0, pt: 2 }}>
      <Stack sx={{ gap: 2 }}>
        {!outline.sections.length && <Typography color="text.secondary">{t("core:empty_state_description")}</Typography>}
        {outline.sections.map((section, sectionIndex) => {
          const canStartFinal = !busy && enabled(sectionStates.find(item => item.section_id === section.id)?.allowed_actions ?? {}, "start_final");
          return <SectionAccordion key={section.id} expanded={openSectionId === section.id} onChange={(_, value) => setNavigation({ selectedUnitId, openSectionId: value ? section.id : null })} disableGutters elevation={0}>
            <SectionSummary expandIcon={<ExpandMoreOutlined />} aria-controls={`${id}-section-${sectionIndex}`} id={`${id}-section-heading-${sectionIndex}`}>
              <SectionNumber aria-hidden="true">{sectionIndex + 1}</SectionNumber>
              <Typography component="span" variant="body2" sx={{ fontWeight: 700, lineHeight: 1.5 }}>{section.title}</Typography>
            </SectionSummary>
            <AccordionDetails id={`${id}-section-${sectionIndex}`} sx={{ pt: 0, px: 1.5, pb: 1.5 }}>
              <Stack sx={{ gap: 1 }}>
                {section.objectives.length > 0 && <Objectives>
                  <summary>{t("teacher:journey_objectives")}</summary>
                  <Box component="ul" sx={{ m: 0, pl: 3.5, pr: 1.5, pb: 1.5, "& li + li": { mt: 1 } }}>
                    {section.objectives.map(objective => <li key={objective.id}><Typography variant="body2" color="text.secondary">{objective.description}</Typography></li>)}
                  </Box>
                </Objectives>}
                {section.units.map((unit, unitIndex) => <UnitButton key={unit.id} variant={selectedUnitId === unit.id ? "contained" : "outlined"} aria-current={selectedUnitId === unit.id ? "step" : undefined} startIcon={<MenuBookOutlined fontSize="small" />} disabled={busy} onClick={() => { if (!busy) onSelectUnit(section.id, unit.id); }}>
                  <UnitOrdinal aria-hidden="true">{sectionIndex + 1}.{unitIndex + 1}</UnitOrdinal>
                  <Box component="span" sx={{ minWidth: 0 }}>{unit.title}</Box>
                </UnitButton>)}
                <FinalButton variant="outlined" startIcon={<QuizOutlined fontSize="small" />} disabled={!canStartFinal} onClick={() => { if (canStartFinal) onStartFinal(section.id); }}>{t("teacher:direct_final")}</FinalButton>
              </Stack>
            </AccordionDetails>
          </SectionAccordion>;
        })}
        <Alert severity="info" sx={{ "& .MuiAlert-message": { minWidth: 0 } }}>{t("teacher:final_policy")}</Alert>
      </Stack>
    </AccordionDetails>
  </JourneyAccordion>;
}
