// Synthetic pagination-only fixture: production theme/wrappers, no HTTP or account.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Box, Paper, TablePagination, Typography } from "@mui/material";
import type { TablePaginationProps } from "@mui/material";
import { useTranslation } from "react-i18next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import config from "../../../store/configStore";
import i18n from "../../../translate";
import BusinessPagination from "../../../modules/business/components/BusinessPagination";
import { ResponsivePagination as RentalPagination } from "../../../modules/rentals/components/RentalTable/styles";
import { ResponsivePagination as FinancePagination } from "../../../modules/finances/components/FinanceTable/styles";
import { ListPagination as ModulesPagination } from "../../../modules/generalSettings/pages/Modules/styles";
import { ListPagination as ActionsPagination } from "../../../modules/generalSettings/pages/Actions/styles";
import { ListPagination as UsersPagination } from "../../../modules/generalSettings/pages/Users/styles";
import { ListPagination as RolesPagination } from "../../../modules/generalSettings/pages/Roles/styles";
import { ListPagination as KeysPagination } from "../../../modules/generalSettings/pages/AiProviders/components/ApiKeyManager/styles";
const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
config.setState({
  themeType: params.get("theme") === "light" ? "light" : "dark",
});
type PagingProps = Omit<TablePaginationProps<"div">, "component">;
const variants = [
  {
    name: "Módulos",
    render: (p: PagingProps) => <ModulesPagination component="div" {...p} />,
  },
  {
    name: "Acciones",
    render: (p: PagingProps) => <ActionsPagination component="div" {...p} />,
  },
  {
    name: "Usuarios",
    render: (p: PagingProps) => <UsersPagination component="div" {...p} />,
  },
  {
    name: "Roles",
    render: (p: PagingProps) => <RolesPagination component="div" {...p} />,
  },
  {
    name: "Negocios",
    render: (p: PagingProps) => <BusinessPagination component="div" {...p} />,
  },
  {
    name: "Reservas",
    render: (p: PagingProps) => <RentalPagination component="div" {...p} />,
  },
  {
    name: "Finanzas",
    render: (p: PagingProps) => <FinancePagination component="div" {...p} />,
  },
  {
    name: "Claves IA",
    render: (p: PagingProps) => <KeysPagination component="div" {...p} />,
  },
  {
    name: "MUI directo",
    render: (p: PagingProps) => <TablePagination component="div" {...p} />,
  },
];
export function Footer({ variant }: { variant: (typeof variants)[number] }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const fixed = variant.name === "Claves IA";
  return (
    <Paper
      component="section"
      aria-label={variant.name}
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      <Typography sx={{ p: 2 }}>{variant.name}</Typography>
      {variant.render({
        page,
        rowsPerPage: limit,
        count: 23,
        rowsPerPageOptions: fixed ? [10] : [5, 10, 25],
        onPageChange: (_, next) => setPage(next),
        onRowsPerPageChange: (event) => {
          setLimit(Number(event.target.value));
          setPage(0);
        },
        labelRowsPerPage: t("core:pagination.rows_per_page"),
        labelDisplayedRows: ({ from, to, count }) =>
          `${from}–${to} ${t("core:pagination.of")} ${count}`,
        getItemAriaLabel: (type) => t(`core:pagination.page_${type}`),
      })}
    </Paper>
  );
}
createRoot(document.getElementById("root")!).render(
  <MUIProvider>
    <Box sx={{ p: { xs: 2, sm: 3 }, display: "grid", gap: 3 }}>
      {variants.map((variant) => (
        <Footer key={variant.name} variant={variant} />
      ))}
    </Box>
  </MUIProvider>,
);
