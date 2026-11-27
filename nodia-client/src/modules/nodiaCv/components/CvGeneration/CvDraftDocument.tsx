import { Fragment } from "react";
import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { CvRequirement } from "../../infrastructure/generationSchema";
import type { CvGenerationView } from "../../infrastructure/useCvGenerationWorkflow";
import { cvLineFactIds, type CvPreviewPresentation } from "./previewPresentation";
import { cvEvidenceHighlight } from "./styles";

type Props = {
  view: CvGenerationView;
  presentation: CvPreviewPresentation;
  activeRequirement: CvRequirement | null;
};

export default function CvDraftDocument({ view, presentation, activeRequirement }: Props) {
  const { receipt, profile } = view;
  const { t } = useTranslation("nodiaCv", { lng: receipt.language });
  const highlightedFacts = new Set(activeRequirement?.evidenceIds);
  const highlightedRequirementId = activeRequirement?.id;
  const factHighlight = (ids: readonly string[]) => ids.some((id) => highlightedFacts.has(id)) || undefined;
  const requirementHighlight = (ids: readonly string[]) =>
    (highlightedRequirementId !== undefined && ids.includes(highlightedRequirementId)) || undefined;
  const contact = [
    profile.contact.location,
    profile.contact.email,
    profile.contact.phone,
    profile.contact.linkedin_url,
    profile.contact.github_url,
    profile.contact.portfolio_url,
  ].filter(Boolean);
  const showTechnologies = presentation.technologies.length > 0;
  return (
    <Stack
      component={Paper}
      role="article"
      lang={receipt.language}
      variant="outlined"
      spacing={2.25}
      sx={{
        p: { xs: 2, sm: 3 },
        minWidth: 0,
        overflowWrap: "anywhere",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Box component="header">
        <Typography component="h3" variant="h5" sx={{ fontWeight: 750, lineHeight: 1.2 }}>
          {profile.full_name}
        </Typography>
        {profile.professional_title && (
          <Typography data-cv-evidence-highlighted={factHighlight(presentation.titleFactIds)}
            sx={[{ mt: 0.5, fontWeight: 600 }, cvEvidenceHighlight]}>
            {profile.professional_title}
          </Typography>
        )}
        {contact.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {contact.join(" · ")}
          </Typography>
        )}
      </Box>
      <Divider />
      {presentation.bySection.map(({ section, groups }, index) => (
        <Fragment key={section}>
          {section === "skills" && showTechnologies && (
            <Stack component="section" spacing={1}>
              <Typography component="h4" variant="subtitle2" sx={{ fontWeight: 750 }}>
                {t("analysis_technologies")}
              </Typography>
              <Stack component="ul" sx={{ flexDirection: "row", flexWrap: "wrap", gap: 1, listStyle: "none", m: 0, p: 0 }}>
                {presentation.technologies.map(({ name, requirementIds }) => (
                  <Chip key={name} component="li" label={name} size="small" variant="outlined"
                    data-cv-evidence-highlighted={requirementHighlight(requirementIds)}
                    sx={[{
                      maxWidth: "100%", height: "auto", minHeight: 24,
                      "& .MuiChip-label": { whiteSpace: "normal", overflowWrap: "anywhere", py: 0.25 },
                    }, cvEvidenceHighlight]} />
                ))}
              </Stack>
            </Stack>
          )}
          {groups.length > 0 && (
            <Stack component="section" spacing={1}>
              {(section !== "profile" || index > 0) && (
                <Typography component="h4" variant="subtitle2" sx={{ fontWeight: 750 }}>
                  {t("document_sections." + section)}
                </Typography>
              )}
              {groups.map(({ id, heading, lines }) => (
                <Stack key={id} spacing={0.25}>
                  {heading && (
                    <Typography component="h5" variant="body2"
                      data-cv-evidence-highlighted={factHighlight([heading.id])}
                      sx={[{ fontWeight: 700 }, cvEvidenceHighlight]}>
                      {heading.text}
                    </Typography>
                  )}
                  {lines.map((line) => (
                    <Typography key={line.id} variant="body2"
                      data-cv-evidence-highlighted={factHighlight(cvLineFactIds(line))}
                      sx={[{ whiteSpace: "pre-wrap" }, cvEvidenceHighlight]}>
                      {line.text}
                    </Typography>
                  ))}
                </Stack>
              ))}
            </Stack>
          )}
        </Fragment>
      ))}
      {presentation.confirmed.length > 0 && (
        <Stack component="section" spacing={0.75}>
          <Typography component="h4" variant="subtitle2" sx={{ fontWeight: 750 }}>
            {t("document_confirmed_evidence")}
          </Typography>
          {presentation.confirmed.map(({ key, source, detail, requirementIds }) => (
            <Box key={key} data-cv-evidence-highlighted={requirementHighlight(requirementIds)} sx={cvEvidenceHighlight}>
              <Typography variant="body2" sx={{ fontWeight: 650 }}>
                {source}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {detail}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
