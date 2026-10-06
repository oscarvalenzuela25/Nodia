import { useState } from "react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Alert, Box, Button, Stack } from "@mui/material";
import MUIProvider from "../../../../providers/MUIProvider";
import { mainInstance } from "../../../../config/api";
import useAuthStore from "../../../../store/authStore";
import useConfigStore from "../../../../store/configStore";
import i18n from "../../../../translate";
import GuardStrict from "../../../../routes/GuardStrict";
import RentalReservations from "../../../../modules/rentals/pages/RentalReservations";
import { RENTAL_RESERVATIONS_ROUTE } from "../../../../modules/rentals/constants/routes";

const qaRouter = createMemoryRouter(
  [
    {
      path: RENTAL_RESERVATIONS_ROUTE,
      element: (
        <GuardStrict modulePath={RENTAL_RESERVATIONS_ROUTE}>
          <Box component="main" sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
            <RentalReservations />
          </Box>
        </GuardStrict>
      ),
    },
    {
      path: "/login",
      element: (
        <Alert severity="info">
          Inicia una sesión sintética usando los botones de prueba.
        </Alert>
      ),
    },
    {
      path: "/404",
      element: <Alert severity="error">Sin módulo asignado.</Alert>,
    },
  ],
  { initialEntries: [RENTAL_RESERVATIONS_ROUTE] },
);
export default function Harness() {
  const [status, setStatus] = useState("Listo");
  const login = (id: string) => {
    mainInstance.defaults.headers.common["x-test-actor"] = id;
    useAuthStore.getState().login({
      token: "synthetic-identity",
      expiresAt: Date.now() + 3600000,
      user: { id, name: `Synthetic ${id}` },
    });
    void qaRouter.navigate(RENTAL_RESERVATIONS_ROUTE);
  };
  const control = async (path: string) => {
    const response = await fetch(`/__qa/${path}`, { method: "POST" });
    setStatus(`${path}: ${response.status}`);
  };
  return (
    <MUIProvider>
      <Stack direction="row" useFlexGap sx={{ p: 1, gap: 1, flexWrap: "wrap" }}>
        <Button onClick={() => login("1")}>Owner sintético</Button>
        <Button onClick={() => login("2")}>Colaborador sintético</Button>
        <Button onClick={() => login("3")}>Externo sintético</Button>
        <Button
          onClick={() => useConfigStore.getState().handleToggleThemeType()}
        >
          Claro / oscuro
        </Button>
        <Button
          onClick={() =>
            void i18n.changeLanguage(i18n.language === "es" ? "en" : "es")
          }
        >
          ES / EN
        </Button>
        <Button onClick={() => void control("lose-next-payment")}>
          Perder respuesta de próximo cobro
        </Button>
        <Button onClick={() => void control("revoke")}>
          Revocar colaborador de prueba
        </Button>
        <Button onClick={() => void control("finish")}>Terminar prueba</Button>
      </Stack>
      <Alert severity="info">
        ENTORNO AISLADO — datos sintéticos — {status}
      </Alert>
      <RouterProvider router={qaRouter} />
    </MUIProvider>
  );
}
