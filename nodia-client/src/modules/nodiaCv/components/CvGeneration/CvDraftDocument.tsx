import { Box, Divider, Paper, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { cvExperiencePresentation } from "../../infrastructure/experiencePresentation";
import type { CvDraftFact } from "../../infrastructure/generationSchema";
import type { CvGenerationView } from "../../infrastructure/useCvGenerationWorkflow";

type FactGroup = { section: CvDraftFact["section"]; facts: CvDraftFact[] };
const sections: CvDraftFact["section"][] = [
  "profile",
  "experience",
  "project",
  "skills",
  "education",
  "certification",
  "language",
  "additional",
];
const primaryFields = ["title", "name", "language"];

export default function CvDraftDocument({ view }: { view: CvGenerationView }) {
  const { receipt, profile } = view;
  const { t } = useTranslation("nodiaCv", { lng: receipt.language });
  const draft = receipt.draft;
  if (!draft) return null;
  const indexed = new Map([...draft.selectedFacts, ...draft.remainingFacts].map((fact) => [fact.id, fact]));
  const included = receipt.review?.included_fact_ids ?? draft.selectedFacts.map((fact) => fact.id);
  const groups = new Map<string, FactGroup>();
  for (const id of included) {
    const fact = indexed.get(id);
    if (!fact) continue;
    const section = fact.section === "profile" && fact.field === "main_stack" ? "skills" : fact.section;
    const key = `${section}:${fact.groupId}`;
    const group = groups.get(key) ?? { section, facts: [] };
    group.facts.push(fact);
    groups.set(key, group);
  }

  const bySection = sections.map((section) => ({
    section,
    groups: [...groups].filter(([, group]) => group.section === section),
  }));
  const contact = [
    profile.contact.location,
    profile.contact.email,
    profile.contact.phone,
    profile.contact.linkedin_url,
    profile.contact.github_url,
    profile.contact.portfolio_url,
  ].filter(Boolean);
  return (
    <Stack
      component={Paper}
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
          <Typography sx={{ mt: 0.5, fontWeight: 600 }}>{profile.professional_title}</Typography>
        )}
        {contact.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {contact.join(" · ")}
          </Typography>
        )}
      </Box>
      <Divider />
      {bySection
        .filter(({ groups }) => groups.length > 0)
        .map(({ section, groups }) => (
          <Stack component="section" key={section} spacing={1}>
            {section !== "profile" && (
              <Typography component="h4" variant="subtitle2" sx={{ fontWeight: 750 }}>
                {t("document_sections." + section)}
              </Typography>
            )}
            {groups.map(([id, group]) => {
              const lines = group.facts.filter(
                (fact) =>
                  section !== "profile" ||
                  fact.field !== "professional_title" ||
                  fact.text !== profile.professional_title,
              );
              const presentation =
                group.section === "experience"
                  ? cvExperiencePresentation(lines, t)
                  : { heading: lines.find((fact) => primaryFields.includes(fact.field)), lines };
              const { heading, lines: visibleLines } = presentation;
              return (
                <Stack key={id} spacing={0.25}>
                  {heading && (
                    <Typography component="h5" variant="body2" sx={{ fontWeight: 700 }}>
                      {heading.text}
                    </Typography>
                  )}
                  {visibleLines
                    .filter((fact) => fact.id !== heading?.id)
                    .map((fact) => (
                      <Typography key={fact.id} variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {fact.text}
                      </Typography>
                    ))}
                </Stack>
              );
            })}
          </Stack>
        ))}
      {!!receipt.review?.evidence.length && (
        <Stack component="section" spacing={0.75}>
          <Typography component="h4" variant="subtitle2" sx={{ fontWeight: 750 }}>
            {t("document_confirmed_evidence")}
          </Typography>
          {receipt.review.evidence.map((item) => (
            <Box key={item.requirement_id}>
              <Typography variant="body2" sx={{ fontWeight: 650 }}>
                {item.source}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {item.detail}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
