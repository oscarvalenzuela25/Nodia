import type { FC } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, Button, Alert, CircularProgress } from "@mui/material";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import BaseModal from "../../../../../../components/BaseModal";
import { sileo } from "sileo";

interface RemoteLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const RemoteLoginModal: FC<RemoteLoginModalProps> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation(["ai_providers", "core"]);
  const [isLaunching, setIsLaunching] = useState(false);

  const handleLaunchLogin = async () => {
    setIsLaunching(true);
    try {
      // Connect to Gemini microservice. Try 127.0.0.1 to avoid Windows IPv6 localhost issues, fallback to localhost.
      let response: Response;
      try {
        response = await fetch("http://127.0.0.1:8000/auth/login", {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        });
      } catch {
        response = await fetch("http://localhost:8000/auth/login", {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        });
      }

      if (response.ok) {
        sileo.success({
          title: t("ai_providers:modal_login.status_success", "Sesión renovada exitosamente."),
        });
        onSuccess?.();
        onClose();
      } else {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail || data?.message || "No se pudo iniciar la sesión remota");
      }
    } catch (error: any) {
      sileo.error({
        title: t("ai_providers:modal_login.error_title", "Error al iniciar sesión de navegador"),
        description:
          error?.message ||
          t(
            "ai_providers:modal_login.error_desc",
            "Asegúrese de que el microservicio de Gemini esté ejecutándose."
          ),
      });
    } finally {
      setIsLaunching(false);
    }
  };

  const modalActions = (
    <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end", width: "100%" }}>
      <Button
        variant="outlined"
        color="inherit"
        onClick={onClose}
        disabled={isLaunching}
        sx={{ borderRadius: 2 }}
      >
        {t("ai_providers:modal_login.close", "Cerrar")}
      </Button>
      <Button
        variant="contained"
        color="primary"
        startIcon={isLaunching ? <CircularProgress size={16} color="inherit" /> : <OpenInNewOutlinedIcon />}
        onClick={handleLaunchLogin}
        disabled={isLaunching}
        sx={{ borderRadius: 2, px: 2.5 }}
      >
        {isLaunching
          ? t("ai_providers:modal_login.status_pending", "Esperando autenticación...")
          : t("ai_providers:modal_login.open_browser", "Iniciar Navegador Remoto")}
      </Button>
    </Box>
  );

  return (
    <BaseModal
      open={open}
      onClose={isLaunching ? () => {} : onClose}
      title={t("ai_providers:modal_login.title", "Renovación de Sesión de Navegador Remoto")}
      size="sm"
      actions={modalActions}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "primary.main",
              color: "primary.contrastText",
            }}
          >
            <DevicesOutlinedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Google Gemini Web Session
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Playwright / Chrome Headless Daemon
            </Typography>
          </Box>
        </Box>

        <Alert severity="info" sx={{ borderRadius: 1.5 }}>
          {t(
            "ai_providers:modal_login.description",
            "Se abrirá una sesión visible interactiva en el servidor para completar el login en Google de forma segura."
          )}
        </Alert>

        <Typography variant="body2" color="text.secondary">
          {t(
            "ai_providers:modal_login.instruction",
            "Escriba sus credenciales directamente en el navegador del host. Las cookies se guardarán automáticamente."
          )}
        </Typography>
      </Box>
    </BaseModal>
  );
};

export default RemoteLoginModal;
