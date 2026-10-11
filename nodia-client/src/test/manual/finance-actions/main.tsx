// Synthetic rows; production FinanceTable/theme. No HTTP or account mutations.
import { createRoot } from "react-dom/client";
import { Box, Chip } from "@mui/material";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import config from "../../../store/configStore";
import i18n from "../../../translate";
import FinanceTable from "../../../modules/finances/components/FinanceTable";

const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
config.setState({ themeType: params.get("theme") === "light" ? "light" : "dark" });
const rows = [
  { id: "9007199254740993", name: "Gasto por materiales", is_active: true },
  { id: "9007199254740994", name: "Gastos mano de obra", is_active: false },
];
const noop = () => {};

createRoot(document.getElementById("root")!).render(
  <MUIProvider>
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <FinanceTable
        rows={rows}
        columns={[
          { key: "name", labelKey: "finance:name", render: (row) => row.name },
          {
            key: "active", labelKey: "finance:active",
            render: (row) => <Chip size="small" color={row.is_active ? "success" : "default"} label={i18n.t(row.is_active ? "finance:active" : "finance:inactive")} />,
          },
        ]}
        search=""
        onSearchChange={noop}
        onCreate={noop}
        onEdit={noop}
        onToggle={noop}
        onPayment={params.has("payment") ? noop : undefined}
        canPay={(row) => row.is_active}
        meta={{ page: 1, limit: 10, total_items: 2, total_pages: 1 }}
        page={1}
        limit={10}
        onPageChange={noop}
        onLimitChange={noop}
        onRetry={noop}
        titleKey="finance:overview.category_summary"
      />
    </Box>
  </MUIProvider>,
);
