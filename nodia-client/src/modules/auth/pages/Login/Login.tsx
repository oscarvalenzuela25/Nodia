import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useState } from "react";
import { Button, LinearProgress, Stack, Typography } from "@mui/material";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import envs from "../../../../config/.envs";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import useLogin from "./hooks/useLogin";
import useThemeType from "../../../../hooks/useThemeType";
import {
  Description,
  Page,
  Title,
  Card,
  LogoContainer,
  LogoTitle,
  BackButton,
  GoogleSignInContainer,
} from "./styles";

const Login = () => {
  const { t, i18n } = useTranslation();
  const { themeType } = useThemeType();
  const [scriptFailed, setScriptFailed] = useState(false);
  const [scriptAttempt, setScriptAttempt] = useState(0);
  const navigate = useNavigate();
  const { handleSuccess, handleError, isPending } = useLogin();

  return (
    <Page>
      <Card>
        <LogoContainer>
          <LogoTitle>Nodia</LogoTitle>
        </LogoContainer>
        <Title>{t("auth:login_title")}</Title>
        <Description>{t("auth:login_description")}</Description>
        <GoogleSignInContainer inert={isPending} aria-busy={isPending}>
          {envs.GOOGLE_CLIENT_ID ? (
            <GoogleOAuthProvider
              // The SDK loads its locale only on mount; retry/locale remounts just this boundary.
              key={`${i18n.language}:${scriptAttempt}`}
              clientId={envs.GOOGLE_CLIENT_ID}
              locale={i18n.language}
              onScriptLoadSuccess={() => setScriptFailed(false)}
              onScriptLoadError={() => {
                setScriptFailed(true);
                handleError();
              }}
            >
              {scriptFailed ? (
                <Stack spacing={2} sx={{ width: "100%" }}>
                  <Typography role="status">{t("auth:google_failed")}</Typography>
                  <Button
                    variant="outlined"
                    disabled={isPending}
                    onClick={() => {
                      setScriptFailed(false);
                      setScriptAttempt((attempt) => attempt + 1);
                    }}
                    sx={{ width: { xs: "100%", sm: "auto" }, minHeight: 44, alignSelf: "center" }}
                  >
                    {t("core:retry")}
                  </Button>
                </Stack>
              ) : (
                <GoogleLogin
                  onSuccess={handleSuccess}
                  onError={handleError}
                  theme={themeType === "dark" ? "filled_black" : "outline"}
                  size="large"
                  text="continue_with"
                  shape="pill"
                />
              )}
            </GoogleOAuthProvider>
          ) : <Typography>{t("auth:google_unavailable")}</Typography>}
        </GoogleSignInContainer>
        {isPending && <LinearProgress aria-label={t("auth:signing_in")} sx={{ mt: 2 }} />}
        <BackButton
          type="button"
          variant="text"
          disabled={isPending}
          onClick={() => navigate("/")}
          startIcon={<ArrowBackOutlinedIcon />}
          fullWidth
        >
          {t("auth:back_to_home")}
        </BackButton>
      </Card>
    </Page>
  );
};

export default Login;
