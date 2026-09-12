import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Box, LinearProgress, Typography } from "@mui/material";
import { GoogleLogin } from "@react-oauth/google";
import envs from "../../../../config/.envs";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import useLogin from "./hooks/useLogin";
import {
  Description,
  Page,
  Title,
  Card,
  LogoContainer,
  LogoTitle,
  BackButton,
} from "./styles";

const Login = () => {
  const { t } = useTranslation();
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
        <Box sx={{ display: "flex", justifyContent: "center" }} inert={isPending} aria-busy={isPending}>
          {envs.GOOGLE_CLIENT_ID ? (
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={handleError}
              theme="outline"
              size="large"
              text="continue_with"
              shape="pill"
            />
          ) : <Typography>{t("auth:google_unavailable")}</Typography>}
        </Box>
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
