// Synthetic browser-only harness. No production route imports this file.
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Alert, Box, Button, Typography } from "@mui/material";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import ReportObservation from "../../../modules/nodiaAi/components/ReportObservation";
import { mainInstance } from "../../../config/api";
import useAuthStore from "../../../store/authStore";
import useThemeStore from "../../../store/configStore";
import i18n from "../../../translate";
import { report } from "../../modules/nodiaAi/infrastructure/reportFixtures";
import { toolRef } from "../../modules/nodiaAi/infrastructure/observationFixtures";
import { nodiaAiReportSchema } from "../../../modules/nodiaAi/infrastructure/reportSchemas";

if (location.origin !== "http://127.0.0.1:5195") throw new Error("AI-31 synthetic QA requires isolated http://127.0.0.1:5195");
const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
useThemeStore.setState({ themeType: params.get("theme") === "dark" ? "dark" : "light" });
const ref = { ...toolRef, tool_name: "nodia_reports_run" };
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
let outcome: "ok" | "transport" | "denied" = "ok";
let data = structuredClone(report);
if (params.get("scenario") === "compare") {
  const first = { ...data.source_results[0], source_key: "rental_expenses", source_alias: "casa_a", scope: { property_id: "101" }, basis_key: "incurred_on", group_page_complete: true, next_cursor: null,
    columns: data.source_results[0].columns.map(column => ({ ...column, unit: column.key === "total" ? "CLP" : null, source_aliases: ["casa_a"] })) };
  const second = { ...first, report_id: data.report_id, source_alias: "casa_b", scope: { property_id: "102" }, observed_at: "2026-10-17T12:01:04Z", totals: { total: "0" }, rows: [[null, "0"]], columns: first.columns.map(column => ({ ...column, source_aliases: ["casa_b"] })) };
  data = { ...data, status: "ok", combine: "compare_compatible", source_errors: [], source_results: [first, second], group_page_complete: true, next_cursor: null,
    provenance: [first, second].map(source => ({ source_alias: source.source_alias, source_key: source.source_key, observed_at: source.observed_at, scope: source.scope, measure_keys: ["amount"], period: null, basis_key: source.basis_key, matched_records: source.matched_records })),
    columns: [{ ...first.columns[0], key: "group.0", source_aliases: ["casa_a", "casa_b"] }, { ...first.columns[1], key: "casa_a.total" }, { ...second.columns[1], key: "casa_b.total" }], rows: [[null, "0", "0"], ["Food", "90071992547409930", null]] };
}
data = nodiaAiReportSchema.parse(data);
mainInstance.defaults.adapter = async config => {
  if (config.method !== "get" || config.url !== `/nodia-ai/tool-calls/${ref.tool_call_id}/result`) throw new Error("AI-31 QA blocks every other request");
  if (outcome === "transport") throw new AxiosError("Synthetic transport unavailable", "ERR_NETWORK", config);
  if (outcome === "denied") throw new AxiosError("Synthetic access revoked", "ERR_BAD_REQUEST", config, undefined, { config, data: {}, headers: {}, status: 403, statusText: "Forbidden" });
  return { config, data: structuredClone(data), status: 200, statusText: "OK", headers: {} };
};
useAuthStore.getState().login({ token: "synthetic-qa-only", user: { id: "9", name: "Synthetic QA" }, expiresAt: Date.now() + 3600000 });
const refresh = (next: typeof outcome) => { outcome = next; void client.invalidateQueries(); };
export function Metrics() {
  const [metrics, setMetrics] = useState("");
  useEffect(() => {
    const measure = () => {
      const panels = [...document.querySelectorAll<HTMLElement>('[aria-label="Informe de NodiaAI"], [aria-label="NodiaAI report"]')];
      const tables = [...document.querySelectorAll<HTMLElement>('[role="region"]')].map(node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
      const overflow = panels.flatMap(panel => [...panel.querySelectorAll<HTMLElement>("*")].filter(node => node.clientWidth > document.documentElement.clientWidth).slice(0, 8).map(node => `${node.tagName}:${node.clientWidth}`));
      const next = JSON.stringify({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, tables, overflow });
      setMetrics(previous => previous === next ? previous : next);
      window.parent.postMessage({ kind: "ai31-layout", metrics: next }, location.origin);
    };
    const observer = new ResizeObserver(measure); observer.observe(document.documentElement); observer.observe(document.body);
    const mutation = new MutationObserver(measure); mutation.observe(document.body, { childList: true, subtree: true });
    measure();
    return () => { observer.disconnect(); mutation.disconnect(); };
  }, []);
  return <Typography component="output" sx={{ display: "block", overflowWrap: "anywhere", fontSize: 12, my: 1 }}>QA layout: {metrics}</Typography>;
}
export function Harness() {
  return <MUIProvider><Box sx={{ p: { xs: 2, sm: 3, md: 4 }, width: "100%", maxWidth: 1100, mx: "auto", minWidth: 0 }}>
    <Typography component="h1" variant="h5">AI-31 · Synthetic QA only</Typography>
    <Alert severity="info" sx={{ my: 2 }}>Synthetic data. No real API, database or provider calls. Dedicated isolated origin.</Alert>
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
      <Button onClick={() => refresh("ok")}>Restore / Refresh</Button>
      <Button onClick={() => refresh("transport")}>Transport failure</Button>
      <Button onClick={() => refresh("denied")}>Revoke access</Button>
      <Button onClick={() => useThemeStore.getState().handleToggleThemeType()}>Toggle theme</Button>
    </Box>
    <ReportObservation resultRef={ref} />
    <Metrics />
  </Box></MUIProvider>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
