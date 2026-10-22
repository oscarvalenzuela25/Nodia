import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import { notifyHttpError } from "../../../../../../../config/httpFeedback";
import { useGeminiLoginFrame, useSendGeminiLoginInput } from "../../../infrastructure/useServices";
import type { GeminiLoginAction } from "../../../infrastructure/webLogin";

export const useLoginViewer = (id: string) => {
  const { t } = useTranslation("ai_providers");
  const [text, setText] = useState("");
  const input = useSendGeminiLoginInput();
  const frame = useGeminiLoginFrame(id, Boolean(text) || input.isPending);
  const busy = useRef(false);
  const notifiedError = useRef(false);
  const data = frame.data;
  const blocked = input.isPending || frame.isFetching || frame.isError || !data?.ready;
  useEffect(() => {
    if (frame.isSuccess) notifiedError.current = false;
    if (frame.error && !notifiedError.current) {
      notifiedError.current = true;
      notifyHttpError(frame.error);
    }
  }, [frame.error, frame.isSuccess]);

  const send = async (command: GeminiLoginAction) => {
    if (blocked || busy.current || !data?.ready) return;
    busy.current = true;
    try {
      await input.mutateAsync({ id, input: { ...command, frame_id: data.frame_id } });
      if (command.action === "text") setText("");
      sileo.success({ title: t("modal_login.action_sent") });
    } catch (error) {
      notifyHttpError(error);
    } finally {
      input.reset(); // No credentials remain in the mutation cache.
      await frame.refetch(); // Review the result; never replay a command automatically.
      busy.current = false;
    }
  };
  return { text, setText, frame, blocked, send, busy: input.isPending };
};
