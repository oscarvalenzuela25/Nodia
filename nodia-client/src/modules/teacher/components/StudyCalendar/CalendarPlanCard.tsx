import { useId, useRef, useState } from "react";
import { Box, Button, Chip, IconButton, ListItemIcon, Menu, MenuItem, Stack, Tooltip, Typography } from "@mui/material";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import MoreVertOutlined from "@mui/icons-material/MoreVertOutlined";
import PowerSettingsNewOutlined from "@mui/icons-material/PowerSettingsNewOutlined";
import { useTranslation } from "react-i18next";
import type { CalendarSummary } from "../../infrastructure/studyCalendar";
import { calendarChipColors } from "./styles";

export type CalendarPlanAction = "edit" | "toggle" | "delete";
const menuTargetSize = 44;

type Props = {
  plan: CalendarSummary;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onAction: (action: CalendarPlanAction) => void;
};

export default function CalendarPlanCard({ plan, selected, disabled, onSelect, onAction }: Props) {
  const { t } = useTranslation();
  const triggerId = useId();
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const pendingAction = useRef<CalendarPlanAction | null>(null);
  const actionLabel = t("teacher:calendar.plan_actions", { name: plan.title });
  const toggleLabel = t(plan.active ? "teacher:calendar.deactivate_plan" : "teacher:calendar.activate_plan");
  const selectAction = (action: CalendarPlanAction) => {
    pendingAction.current = action;
    setAnchor(null);
  };
  const open = Boolean(anchor);

  return (
    <Box component="li" sx={{ display: "grid", gridTemplateAreas: '"card"', gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Button type="button" variant="outlined" color="inherit" onClick={onSelect} aria-pressed={selected} disabled={disabled}
        sx={{
          gridArea: "card", minWidth: 0, minHeight: 44, justifyContent: "flex-start", textAlign: "start",
          p: 1.5, paddingInlineEnd: theme => `calc(${menuTargetSize}px + ${theme.spacing(1.5)})`,
          borderRadius: theme => theme.spacing(2), borderColor: selected ? "primary.main" : "divider",
          bgcolor: selected ? "action.selected" : "background.paper", textTransform: "none",
          "&:hover": { borderColor: "primary.main" },
          "&.Mui-disabled": { borderColor: selected ? "primary.main" : "divider" },
          "&.Mui-focusVisible": { outline: "2px solid", outlineOffset: -2, outlineColor: "primary.main" },
        }}>
        <Stack component="span" spacing={0.5} sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
          <Typography component="span" variant="subtitle2">{plan.title}</Typography>
          <Typography component="span" variant="body2" color="text.secondary">
            {t("teacher:calendar.week_progress", { done: plan.completed_count, total: plan.day_count })}
          </Typography>
          {(!plan.active || plan.categories.length > 0) && (
            <Stack component="span" direction="row" sx={{ gap: 0.5, flexWrap: "wrap" }}>
              {!plan.active && <Chip component="span" label={t("teacher:calendar.plan_inactive")} size="small" variant="outlined" />}
              {plan.categories.map(item => <Chip component="span" key={item.id} label={item.name} size="small"
                variant="outlined" color={calendarChipColors[item.color]}
                sx={{ maxWidth: "100%", height: "auto", "& .MuiChip-label": { overflowWrap: "anywhere", whiteSpace: "normal" } }} />)}
            </Stack>
          )}
        </Stack>
      </Button>
      <Tooltip title={actionLabel}>
        <Box component="span" sx={{ gridArea: "card", alignSelf: "start", justifySelf: "end", m: 0.5, zIndex: 1, display: "flex" }}>
          <IconButton type="button" id={triggerId} aria-label={actionLabel} aria-haspopup="menu" aria-expanded={open}
            aria-controls={open ? menuId : undefined} disabled={disabled} sx={{ width: menuTargetSize, height: menuTargetSize }}
            onClick={event => setAnchor(event.currentTarget)} onKeyDown={event => {
              if (event.key !== "ArrowDown") return;
              event.preventDefault();
              setAnchor(event.currentTarget);
            }}>
            <MoreVertOutlined />
          </IconButton>
        </Box>
      </Tooltip>
      <Menu anchorEl={anchor} open={open}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        onClose={() => {
          pendingAction.current = null;
          setAnchor(null);
        }}
        slotProps={{
          list: { id: menuId, "aria-labelledby": triggerId },
          transition: { onExited: () => {
            const action = pendingAction.current;
            pendingAction.current = null;
            if (action) onAction(action);
          } },
        }}>
        <MenuItem sx={{ minHeight: 44 }} onClick={() => selectAction("edit")} disabled={disabled}>
          <ListItemIcon><EditOutlined fontSize="small" /></ListItemIcon>
          {t("teacher:calendar.update_plan")}
        </MenuItem>
        <MenuItem sx={{ minHeight: 44 }} onClick={() => selectAction("toggle")} disabled={disabled}>
          <ListItemIcon><PowerSettingsNewOutlined fontSize="small" /></ListItemIcon>
          {toggleLabel}
        </MenuItem>
        <MenuItem sx={{ minHeight: 44, color: "error.main", "& .MuiListItemIcon-root": { color: "inherit" } }}
          onClick={() => selectAction("delete")} disabled={disabled}>
          <ListItemIcon><DeleteOutlineOutlined fontSize="small" /></ListItemIcon>
          {t("teacher:calendar.delete_plan")}
        </MenuItem>
      </Menu>
    </Box>
  );
}
