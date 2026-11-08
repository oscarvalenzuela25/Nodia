import { useId, useState } from "react";
import type { FC } from "react";
import { IconButton, ListItemIcon, ListItemText, MenuItem, Tooltip } from "@mui/material";
import MoreVertOutlined from "@mui/icons-material/MoreVertOutlined";
import LinkOutlined from "@mui/icons-material/LinkOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import { useTranslation } from "react-i18next";
import { ActionsMenu } from "./styles";

interface Props {
  index: number;
  disabled: boolean;
  onMatch: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

export const InvoiceRowActions: FC<Props> = ({ index, disabled, onMatch, onEdit, onRemove }) => {
  const { t } = useTranslation(["business", "core"]);
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  const run = (action: () => void) => {
    if (disabled) return;
    close();
    action();
  };
  return <>
    <Tooltip title={t("core:actions")}>
      <span>
        <IconButton
          id={`${id}-trigger`}
          aria-label={t("business:invoice_row_actions", { row: index + 1 })}
          aria-haspopup="menu"
          aria-controls={anchor ? `${id}-menu` : undefined}
          aria-expanded={Boolean(anchor)}
          disabled={disabled}
          onClick={event => { if (!disabled) setAnchor(event.currentTarget); }}
          data-testid={`invoice-row-actions-${index}`}
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          <MoreVertOutlined fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
    <ActionsMenu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        slotProps={{ list: { id: `${id}-menu`, "aria-labelledby": `${id}-trigger` } }}
    >
      <MenuItem disabled={disabled} onClick={() => run(onMatch)}>
        <ListItemIcon><LinkOutlined fontSize="small" /></ListItemIcon>
        <ListItemText>{t("business:invoice_match_title")}</ListItemText>
      </MenuItem>
      <MenuItem disabled={disabled} onClick={() => run(onEdit)} data-testid={`edit-row-${index}`}>
        <ListItemIcon><EditOutlined fontSize="small" color="primary" /></ListItemIcon>
        <ListItemText>{t("business:edit_row_tooltip")}</ListItemText>
      </MenuItem>
      <MenuItem disabled={disabled} onClick={() => run(onRemove)} data-testid={`delete-row-${index}`} sx={{ color: "error.main" }}>
        <ListItemIcon><DeleteOutlined fontSize="small" color="error" /></ListItemIcon>
        <ListItemText>{t("business:remove_row_tooltip")}</ListItemText>
      </MenuItem>
    </ActionsMenu>
  </>;
};
