import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Box, Button, Typography } from "@mui/material";
import MUIProvider from "../../../../providers/MUIProvider";
import { queryClient } from "../../../../config/reactQuery";
import useAuthStore from "../../../../store/authStore";
import useConfigStore from "../../../../store/configStore";
import i18n from "../../../../translate";
import ProvidersTab from "../../../../modules/business/pages/BusinessDetail/components/ProvidersTab";
useAuthStore
  .getState()
  .login({
    token: "synthetic-contact-session",
    user: { id: "1", name: "QA" },
    expiresAt: Date.now() + 3600000,
  });
const root = createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
root.render(
  <QueryClientProvider client={queryClient}>
    <MUIProvider>
      <Box
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        <Box sx={{ display: "flex", gap: 2 }}>
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
        </Box>
        <Typography variant="h5">Negocio de prueba · Proveedores</Typography>
        <ProvidersTab businessId="11111111-1111-4111-8111-111111111111" />
      </Box>
    </MUIProvider>
  </QueryClientProvider>,
);
