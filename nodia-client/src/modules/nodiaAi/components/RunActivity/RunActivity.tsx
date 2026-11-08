import { CircularProgress, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { NodiaAiEvent, NodiaAiRun } from "../../infrastructure/types";
import { Bubble, Content, Identity, MessageRow } from "../ChatMessage/styles";
import { Mark, Step, Steps, Summary } from "./styles";

/** Only public lifecycle events are presented here, never model reasoning. */
export default function RunActivity({ run, events, children }: { run: NodiaAiRun; events: NodiaAiEvent[]; children?: ReactNode }) {
  const { t } = useTranslation("nodiaAi");
  if (!["queued", "running", "waiting_for_user", "cancel_requested"].includes(run.state)) return null;
  const steps = events.filter(event => event.run_id === run.run_id);
  const label = (event: NodiaAiEvent) => {
    switch (event.kind) {
      case "run_changed": return t(`states.${event.payload.state}`);
      case "run_stage_changed": return t("observation.stage", { mode: t(`modes.${event.payload.stage.selection.mode}`) });
      case "tool_completed": return t(`observation.tool_states.${event.payload.state}`);
      case "proposal_ready": return t("proposal.available");
      default: return t(`observation.events.${event.kind}`);
    }
  };
  return <MessageRow isOwner={false} aria-label={t("activity.title")}>
    <Mark aria-hidden="true">N</Mark>
    <Content>
      <Bubble isOwner={false}>
        <Identity><Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>{t("assistant")}</Typography></Identity>
        <Summary role="status" aria-live="polite">
          <CircularProgress size={14} aria-hidden="true" />
          <Typography variant="body2">{t(`states.${run.state}`)}</Typography>
          {steps.length > 0 && <Typography variant="caption" color="text.secondary">{t("activity.steps", { count: steps.length })}</Typography>}
        </Summary>
        {steps.length > 0 && <Steps aria-label={t("activity.steps_label")}>
          {steps.map((event, index) => <Step key={event.event_id} aria-current={index === steps.length - 1 ? "step" : undefined}>
            {label(event)}
          </Step>)}
        </Steps>}
        {children}
      </Bubble>
    </Content>
  </MessageRow>;
}
