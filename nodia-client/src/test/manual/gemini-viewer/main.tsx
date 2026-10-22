// Synthetic visual fixture. No authentication, credentials or provider HTTP requests.
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Box, Typography } from "@mui/material";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import GeminiLoginViewer from "../../../modules/generalSettings/pages/AiProviders/components/GeminiLoginViewer";
import { mainInstance } from "../../../config/api";
import config from "../../../store/configStore";
import i18n from "../../../translate";

const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
config.setState({ themeType: params.get("theme") === "light" ? "light" : "dark" });
// Separate QA origin and offline adapter; never alter the operational auth store.
mainInstance.defaults.skipAuth = true;
const canvas = document.createElement("canvas");
canvas.width = 1280; canvas.height = 850;
const drawing = canvas.getContext("2d")!;
drawing.fillStyle = "#e9edf4"; drawing.fillRect(0, 0, 1280, 850);
drawing.fillStyle = "#fff"; drawing.fillRect(240, 230, 800, 390);
drawing.fillStyle = "#243145"; drawing.font = "36px sans-serif";
drawing.fillText("Pantalla sintética — sin cuenta Google", 290, 300);
drawing.strokeStyle = "#536580"; drawing.strokeRect(290, 350, 700, 70);
drawing.font = "24px sans-serif"; drawing.fillText("Campo de prueba", 310, 395);
const id = "a".repeat(32);
const frame = { ready: true, frame_id: "b".repeat(32), image: canvas.toDataURL("image/jpeg").split(",")[1], width: 1280, height: 850 };
mainInstance.defaults.adapter = async request => {
  const path = request.url ?? "";
  if (!path.endsWith(`/gemini-login/${id}/frame`) && !path.endsWith(`/gemini-login/${id}/input`)) {
    throw new Error("Unexpected synthetic QA request");
  }
  return { config: request, data: path.endsWith("/frame") ? frame : { id, state: "running" }, status: 200, statusText: "OK", headers: {} };
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><MUIProvider>
  <Box sx={{ maxWidth: 960, mx: "auto", p: { xs: 2, sm: 3, md: 4 } }}>
    <Typography variant="caption" sx={{ display: "block", mb: 2 }}>QA SINTÉTICO · Sin conexión a Google ni sesión real</Typography>
    <GeminiLoginViewer id={id} />
  </Box>
</MUIProvider></QueryClientProvider>);
