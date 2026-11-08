import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { Box, CircularProgress, IconButton, Tooltip, Typography } from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { useTranslation } from "react-i18next";
import { formatClp } from "../../../../../infrastructure/salesPolicies";
import type { OpenSaleTabsProps } from "./types";
import { saleTabId } from "./types";
import { SaleButton, SaleTab, TabStrip } from "./styles";

export default function OpenSaleTabs({ sales, activeId, panelId, disabled, onSelect, onClose }: OpenSaleTabsProps) {
  const { t, i18n } = useTranslation("business");
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (disabled) return;
    const index = sales.findIndex((sale) => sale.id === id);
    let target: number;
    if (event.key === "ArrowRight") target = (index + 1) % sales.length;
    else if (event.key === "ArrowLeft") target = (index + sales.length - 1) % sales.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = sales.length - 1;
    else return;
    event.preventDefault();
    const next = sales[target];
    onSelect(next.id, "keyboard");
    buttons.current.get(next.id)?.focus();
  };
  return <TabStrip role="tablist" aria-label={t("business:pos.open_sales")}>
    {sales.map((sale) => <SaleTab key={sale.id} selected={sale.id === activeId}>
      <SaleButton type="button" role="tab" id={saleTabId(panelId, sale.id)} aria-controls={panelId} aria-selected={sale.id === activeId}
        tabIndex={sale.id === activeId ? 0 : -1} disabled={disabled}
        ref={(node) => { if (node) buttons.current.set(sale.id, node); else buttons.current.delete(sale.id); }}
        onKeyDown={(event) => navigate(event, sale.id)} onClick={() => onSelect(sale.id, "pointer")}>
        <Box sx={{ display: "grid", gap: .25, minWidth: 0 }}>
          <Typography component="span" sx={{ fontWeight: 700 }}>{t("business:pos.sale_number", { number: sale.number })}</Typography>
          <Typography component="span" variant="body2" sx={{ overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>{sale.amount === null ? "—" : formatClp(sale.amount, i18n.language)}</Typography>
          {sale.pending && <Typography component="span" variant="caption" color="warning.main">{t("business:pos.sale_pending")}</Typography>}
        </Box>
        {sale.busy && <CircularProgress size={16} aria-label={t("business:pos.sale_saving")} />}
      </SaleButton>
      <Tooltip title={t(sale.pending ? "business:pos.cannot_close_pending" : "business:pos.close_sale_tab", { number: sale.number })}>
        <Box component="span" sx={{ display: "inline-flex" }}><IconButton aria-label={t("business:pos.close_sale_tab", { number: sale.number })}
          disabled={disabled || sale.pending || sale.busy} onClick={() => onClose(sale.id)} sx={{ width: 44, height: 44 }}><CloseOutlined fontSize="small" /></IconButton></Box>
      </Tooltip>
    </SaleTab>)}
  </TabStrip>;
}
