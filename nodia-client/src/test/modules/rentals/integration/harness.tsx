import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../../../config/reactQuery";
import useAuthStore from "../../../../store/authStore";
import Harness from "./HarnessApp";
// A stable bootstrap keeps Fast Refresh from creating a second React root.
useAuthStore.getState().logout();
const host = document.getElementById("root");
if (!host) throw new Error("Missing QA host");
const root = createRoot(host);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
root.render(
  <QueryClientProvider client={queryClient}>
    <Harness />
  </QueryClientProvider>,
);
