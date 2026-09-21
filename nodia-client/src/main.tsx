import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "sileo/styles.css";
import "./styles/main.css";
import "./translate";
import App from "./App.tsx";

// Suppress benign browser extension messaging errors that pollute the console
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const errorMessage =
      typeof reason === "string"
        ? reason
        : reason?.message || reason?.stack || "";

    if (
      errorMessage.includes(
        "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received"
      )
    ) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
