// Synthetic QA only. Real NodiaAI components and layout wrappers; no production import.
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { AxiosError } from "axios";
import { Box, IconButton, Typography, useMediaQuery, useTheme } from "@mui/material";
import MenuOutlined from "@mui/icons-material/MenuOutlined";
import HomeRounded from "@mui/icons-material/HomeRounded";
import ChatBubbleOutlineRounded from "@mui/icons-material/ChatBubbleOutlineRounded";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/dm-sans/400.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import { LayoutWrapper, MainContainer, PageContent } from "../../../layouts/BaseLayout/styles";
import { TopbarRoot } from "../../../layouts/components/Topbar/styles";
import { DRAWER_WIDTH } from "../../../layouts/components/Sidenav/styles";
import { Dock, HomeLink, NavRoot, RoundButton, Slot, SlotLabel } from "../../../layouts/components/MobileBottomNav/styles";
import NodiaAI from "../../../modules/nodiaAi/pages/NodiaAI";
import useThemeStore from "../../../store/configStore";
import i18n from "../../../translate";
import { mainInstance } from "../../../config/api";
import { queryClient } from "../../../config/reactQuery";
import useAuthStore from "../../../store/authStore";
import GuardStrict from "../../../routes/GuardStrict";
import { authorizationKeys } from "../../../services/authorizationService";
import { CHAT_ID, installFixture } from "../nodia-ai/fixtures";

if (location.hostname !== "127.0.0.1" || location.port !== "5194") {
  throw new Error("Synthetic UX QA only permits isolated 127.0.0.1:5194");
}
const params = new URLSearchParams(location.search);
const language = params.get("lang") === "en" ? "en" : "es";
await i18n.changeLanguage(language);
document.documentElement.lang = language;
useThemeStore.setState({ themeType: params.get("theme") === "light" ? "light" : "dark" });
const fixture = installFixture(params.get("scenario") ?? "chat-redesign");
let authorizationError = false;
let authorizationWait: Promise<void> | null = null;
let releaseAuthorization: (() => void) | null = null;
mainInstance.defaults.adapter = async config => {
  if (!config.url?.endsWith("/authorization/context")) return fixture.adapter(config);
  fixture.controls.requests.push({ method: "GET", path: "/authorization/context" });
  if (authorizationWait) await authorizationWait;
  const response = { config, data: { roles: [], actions: [], modules: [{ module_group_key: "qa", translates: [], modules: [{ key: "nodia_ai", link: "/nodia-ai", translates: [] }] }] }, status: 200, statusText: "OK", headers: {} };
  if (authorizationError) throw new AxiosError("Synthetic authorization failure", "ERR_BAD_RESPONSE", config, undefined, { ...response, status: 503, data: { message: "Synthetic authorization unavailable" } });
  return response;
};
useAuthStore.getState().login({ token: "synthetic-qa-not-a-real-credential", user: { id: "90000000991", name: "Synthetic QA" }, expiresAt: Date.now() + 3600000 });
Object.assign(window, { __nodiaAiQa: fixture.controls });
Object.assign(window, { __nodiaAiUxQa: {
  failAuthorization: async () => { authorizationError = true; await queryClient.invalidateQueries({ queryKey: authorizationKeys.context() }); },
  recoverAuthorization: async () => { authorizationError = false; await queryClient.invalidateQueries({ queryKey: authorizationKeys.context() }); },
  holdAuthorization: () => {
    authorizationWait = new Promise<void>(resolve => { releaseAuthorization = resolve; });
    void queryClient.invalidateQueries({ queryKey: authorizationKeys.context() });
  },
  releaseAuthorization: () => { const finish = releaseAuthorization; releaseAuthorization = null; authorizationWait = null; finish?.(); },
} });

export function SyntheticShell() {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  return <LayoutWrapper>
    <Box aria-label="Synthetic application navigation" component="aside" sx={{ display: { xs: "none", lg: "flex" }, width: DRAWER_WIDTH, flexShrink: 0, p: 2, borderRight: 1, borderColor: "divider", flexDirection: "column", gap: 3 }}>
      <Typography variant="h5">Nodia</Typography>
      <Typography color="text.secondary">QA sintético · Synthetic QA</Typography>
      <Typography>Nodia AI</Typography>
    </Box>
    <MainContainer>
      <TopbarRoot>
        <IconButton aria-label="Synthetic navigation" disabled sx={{ width: 40, height: 40 }}><MenuOutlined /></IconButton>
        <Typography variant="body2" color="text.secondary">QA sintético · Synthetic shell</Typography>
      </TopbarRoot>
      <PageContent mobileNavigation={mobile}><GuardStrict modulePath="/nodia-ai"><NodiaAI /></GuardStrict></PageContent>
      {mobile && <NavRoot><Dock aria-label="Synthetic mobile navigation">
        {[0, 1].map(index => <Slot key={index}><RoundButton aria-label={`Synthetic shortcut ${index + 1}`} disabled><ChatBubbleOutlineRounded /></RoundButton><SlotLabel>QA</SlotLabel></Slot>)}
        <Slot><HomeLink to="/nodia-ai" aria-label="Synthetic home"><HomeRounded /></HomeLink><SlotLabel>Inicio · QA</SlotLabel></Slot>
        {[2, 3].map(index => <Slot key={index}><RoundButton aria-label={`Synthetic shortcut ${index + 1}`} disabled><ChatBubbleOutlineRounded /></RoundButton><SlotLabel>QA</SlotLabel></Slot>)}
      </Dock></NavRoot>}
    </MainContainer>
  </LayoutWrapper>;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={[params.get("chat") === "none" ? "/nodia-ai" : `/nodia-ai?chat=${CHAT_ID}`]}>
      <MUIProvider><SyntheticShell /></MUIProvider>
    </MemoryRouter>
  </QueryClientProvider>,
);
