// Isolated manual QA entry. Synthetic data only; never imported by the application.
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Alert, Stack, Typography } from "@mui/material";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/dm-sans/700.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import BaseLayout from "../../../layouts/BaseLayout";
import ReservationTable from "../../../modules/rentals/components/ReservationTable";
import { propertySchema, reservationSchema } from "../../../modules/rentals/infrastructure/schemas";
import { rentalKeys } from "../../../modules/rentals/infrastructure/useServices";
import useAuthStore from "../../../store/authStore";
import useThemeStore from "../../../store/configStore";
import settings from "../../../store/generalSettings/generalSettingsStore";
import i18n from "../../../translate";
import { sileo } from "sileo";
import fixture from "./fixtures.json";

const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
useThemeStore.setState({ themeType: params.get("theme") === "dark" ? "dark" : "light" });
const actorId = "manual-mobile-fixture";
useAuthStore.getState().login({ token: "synthetic-qa-never-sent", expiresAt: Date.now() + 900_000, user: { id: actorId, name: "QA sintético" } });
const context = { roles: [], actions: [], modules: [{ module_group_key: "qa", translates: [], modules: [
  { key: "reservations", link: "/tools/reservations", icon: "HolidayVillageOutlined", translates: [{ key: "key", es: "Reservas", en: "Reservations" }] },
  { key: "finances", link: "/finances/personal", icon: "AccountBalanceWalletOutlined", translates: [{ key: "key", es: "Finanzas", en: "Finances" }] },
  { key: "business", link: "/business", translates: [{ key: "key", es: "Negocios", en: "Business" }] },
  { key: "users", link: "/settings/users", translates: [{ key: "key", es: "Usuarios", en: "Users" }] },
] }] };
settings.getState().setContext(context);
const property = propertySchema.parse(fixture.property);
const reservation = reservationSchema.parse(fixture.reservation);
const rows = [reservation, { ...reservation, id: "2", guest_name: "Reserva sintética B", balance_due_amount: "0" }];
const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: false } } });
client.setQueryData(["authorization", "context", actorId], context);
const listKey = rentalKeys.list(actorId, property.id, "reservations", { page: 1, limit: 10, active: "active" });
const listData = {
  data: rows, meta: { page: 1, limit: 10, total_items: 2, total_pages: 1 },
};
if (params.get("loading") === "1") {
  void client.fetchQuery({ queryKey: listKey, queryFn: () => new Promise(resolve => setTimeout(() => resolve(listData), 5000)) });
} else client.setQueryData(listKey, listData);
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><MUIProvider><BrowserRouter><BaseLayout>
  <Stack spacing={3}><Alert severity="info">QA visual · datos sintéticos</Alert><Typography variant="h5">{i18n.t("rental:tabs.reservations")}</Typography>
    <ReservationTable property={property} onOpenReservation={id => sileo.info({ title: `QA · detalle #${id}` })}
      onEditReservation={record => sileo.info({ title: `QA · editar #${record.id}` })} onCreateReservation={() => sileo.info({ title: "QA · crear" })} />
  </Stack>
</BaseLayout></BrowserRouter></MUIProvider></QueryClientProvider>);
