// Isolated AI-34 UI fixture: no operational backend, credentials or provider calls.
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Box, Button, Typography } from "@mui/material";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import { PageContent } from "../../../layouts/BaseLayout/styles";
import NodiaAI from "../../../modules/nodiaAi/pages/NodiaAI";
import type { NodiaAiDetail } from "../../../modules/nodiaAi/infrastructure/types";
import { mainInstance } from "../../../config/api";
import { queryClient } from "../../../config/reactQuery";
import useAuthStore from "../../../store/authStore";
import useThemeStore from "../../../store/configStore";
import i18n from "../../../translate";
import { CHAT_ID, installFixture } from "./fixtures";
import { run } from "../../modules/nodiaAi/infrastructure/fixtures";

if (location.hostname !== "127.0.0.1" || location.port !== "5198") throw new Error("AI-34 synthetic QA requires its isolated 127.0.0.1:5198 origin");
const params = new URLSearchParams(location.search);
const codes = ["compaction_invalid", "context_sources_changed", "context_snapshot_invalid", "context_limit", "preferences_changed"] as const;
type Code = typeof codes[number];
let code: Code = codes.find((item) => item === params.get("code")) ?? "context_limit";
let unknown = params.get("state") === "unknown";
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
useThemeStore.setState({ themeType: params.get("theme") === "light" ? "light" : "dark" });
const base = installFixture(null);
const counts = { message_writes: 0, selection_writes: 0, blocked_mutations: 0 };
const showCounts = () => { const node = document.getElementById("qa-context-calls"); if (node) node.textContent = JSON.stringify(counts); };
mainInstance.defaults.skipAuth = true;
mainInstance.defaults.adapter = async request => {
  const url = request.url ?? "";
  if (request.method !== "get") {
    if (url.endsWith("/messages")) counts.message_writes++;
    if (url.endsWith("/selection")) counts.selection_writes++;
    counts.blocked_mutations++; showCounts();
    throw new Error("Synthetic AI-34 fixture forbids mutations");
  }
  const response = await base.adapter(request);
  if (url.endsWith(`/conversations/${CHAT_ID}`)) {
    const detail = response.data as NodiaAiDetail;
    return { ...response, data: { ...detail, current_run: { ...run,
      conversation_id: CHAT_ID, selection: detail.conversation.selection,
      routing: detail.conversation.routing, state: unknown ? "unknown" : "failed",
      completed_at: unknown ? null : detail.conversation.created_at,
      budget_used: { ...run.budget_used, provider_dispatches: 1, compactions: 1 },
      error: { code: `nodia_ai:${code}`, message_key: `nodia_ai:${code}`, field_errors: [], retry_action: "none", correlation_id: run.run_id },
    } } };
  }
  return response;
};
useAuthStore.getState().login({ token: "synthetic-ai34-qa-not-a-real-credential", user: { id: "90000000991", name: "Synthetic QA" }, expiresAt: Date.now() + 3600000 });
const refresh = () => void queryClient.invalidateQueries();
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[`/tools/nodia-ai?chat=${CHAT_ID}`]}><MUIProvider>
  <Box sx={{ p: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
    <Typography sx={{ width: "100%" }}>QA SINTÉTICO AI-34 · SIN BD NI PROVEEDOR / NO DATABASE OR PROVIDER</Typography>
    <Button onClick={() => void i18n.changeLanguage("es")}>ES</Button><Button onClick={() => void i18n.changeLanguage("en")}>EN</Button>
    <Button onClick={() => useThemeStore.setState({ themeType: "light" })}>Claro / Light</Button><Button onClick={() => useThemeStore.setState({ themeType: "dark" })}>Oscuro / Dark</Button>
    {codes.map((item) => <Button key={item} onClick={() => { code = item; refresh(); }}>{item}</Button>)}
    <Button onClick={() => { unknown = true; refresh(); }}>Unknown</Button><Button onClick={() => { unknown = false; refresh(); }}>Failed</Button>
    <output id="qa-context-calls" aria-label="Operaciones simuladas" style={{ width: "100%", overflowWrap: "anywhere" }}>{JSON.stringify(counts)}</output>
  </Box><PageContent><NodiaAI /></PageContent></MUIProvider></MemoryRouter></QueryClientProvider>);
