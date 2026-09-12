import { useMutation } from "@tanstack/react-query";
import { googleLogout } from "@react-oauth/google";
import { sileo } from "sileo";
import { queryClient } from "../../../config/reactQuery";
import useAuthStore from "../../../store/authStore";
import i18n from "../../../translate";
import { notifyAuthError } from "../../../services/authFeedback";
import { loginWithGoogle, logoutSession } from "./services";

export const useGoogleSignIn = () => useMutation({
  mutationFn: loginWithGoogle,
  onSuccess: (session) => {
    useAuthStore.getState().login(session);
    sileo.success({ title: i18n.t("auth:login_success") });
  },
  onError: (error) => notifyAuthError(error),
}, queryClient);

export const useSignOut = () => useMutation({
  mutationFn: async () => {
    useAuthStore.getState().logout();
    googleLogout();
    await logoutSession();
  },
  onSuccess: () => sileo.success({ title: i18n.t("auth:logout_success") }),
  onError: (error) => notifyAuthError(error, "auth:logout_failed"),
}, queryClient);
