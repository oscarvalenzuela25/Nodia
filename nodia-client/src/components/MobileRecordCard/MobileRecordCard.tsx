import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Box, Button, IconButton, Menu, MenuItem, Typography } from "@mui/material";
import MoreVertOutlined from "@mui/icons-material/MoreVertOutlined";
import ArrowOutwardOutlined from "@mui/icons-material/ArrowOutwardOutlined";
import { useTranslation } from "react-i18next";
import { CardRoot, FieldGrid } from "./styles";

export type MobileCardAction = { key: string; label: string; onClick: () => void; disabled?: boolean };
type Props = {
  title: string; status?: ReactNode; fields: { key: string; label: string; value: ReactNode }[];
  actions?: MobileCardAction[]; primaryAction?: MobileCardAction; disabled?: boolean;
};
export default function MobileRecordCard({ title, status, fields, actions = [], primaryAction, disabled = false }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return <CardRoot aria-label={title}>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
      <Box sx={{ minWidth: 0 }}><Typography component="h3" variant="body1" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{title}</Typography>{status && <Box sx={{ mt: .5 }}>{status}</Box>}</Box>
      {actions.length > 0 && <IconButton aria-label={t("layout:mobile_cards.actions", { name: title })} aria-haspopup="menu" aria-controls={anchor ? id : undefined}
        disabled={disabled} onClick={event => setAnchor(event.currentTarget)} sx={{ width: 44, height: 44 }}><MoreVertOutlined /></IconButton>}
    </Box>
    <FieldGrid>{fields.map(field => <Box key={field.key}>
      <Typography component="dt" variant="caption" sx={{ color: "text.secondary" }}>{field.label}</Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, mt: .25, fontWeight: 500, overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>{field.value}</Typography>
    </Box>)}</FieldGrid>
    {primaryAction && <Button fullWidth disabled={disabled || primaryAction.disabled} startIcon={<ArrowOutwardOutlined />}
      onClick={() => { if (!disabled && !primaryAction.disabled) primaryAction.onClick(); }} sx={{ minHeight: 44, bgcolor: "action.hover", borderRadius: 2 }}>{primaryAction.label}</Button>}
    <Menu id={id} anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
      {actions.map(action => <MenuItem key={action.key} disabled={disabled || action.disabled} onClick={() => { if (disabled || action.disabled) return; setAnchor(null); action.onClick(); }}>{action.label}</MenuItem>)}
    </Menu>
  </CardRoot>;
}
