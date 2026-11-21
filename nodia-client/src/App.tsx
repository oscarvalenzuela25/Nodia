import { RouterProvider } from "react-router/dom";
import router from "./routes";
import { QueryClientProvider } from "@tanstack/react-query";
import AppErrorBoundary from "./modules/core/components/AppErrorBoundary";
import { queryClient } from "./config/reactQuery";
import MUIProvider from "./providers/MUIProvider";
import ConnectionNotice from "./pwa/ConnectionNotice";
import { useConnectionMonitor } from "./pwa/useConnectionStatus";

const App = () => {
  useConnectionMonitor();
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MUIProvider>
          <ConnectionNotice />
          <RouterProvider router={router} />
        </MUIProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
};
export default App;
