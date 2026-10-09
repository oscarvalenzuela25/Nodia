import { useEffect, useId, useState } from "react";
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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MoreVertOutlined from "@mui/icons-material/MoreVertOutlined";
import AddCircleOutlined from "@mui/icons-material/AddCircleOutlined";
import { Skeleton } from "boneyard-js/react";
import InputSearch from "../../../../components/inputs/InputSearch";
import type { RentalPageMeta } from "../../types";
import {
  CreateButton,
  ResponsivePagination,
  ScrollContainer,
  TablePanel,
  TableTopBar,
} from "./styles";

export type RentalColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
};
export type RentalRowAction = {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};
export type RentalTableProps<T extends { id: string }> = {
  rows: T[];
  columns: RentalColumn<T>[];
  meta?: RentalPageMeta;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  query: {
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error?: unknown;
    refetch: () => unknown;
  };
  search?: string;
  onSearchChange?: (search: string) => void;
  onCreate?: () => void;
  actions?: (row: T) => RentalRowAction[];
  busy?: boolean;
  children?: ReactNode;
  title?: string;
  renderMobileRow?: (row: T, busy: boolean) => ReactNode;
};
// Informative placeholders only: controls remain outside the loading surface.
const mobileRecordBones = {
  name: "rental-mobile-record", viewportWidth: 390, width: 358, height: 220,
  bones: [
    { x: 4.5, y: 16, w: 58, h: 20, r: 4 }, { x: 4.5, y: 46, w: 25, h: 18, r: 8 },
    { x: 4.5, y: 90, w: 34, h: 12, r: 3 }, { x: 54, y: 90, w: 34, h: 12, r: 3 },
    { x: 4.5, y: 112, w: 40, h: 18, r: 4 }, { x: 54, y: 112, w: 40, h: 18, r: 4 },
    { x: 4.5, y: 156, w: 28, h: 12, r: 3 }, { x: 54, y: 156, w: 28, h: 12, r: 3 },
    { x: 4.5, y: 178, w: 20, h: 18, r: 4 }, { x: 54, y: 178, w: 30, h: 18, r: 4 },
  ],
};
export default function RentalTable<T extends { id: string }>({
  rows,
  columns,
  meta,
  page,
  limit,
  onPageChange,
  onLimitChange,
  query,
  search,
  onSearchChange,
  onCreate,
  actions,
  busy: externalBusy,
  children,
  title,
  renderMobileRow,
}: RentalTableProps<T>) {
  const { t } = useTranslation();
  const menuId = useId();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const showCards = isMobile && Boolean(renderMobileRow);
  const [menu, setMenu] = useState<{
    anchor: HTMLButtonElement;
    id: string;
  } | null>(null);
  const busy = Boolean(externalBusy || query.isLoading || query.isFetching);
  useEffect(() => {
    if (!meta || query.isLoading || query.isFetching || query.isError) return;
    const last = Math.max(1, meta.total_pages);
    let active = true;
    if (page > last)
      queueMicrotask(() => {
        if (active) onPageChange(last);
      });
    return () => {
      active = false;
    };
  }, [
    meta,
    page,
    query.isLoading,
    query.isFetching,
    query.isError,
    onPageChange,
  ]);
  const row = menu ? rows.find((item) => item.id === menu.id) : undefined;
  const colspan = columns.length + (actions ? 1 : 0);
  return (
    <Box>
      {title && (
        <Typography variant="h6" sx={{ mb: 2 }}>
          {title}
        </Typography>
      )}
      {(onSearchChange || onCreate) && (
        <TableTopBar>
          {onSearchChange && (
            <Box sx={{ width: { xs: "100%", sm: 360 } }}>
              <InputSearch
                value={search ?? ""}
                onChange={onSearchChange}
                placeholder={t("rental:search")}
                disabled={busy}
                fullWidth
              />
            </Box>
          )}
          {onCreate && (
            <CreateButton
              variant="contained"
              startIcon={<AddCircleOutlined />}
              disabled={busy}
              onClick={onCreate}
            >
              {t("rental:create")}
            </CreateButton>
          )}
        </TableTopBar>
      )}
      {children}
      {query.isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              disabled={busy}
              onClick={() => void query.refetch()}
            >
              {t("rental:retry")}
            </Button>
          }
        >
          {t("rental:load_error")}
        </Alert>
      )}
      <TablePanel sx={showCards ? { border: 0, boxShadow: "none", bgcolor: "transparent" } : undefined}>
        {busy && !query.isLoading && (
          <LinearProgress
            sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 2 }}
          />
        )}
        <Skeleton loading={query.isLoading} initialBones={showCards ? mobileRecordBones : undefined}
          color={showCards ? theme.palette.action.disabledBackground : undefined}>
          {showCards ? <Box role="list" aria-label={title ?? t("rental:records")} sx={{ display: "grid", gap: 2, minHeight: query.isLoading ? 220 : undefined }}>
            {rows.map(item => <Box role="listitem" key={item.id}>{renderMobileRow?.(item, busy)}</Box>)}
            {!query.isLoading && !rows.length && <Typography sx={{ py: 6, textAlign: "center" }}>{t(query.isError ? "rental:load_error" : "rental:empty")}</Typography>}
          </Box> :
          <ScrollContainer>
            <Table
              sx={{ minWidth: 650 }}
              aria-label={title ?? t("rental:records")}
            >
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell key={column.key} align={column.align}>
                      {column.label}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell align="right">{t("rental:actions")}</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((item) => (
                  <TableRow key={item.id}>
                    {columns.map((column) => (
                      <TableCell key={column.key} align={column.align}>
                        {column.render(item)}
                      </TableCell>
                    ))}
                    {actions && (
                      <TableCell align="right">
                        <IconButton
                          aria-label={t("rental:row_actions", { id: item.id })}
                          aria-haspopup="menu"
                          aria-controls={
                            menu?.id === item.id ? menuId : undefined
                          }
                          disabled={busy}
                          onClick={(event) =>
                            setMenu({
                              anchor: event.currentTarget,
                              id: item.id,
                            })
                          }
                        >
                          <MoreVertOutlined />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {!query.isLoading && !rows.length && (
                  <TableRow>
                    <TableCell
                      colSpan={colspan}
                      sx={{ py: 6, textAlign: "center" }}
                    >
                      <Typography>
                        {query.isError
                          ? t("rental:load_error")
                          : t("rental:empty")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollContainer>
          }
        </Skeleton>
        <ResponsivePagination
          sx={showCards ? { mt: 2, bgcolor: "background.paper", borderRadius: 2 } : undefined}
          component="div"
          count={meta?.total_items ?? 0}
          page={Math.max(0, page - 1)}
          rowsPerPage={limit}
          rowsPerPageOptions={[10, 20, 50, 100]}
          onPageChange={(_, next) => {
            if (!busy) onPageChange(next + 1);
          }}
          onRowsPerPageChange={(event) => {
            if (!busy) onLimitChange(Number(event.target.value));
          }}
          labelRowsPerPage={t("rental:rows_per_page")}
          labelDisplayedRows={({ from, to, count }) =>
            t("rental:pagination", { from, to, count })
          }
          disabled={busy}
          getItemAriaLabel={(type) =>
            t(type === "previous" ? "rental:previous_page" : "rental:next_page")
          }
          slotProps={{
            actions: {
              previousButton: { disabled: busy || page <= 1 },
              nextButton: {
                disabled: busy || page >= (meta?.total_pages ?? 1),
              },
            },
          }}
        />
      </TablePanel>
      <Menu
        id={menuId}
        anchorEl={menu?.anchor}
        open={Boolean(menu && row)}
        onClose={() => setMenu(null)}
      >
        {row &&
          actions?.(row).map((action) => (
            <MenuItem
              key={action.key}
              disabled={busy || action.disabled}
              onClick={() => {
                if (busy || action.disabled) return;
                setMenu(null);
                action.onClick();
              }}
            >
              {action.label}
            </MenuItem>
          ))}
      </Menu>
    </Box>
  );
}
