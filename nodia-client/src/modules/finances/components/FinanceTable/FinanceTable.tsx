import { useId, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import MoreVertOutlinedIcon from "@mui/icons-material/MoreVertOutlined";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import { Skeleton } from "boneyard-js/react";
import InputSearch from "../../../../components/inputs/InputSearch";
import type { FinancePage } from "../../types";
import {
  ScrollContainer,
  TablePanel,
  TableTopBar,
  ResponsivePagination,
  CreateButton,
} from "./styles";

export interface FinanceColumn<T> {
  key: string;
  labelKey: string;
  align?: "left" | "right" | "center";
  render: (record: T) => ReactNode;
}

export interface FinanceTableProps<
  T extends { id: string; name: string; is_active: boolean },
> {
  rows: T[];
  columns: FinanceColumn<T>[];
  search: string;
  onSearchChange: (search: string) => void;
  onCreate: () => void;
  onEdit: (record: T) => void;
  onToggle: (record: T) => void;
  onPayment?: (record: T) => void;
  canPay?: (record: T) => boolean;
  meta?: FinancePage<T>["meta"];
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  onRetry: () => void;
  disabled?: boolean;
  titleKey?: string;
}

const FinanceTable = <
  T extends { id: string; name: string; is_active: boolean },
>({
  rows,
  columns,
  search,
  onSearchChange,
  onCreate,
  onEdit,
  onToggle,
  onPayment,
  canPay,
  meta,
  page,
  limit,
  onPageChange,
  onLimitChange,
  isLoading = false,
  isFetching = false,
  isError = false,
  onRetry,
  disabled = false,
  titleKey,
}: FinanceTableProps<T>) => {
  const { t } = useTranslation();
  const menuId = useId();
  const [action, setAction] = useState<{
    anchor: HTMLButtonElement;
    record: T;
  } | null>(null);
  const busy = disabled || isLoading || isFetching;
  const closeMenu = () => setAction(null);
  const perform = (callback: (record: T) => void) => {
    if (!action || busy) return;
    callback(action.record);
    closeMenu();
  };

  return (
    <Box>
      {titleKey && (
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t(titleKey)}
        </Typography>
      )}
      <TableTopBar>
        <Box sx={{ width: { xs: "100%", sm: 360 } }}>
          <InputSearch
            value={search}
            onChange={onSearchChange}
            placeholder={t("finance:search")}
            disabled={busy}
            fullWidth
          />
        </Box>
        <CreateButton
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlinedIcon />}
          onClick={onCreate}
          disabled={busy}
        >
          {t("finance:create")}
        </CreateButton>
      </TableTopBar>
      {isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" disabled={busy} onClick={onRetry}>
              {t("finance:retry")}
            </Button>
          }
        >
          {t("finance:load_error")}
        </Alert>
      )}
      <TablePanel>
        {isFetching && !isLoading && (
          <LinearProgress
            sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 2 }}
          />
        )}
        <Skeleton loading={isLoading}>
          <ScrollContainer>
            <Table
              sx={{ minWidth: 650 }}
              aria-label={t(titleKey ?? "finance:records")}
            >
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell key={column.key} align={column.align}>
                      {t(column.labelKey)}
                    </TableCell>
                  ))}
                  <TableCell align="center">{t("finance:actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((record) => (
                  <TableRow key={record.id} hover>
                    {columns.map((column) => (
                      <TableCell key={column.key} align={column.align}>
                        {column.render(record)}
                      </TableCell>
                    ))}
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        disabled={busy}
                        aria-label={t("finance:row_actions", {
                          name: record.name,
                        })}
                        aria-haspopup="menu"
                        aria-controls={
                          action?.record.id === record.id ? menuId : undefined
                        }
                        aria-expanded={
                          action?.record.id === record.id ? true : undefined
                        }
                        onClick={(event) =>
                          setAction({ anchor: event.currentTarget, record })
                        }
                      >
                        <MoreVertOutlinedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && !isError && rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length + 1}
                      align="center"
                      sx={{ py: 6 }}
                    >
                      <Typography color="text.secondary">
                        {t("finance:empty_records")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {isLoading &&
                  rows.length === 0 &&
                  Array.from({ length: 5 }, (_, index) => (
                    <TableRow key={index}>
                      {columns.map((column) => (
                        <TableCell key={column.key}>
                          <Box sx={{ height: 22, minWidth: 70 }} />
                        </TableCell>
                      ))}
                      <TableCell />
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </ScrollContainer>
        </Skeleton>
        <ResponsivePagination
          component="div"
          count={meta?.total_items ?? 0}
          page={Math.max(
            0,
            Math.min(page - 1, Math.ceil((meta?.total_items ?? 0) / limit) - 1),
          )}
          rowsPerPage={limit}
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          onPageChange={(_, next) => onPageChange(next + 1)}
          onRowsPerPageChange={(event) =>
            onLimitChange(Number(event.target.value))
          }
          disabled={busy}
          labelRowsPerPage={t("finance:rows_per_page")}
          getItemAriaLabel={(type) => t(`finance:pagination_${type}`)}
          labelDisplayedRows={({ from, to, count }) =>
            t("finance:pagination", { from, to, count })
          }
        />
      </TablePanel>
      <Menu
        id={menuId}
        anchorEl={action?.anchor ?? null}
        open={Boolean(action)}
        onClose={closeMenu}
      >
        <MenuItem disabled={busy} onClick={() => perform(onEdit)}>
          {t("finance:update")}
        </MenuItem>
        <MenuItem disabled={busy} onClick={() => perform(onToggle)}>
          {t(
            action?.record.is_active
              ? "finance:deactivate"
              : "finance:activate",
          )}
        </MenuItem>
        {onPayment && (
          <MenuItem
            disabled={
              busy || !action || Boolean(canPay && !canPay(action.record))
            }
            onClick={() => perform(onPayment)}
          >
            {t("finance:register_payment")}
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default FinanceTable;
