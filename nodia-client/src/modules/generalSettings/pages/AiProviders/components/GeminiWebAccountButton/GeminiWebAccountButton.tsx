import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import ConfirmDialog from "../../../../../../components/ConfirmDialog";
import { notifyHttpError } from "../../../../../../config/httpFeedback";
import { useDisconnectGeminiWeb } from "../../infrastructure/useServices";
import { ChangeAccountButton } from "./styles";

type Props = { disabled: boolean; onLogin: () => void };

const GeminiWebAccountButton = ({ disabled, onLogin }: Props) => {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const disconnect = useDisconnectGeminiWeb();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const changeAccount = async () => {
    try {
      await disconnect.mutateAsync();
      sileo.success({ title: t("ai_providers:web_account.disconnected") });
      if (mounted.current) {
        setConfirmOpen(false);
        onLogin();
      }
    } catch (error) {
      notifyHttpError(error);
    }
  };

  return <>
    <ChangeAccountButton variant="outlined" disabled={disabled || disconnect.isPending} onClick={() => setConfirmOpen(true)}>
      {t("ai_providers:web_account.change")}
    </ChangeAccountButton>
    {confirmOpen && <ConfirmDialog open onClose={() => setConfirmOpen(false)} onConfirm={() => void changeAccount()}
      title={t("ai_providers:web_account.confirm_title")}
      message={t("ai_providers:web_account.confirm_message")}
      confirmText={t("ai_providers:web_account.confirm_action")} isLoading={disconnect.isPending} confirmDisabled={disabled} />}
  </>;
};

export default GeminiWebAccountButton;
