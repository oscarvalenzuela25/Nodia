import { RouterProvider } from "react-router/dom";
import router from "./routes";
import { QueryClientProvider } from "@tanstack/react-query";
import AppErrorBoundary from "./modules/core/components/AppErrorBoundary";
import { queryClient } from "./config/reactQuery";
import AuthSessionProvider from "./providers/AuthSessionProvider";
import MUIProvider from "./providers/MUIProvider";

const App = () => {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MUIProvider>
          <AuthSessionProvider>
            <RouterProvider router={router} />
          </AuthSessionProvider>
        </MUIProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
};
export default App;
