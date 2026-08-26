import { RouterProvider } from "react-router/dom";
import router from "./routes";
import { QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import AppErrorBoundary from "./modules/core/components/AppErrorBoundary";
import { queryClient } from "./config/reactQuery";
import MUIProvider from "./providers/MUIProvider";

const App = () => {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "TU_CLIENT_ID_DE_GOOGLE";

  return (
    <AppErrorBoundary>
      <GoogleOAuthProvider clientId={googleClientId}>
        <QueryClientProvider client={queryClient}>
          <MUIProvider>
            <RouterProvider router={router} />
          </MUIProvider>
        </QueryClientProvider>
      </GoogleOAuthProvider>
    </AppErrorBoundary>
  );
};
export default App;
