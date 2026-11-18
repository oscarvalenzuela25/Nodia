import { useId, useState } from "react";
import {
  Box, Chip, IconButton, ListItemIcon, ListItemText, Menu, MenuItem,
  Skeleton as MuiSkeleton, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import EditOutlined from "@mui/icons-material/EditOutlined";
import MoreVertOutlined from "@mui/icons-material/MoreVertOutlined";
import PowerSettingsNewOutlined from "@mui/icons-material/PowerSettingsNewOutlined";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import MobileRecordCard from "../../../../../../components/MobileRecordCard";
import type { MobileCardAction } from "../../../../../../components/MobileRecordCard/MobileRecordCard";
import { TableSkeleton } from "../../../../../../components/skeletons";
import { formatCashAmount } from "../../../../infrastructure/cashValues";
import type { CashMovement, CashSummary } from "../../../../infrastructure/cashTypes";
import { cashMovementName } from "./cashLabels";
import { CashCards, CashMobileRecordSurface, CashMovementRow, CashTableScroll, TotalCard, TotalsGrid } from "./styles";

const kinds = ["income", "expense"] as const;

export function CashTotals({ summary, loading, period }: { summary?: CashSummary; loading: boolean; period: string }) {
  const { t, i18n } = useTranslation("business");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const counts = new Intl.NumberFormat(locale);
  return (
    <Skeleton loading={loading} fallback={
      <TotalsGrid>
        {kinds.map((kind) => (
          <TotalCard key={kind} aria-hidden="true">
            <MuiSkeleton width="42%" />
            <MuiSkeleton width="62%" height={42} />
            <MuiSkeleton width="36%" />
          </TotalCard>
        ))}
      </TotalsGrid>
    }>
      {summary && (
        <TotalsGrid role="status" aria-atomic="true">
          {kinds.map((kind) => {
            const total = summary[kind];
            return (
              <TotalCard key={kind}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                  <Typography variant="subtitle2" component="h2" sx={{ fontWeight: 700 }}>
                    {t(`business:cash.${kind}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{period}</Typography>
                </Box>
                <Typography variant="h5" component="p" sx={{ fontWeight: 740, fontVariantNumeric: "tabular-nums" }}>
                  {formatCashAmount(total.total_amount, locale)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("business:cash.movement_count", { count: total.count, formattedCount: counts.format(total.count) })}
                </Typography>
              </TotalCard>
            );
          })}
        </TotalsGrid>
      )}
    </Skeleton>
  );
}

interface CashRecordsProps {
  rows: CashMovement[];
  loading: boolean;
  hasSnapshot: boolean;
  mobile: boolean;
  disabled: boolean;
  formatDate: (date: string) => string;
  onEdit: (movement: CashMovement) => void;
  onToggle: (movement: CashMovement) => void;
}

export function CashRecords({ rows, loading, hasSnapshot, mobile, disabled, formatDate, onEdit, onToggle }: CashRecordsProps) {
  const { t, i18n } = useTranslation(["business", "core"]);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const columns = [
    { key: "date", header: t("business:cash.date"), width: 132 },
    { key: "type", header: t("business:cash.type"), width: 112 },
    { key: "description", header: t("business:cash.description_or_source") },
    { key: "category", header: t("business:cash.category") },
    { key: "amount", header: t("business:cash.amount"), align: "right" as const },
    { key: "activity", header: t("business:filter_status_label"), width: 102 },
    { key: "actions", header: t("core:actions"), width: 72, align: "right" as const },
  ];
  const status = (movement: CashMovement) => (
    <Chip
      size="small"
      variant="outlined"
      color={movement.is_active ? "success" : "default"}
      label={t(movement.is_active ? "business:status_active" : "business:status_inactive")}
    />
  );
  const actions = (movement: CashMovement): MobileCardAction[] => [
    {
      key: "edit",
      label: t(movement.source === "invoice" ? "business:cash.edit_invoice" : "business:cash.edit_movement"),
      icon: <EditOutlined fontSize="small" />,
      onClick: () => onEdit(movement),
    },
    {
      key: "activity",
      label: t(movement.is_active ? "business:action_deactivate" : "business:action_activate"),
      icon: <PowerSettingsNewOutlined fontSize="small" />,
      onClick: () => onToggle(movement),
    },
  ];

  return (
    <Skeleton loading={loading} fallback={mobile ? (
      <CashCards aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <MuiSkeleton key={index} variant="rounded" height={168} />
        ))}
      </CashCards>
    ) : (
      <TableSkeleton columns={columns} rows={5} paperSx={{ border: 0, borderRadius: 0, boxShadow: "none" }} />
    )}>
      {hasSnapshot && (mobile ? (
        <CashCards>
          {rows.length === 0 && (
            <Typography sx={{ p: 2, textAlign: "center", fontWeight: 600 }}>
              {t("business:cash.movements_empty")}
            </Typography>
          )}
          {rows.map((movement) => (
            <CashMobileRecordSurface key={movement.id} tone={movement.type} inactive={!movement.is_active}>
              <MobileRecordCard
                title={cashMovementName(movement, t)}
                status={
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                    <Chip size="small" label={t(`business:cash.${movement.type}`)} color={movement.type === "income" ? "success" : "error"} />
                    {status(movement)}
                  </Box>
                }
                fields={[
                  { key: "date", label: t("business:cash.date"), value: formatDate(movement.occurred_on) },
                  { key: "category", label: t("business:cash.category"), value: movement.category.name },
                  { key: "amount", label: t("business:cash.amount"), value: formatCashAmount(movement.amount, locale), fullWidth: true },
                ]}
                actions={actions(movement)}
                disabled={disabled}
              />
            </CashMobileRecordSurface>
          ))}
        </CashCards>
      ) : (
        <CashTableScroll tabIndex={0} role="region" aria-label={t("business:cash.movements")}>
          <Table sx={{ minWidth: 650 }} aria-label={t("business:cash.movements")}>
            <TableHead>
              <TableRow>
                {columns.map(({ key, header, align, width }) => (
                  <TableCell key={key} align={align} width={width} scope="col">{header}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {t("business:cash.movements_empty")}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((movement) => (
                <CashMovementRow key={movement.id} tone={movement.type} inactive={!movement.is_active} hover>
                  <TableCell>
                    <time dateTime={movement.occurred_on}>{formatDate(movement.occurred_on)}</time>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={t(`business:cash.${movement.type}`)} color={movement.type === "income" ? "success" : "error"} />
                  </TableCell>
                  <TableCell sx={{ overflowWrap: "anywhere", maxWidth: 320 }}>
                    {movement.source === "manual" && !movement.description ? "—" : cashMovementName(movement, t)}
                  </TableCell>
                  <TableCell sx={{ overflowWrap: "anywhere", maxWidth: 180 }}>{movement.category.name}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {formatCashAmount(movement.amount, locale)}
                  </TableCell>
                  <TableCell>{status(movement)}</TableCell>
                  <TableCell align="right">
                    <CashRecordMenu
                      label={t("business:cash.movement_actions", { name: cashMovementName(movement, t) })}
                      actions={actions(movement)}
                      disabled={disabled}
                    />
                  </TableCell>
                </CashMovementRow>
              ))}
            </TableBody>
          </Table>
        </CashTableScroll>
      ))}
    </Skeleton>
  );
}

function CashRecordMenu({ label, actions, disabled }: { label: string; actions: MobileCardAction[]; disabled: boolean }) {
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <IconButton
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? menuId : undefined}
        disabled={disabled}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ width: 44, height: 44 }}
      >
        <MoreVertOutlined />
      </IconButton>
      <Menu id={menuId} anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {actions.map((action) => (
          <MenuItem
            key={action.key}
            disabled={disabled}
            sx={{ minHeight: 44 }}
            onClick={() => {
              if (disabled) return;
              setAnchor(null);
              action.onClick();
            }}
          >
            <ListItemIcon>{action.icon}</ListItemIcon>
            <ListItemText primary={action.label} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
