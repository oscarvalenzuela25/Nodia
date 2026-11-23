import { useId, type ReactNode } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { useTranslation } from "react-i18next";
import { CalendarDrawerBody, CalendarDrawerHeader, StudyCalendarDrawer } from "./styles";

type Props = {
  title: string;
  description?: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
};

export default function CalendarDrawer({ title, description, busy, onClose, children }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <StudyCalendarDrawer
      open
      anchor="right"
      onClose={() => { if (!busy) onClose(); }}
      slotProps={{ paper: { role: "dialog", "aria-modal": true, "aria-labelledby": titleId } }}
    >
      <CalendarDrawerHeader>
        <Box sx={{ minWidth: 0 }}>
          {description && <Typography variant="body2" color="text.secondary">{description}</Typography>}
          <Typography component="h2" id={titleId} variant="h6">{title}</Typography>
        </Box>
        <IconButton aria-label={t("teacher:calendar.close")} disabled={busy} onClick={onClose} sx={{ minWidth: 44, minHeight: 44 }}>
          <CloseOutlined />
        </IconButton>
      </CalendarDrawerHeader>
      <CalendarDrawerBody>{children}</CalendarDrawerBody>
    </StudyCalendarDrawer>
  );
}
