import { useRef } from "react";
import { useNavigate } from "react-router";
import type { CredentialResponse } from "@react-oauth/google";
import { isAxiosError } from "axios";
import { useGoogleSignIn } from "../../../infrastructure/useServices";
import { notifyAuthError } from "../../../../../services/authFeedback";

const useLogin = () => {
  const navigate = useNavigate();
  const mutation = useGoogleSignIn();
  const submitting = useRef(false);
  const handleError = () => notifyAuthError(undefined, "auth:google_failed");
  const handleSuccess = ({ credential }: CredentialResponse) => {
    if (!credential) { handleError(); return; }
    if (submitting.current) return;
    submitting.current = true;
    mutation.mutate(credential, {
      onSettled: () => { submitting.current = false; },
      onSuccess: () => navigate("/", { replace: true }),
      onError: (error) => {
        if (isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) {
          navigate("/", { replace: true });
        }
      },
    });
  };
  return { handleSuccess, handleError, isPending: mutation.isPending };
};

export default useLogin;
