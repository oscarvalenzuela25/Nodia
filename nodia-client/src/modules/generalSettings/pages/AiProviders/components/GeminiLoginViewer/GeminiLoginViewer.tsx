import { Alert, Box, CircularProgress, IconButton, InputAdornment, Typography } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useTranslation } from "react-i18next";
import { useId, useState } from "react";
import TextInput from "../../../../../../components/inputs/TextInput";
import { ScreenButton, ScreenViewport, TextControls, TextLabel, TextHelp, SendTextButton } from "./styles";
import { useLoginViewer } from "./hooks/useLoginViewer";

const GeminiLoginViewer = ({ id }: { id: string }) => {
  const { t } = useTranslation(["ai_providers", "core"]);
  const { text, setText, frame, blocked, send } = useLoginViewer(id);
  const data = frame.data;
  const [showText, setShowText] = useState(false);
  const inputId = useId();
  const helpId = `${inputId}-help`;
  return <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
    <Typography variant="body2">{t("ai_providers:modal_login.viewer_instruction")}</Typography>
    {frame.isError && <Alert severity="error">{t("ai_providers:modal_login.viewer_error")}</Alert>}
    {data?.ready ? <ScreenViewport><ScreenButton type="button" disabled={blocked}
      aria-label={t("ai_providers:modal_login.screen")}
      onClick={(event) => {
        if (event.detail === 0) { void send({ action: "key", key: "Enter" }); return; }
        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        void send({ action: "click", x: Math.min(1279, Math.max(0, Math.floor((event.clientX - rect.left) * 1280 / rect.width))),
          y: Math.min(849, Math.max(0, Math.floor((event.clientY - rect.top) * 850 / rect.height))) });
      }}>
      <img src={`data:image/jpeg;base64,${data.image}`} alt={t("ai_providers:modal_login.screen_alt")} draggable={false} />
    </ScreenButton></ScreenViewport> : <Box role="status" sx={{ minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
      {frame.isFetching && <CircularProgress size={24} />} {t("ai_providers:modal_login.viewer_starting")}
    </Box>}
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <TextLabel htmlFor={inputId}>{t("ai_providers:modal_login.text_label")}</TextLabel>
      <TextControls>
        <TextInput id={inputId} type={showText ? "text" : "password"} value={text} aria-describedby={helpId}
          onChange={(event) => setText(event.target.value.slice(0, 2048))} disabled={blocked}
          endAdornment={<InputAdornment position="end">
            <IconButton type="button" disabled={blocked} aria-pressed={showText}
              aria-label={t(showText ? "ai_providers:modal_login.hide_text" : "ai_providers:modal_login.show_text")}
              onMouseDown={(event) => event.preventDefault()} onClick={() => setShowText((value) => !value)}
              sx={{ width: 44, height: 44 }}>
              {showText ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
            </IconButton>
          </InputAdornment>} />
        <SendTextButton variant="contained" disabled={blocked || !text} onClick={() => void send({ action: "text", text })}>
          {t("ai_providers:modal_login.send_text")}
        </SendTextButton>
      </TextControls>
      <TextHelp id={helpId}>{t("ai_providers:modal_login.text_help")}</TextHelp>
    </Box>
  </Box>;
};
export default GeminiLoginViewer;
