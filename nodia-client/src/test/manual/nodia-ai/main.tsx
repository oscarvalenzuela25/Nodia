// Synthetic AI-13 fixture. The production route never imports this harness.
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import "@fontsource/inter/400.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import { PageContent } from "../../../layouts/BaseLayout/styles";
import NodiaAI from "../../../modules/nodiaAi/pages/NodiaAI";
import useThemeStore from "../../../store/configStore";
import i18n from "../../../translate";
import { mainInstance } from "../../../config/api";
import { queryClient } from "../../../config/reactQuery";
import useAuthStore from "../../../store/authStore";
import { CHAT_ID, installFixture } from "./fixtures";
import { installSecureFixture } from "./secure-fixtures";

if (location.hostname !== "127.0.0.1" || location.port !== "5194") throw new Error("Synthetic QA runs only on its isolated 127.0.0.1:5194 origin");

const params = new URLSearchParams(location.search);
const language = params.get("lang") === "en" ? "en" : "es";
await i18n.changeLanguage(language);
document.documentElement.lang = language;
useThemeStore.setState({ themeType: params.get("theme") === "dark" ? "dark" : "light" });
const scenario = params.get("scenario");
const fixture = scenario?.startsWith("secure-") ? installSecureFixture(scenario) : installFixture(scenario);
mainInstance.defaults.adapter = fixture.adapter;
useAuthStore.getState().login({ token: "synthetic-qa-not-a-real-credential", user: { id: "90000000991", name: "Synthetic QA" }, expiresAt: Date.now() + 3600000 });
Object.assign(window, { __nodiaAiQa: fixture.controls });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[`/nodia-ai?chat=${CHAT_ID}`]}>
    <MUIProvider><PageContent><NodiaAI /></PageContent></MUIProvider>
  </MemoryRouter></QueryClientProvider>,
);
