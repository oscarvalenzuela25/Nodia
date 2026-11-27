import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Box, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import ChecklistOutlined from "@mui/icons-material/ChecklistOutlined";
import LayersOutlined from "@mui/icons-material/LayersOutlined";
import { useTranslation } from "react-i18next";
import { CvRequirementsList } from "./CvRequirements";

type Props = ComponentProps<typeof CvRequirementsList> & {
  technologies: ReactNode;
  onChangeTab: () => void;
};

export default function CvOfferAnalysis({ technologies, onChangeTab, ...requirements }: Props) {
  const { t } = useTranslation("nodiaCv");
  const id = useId();
  const [tab, setTab] = useState<"requirements" | "technologies">("requirements");

  return (
    <Stack component={Paper} variant="outlined" spacing={1.5} aria-labelledby={id + "-title"}
      sx={{ borderRadius: 2, minWidth: 0, p: { xs: 2, sm: 2.5 } }}>
      <Box>
        <Typography component="h2" id={id + "-title"} variant="h6" sx={{ fontWeight: 750 }}>
          {t("generation_requirements")}
        </Typography>
        {tab === "requirements" && Boolean(requirements.analysis?.requirements.length) && (
          <Typography variant="body2" color="text.secondary">{t("analysis_requirements_hint")}</Typography>
        )}
      </Box>
      <Tabs value={tab} onChange={(_, value: typeof tab) => { setTab(value); onChangeTab(); }}
        aria-label={t("analysis_navigation")} selectionFollowsFocus variant="fullWidth"
        sx={{
          borderBottom: 1, borderColor: "divider",
          "& .MuiTab-root": { minHeight: 44, minWidth: 0, px: 0.5, overflowWrap: "anywhere", textTransform: "none" },
        }}>
        <Tab value="requirements" icon={<ChecklistOutlined fontSize="small" />} iconPosition="start"
          label={t("analysis_requirements")} id={id + "-requirements-tab"} />
        <Tab value="technologies" icon={<LayersOutlined fontSize="small" />} iconPosition="start"
          label={t("analysis_technologies")} id={id + "-technologies-tab"} />
      </Tabs>
      <Box role="tabpanel" aria-labelledby={id + "-requirements-tab"} hidden={tab !== "requirements"}>
        <CvRequirementsList {...requirements} />
      </Box>
      <Box role="tabpanel" aria-labelledby={id + "-technologies-tab"} hidden={tab !== "technologies"}>
        {technologies}
      </Box>
    </Stack>
  );
}
