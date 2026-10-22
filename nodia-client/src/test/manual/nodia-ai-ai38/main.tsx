// Test entry only: production components, normal Axios XHR, disposable SQL.
// The fixture identity is synthetic. No production route imports this file.
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { z } from "zod";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import { PageContent } from "../../../layouts/BaseLayout/styles";
import NodiaAI from "../../../modules/nodiaAi/pages/NodiaAI";
import PersonalFinance from "../../../modules/finances/pages/PersonalFinance";
import ProposalPreview from "../../../modules/nodiaAi/components/ProposalPreview";
import { useNodiaAiConversation } from "../../../modules/nodiaAi/infrastructure/useServices";
import { mainInstance } from "../../../config/api";
import { queryClient } from "../../../config/reactQuery";
import useAuthStore from "../../../store/authStore";
import useThemeStore from "../../../store/configStore";
import useGeneralSettingsStore from "../../../store/generalSettings/generalSettingsStore";
import i18n from "../../../translate";

if (location.origin !== "http://127.0.0.1:5177")
  throw new Error("AI-38 acceptance requires its isolated loopback origin");
const manifestSchema = z.object({
  conversation_id: z.uuid(),
  proposal: z.object({ proposal_id: z.uuid(), revision: z.number().int().positive(), hash: z.string().regex(/^[a-f0-9]{64}$/) }),
}).passthrough();
const response = await fetch("/__ai38/manifest");
if (!response.ok) throw new Error("AI-38 disposable backend unavailable");
const manifest = manifestSchema.parse(await response.json());
const params = new URLSearchParams(location.search);
const view = params.get("view") ?? "review";
const actor = params.get("actor") === "2" ? "2" : params.get("actor") === "3" ? "3" : "1";
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
useThemeStore.setState({ themeType: params.get("theme") === "light" ? "light" : "dark" });
// No response adapter, cached fixture response or fetch interception is installed.
mainInstance.defaults.baseURL = "/api/v1";
mainInstance.defaults.headers.common["x-fixture-actor"] = actor;
useAuthStore.getState().login({ token: "synthetic-ai38-not-a-real-credential", user: { id: actor, name: "Synthetic AI38" }, expiresAt: Date.now() + 3600000 });
useGeneralSettingsStore.setState({ isLoaded: true, roles: actor === "3" ? ["super_admin"] : [], modules: [], actions: [] });
const route = view === "finance" ? "/tools/finances-personal?tab=movements" : `/tools/nodia-ai?chat=${manifest.conversation_id}`;
export const ReviewFixture = () => {
  // Match the real page's authoritative chat observer. Execution controls stay
  // read-only until the real HTTP detail query confirms the owner and access.
  useNodiaAiConversation(manifest.conversation_id);
  return <ProposalPreview conversationId={manifest.conversation_id} proposalRef={manifest.proposal} visible />;
};
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[route]}><MUIProvider><PageContent>
    {view === "finance" ? <PersonalFinance /> : view === "chat" ? <NodiaAI /> :
      <ReviewFixture />}
  </PageContent></MUIProvider></MemoryRouter></QueryClientProvider>,
);
