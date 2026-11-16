// Synthetic local QA only. No application API or external service is contacted.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Box, Button, Card, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import "@fontsource/inter/400.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import Topbar from "../../../layouts/components/Topbar";
import useAuthStore from "../../../store/authStore";
import useConfigStore from "../../../store/configStore";
import settings from "../../../store/generalSettings/generalSettingsStore";
import { mainInstance } from "../../../config/api";
import i18n from "../../../translate";

const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
const actor = params.get("actor") ?? "guest";
mainInstance.defaults.adapter = async (request) => {
  if (!request.url?.endsWith("/ai-providers/health")) throw new Error("Unexpected synthetic QA request");
  return { config: request, data: { timestamp: null, overallStatus: "unknown", alerts: [], engines: {}, providers: [], summary: { totalProviders: 0, activeProviders: 0, healthyProviders: 0, incidentsCount: 0 } }, status: 200, statusText: "OK", headers: {} };
};
if (actor === "guest") useAuthStore.getState().logout();
else useAuthStore.getState().login({ token: "synthetic-never-sent", expiresAt: Date.now() + 900_000, user: { id: "theme-qa", name: "QA" } });
settings.getState().setContext({ roles: actor === "admin" ? ["super_admin"] : [], actions: [], modules: [] });

export function Samples() {
  const [draft, setDraft] = useState("");
  const themeId = useConfigStore((state) => state.themeId);
  const themeType = useConfigStore((state) => state.themeType);
  return <Box component="main" sx={{ p: { xs: 2, sm: "16px 24px", md: "16px 32px" } }}>
    <Card variant="outlined" sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      <Stack spacing={3}>
        <div><Typography variant="h5">Nodia · Theme preview</Typography><Typography color="text.secondary">Synthetic dashboard · <output aria-label="Current preset">{themeId}</output> / <output aria-label="Current mode">{themeType}</output></Typography></div>
        <TextField label="Draft preserved across themes" value={draft} onChange={(event) => setDraft(event.target.value)} fullWidth />
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button variant="contained">Primary</Button><Button variant="contained" color="secondary">Secondary</Button><Button variant="outlined">Outlined</Button>
        </Stack>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          <Chip color="success" label="Success" /><Chip color="error" label="Error" /><Chip color="warning" label="Warning" /><Chip color="info" label="Info" />
        </Stack>
        <TableContainer><Table aria-label="Synthetic records"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Status</TableCell><TableCell align="right">Total</TableCell></TableRow></TableHead><TableBody><TableRow><TableCell>Sample record</TableCell><TableCell>Active</TableCell><TableCell align="right">$12,000</TableCell></TableRow></TableBody></Table></TableContainer>
      </Stack>
    </Card>
  </Box>;
}

const root = createRoot(document.getElementById("root")!);
root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MUIProvider><BrowserRouter><Topbar onDrawerToggle={() => undefined} /><Samples /></BrowserRouter></MUIProvider></QueryClientProvider>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
