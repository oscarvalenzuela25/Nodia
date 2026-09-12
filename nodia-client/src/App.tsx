import { RouterProvider } from "react-router/dom";
import router from "./routes";
import { QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import AppErrorBoundary from "./modules/core/components/AppErrorBoundary";
import { queryClient } from "./config/reactQuery";
import { useTranslation } from "react-i18next";
import { notifyAuthError } from "./services/authFeedback";
import AuthSessionProvider from "./providers/AuthSessionProvider";
import envs from "./config/.envs";
import MUIProvider from "./providers/MUIProvider";

const App = () => {
  const { i18n } = useTranslation();
  const googleClientId = envs.GOOGLE_CLIENT_ID;

  return (
    <AppErrorBoundary>
      <GoogleOAuthProvider
        clientId={googleClientId}
        locale={i18n.language}
        onScriptLoadError={() =>
          notifyAuthError(undefined, "auth:google_failed")
        }
      >
        <QueryClientProvider client={queryClient}>
          <MUIProvider>
            <AuthSessionProvider>
              <RouterProvider router={router} />
            </AuthSessionProvider>
          </MUIProvider>
        </QueryClientProvider>
      </GoogleOAuthProvider>
    </AppErrorBoundary>
  );
};
export default App;
