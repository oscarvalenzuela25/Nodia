import { RouterProvider } from "react-router/dom";
import router from "./routes";
import { QueryClientProvider } from "@tanstack/react-query";
import AppErrorBoundary from "./modules/core/components/AppErrorBoundary";
import { queryClient } from "./config/reactQuery";
import MUIProvider from "./providers/MUIProvider";

const App = () => {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MUIProvider>
          <RouterProvider router={router} />
        </MUIProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
};
export default App;
