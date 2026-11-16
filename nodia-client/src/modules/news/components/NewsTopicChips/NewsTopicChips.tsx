import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { NewsFilters } from "../../types";
import { TopicChip, TopicGroup } from "./styles";

type Props = {
  value: NewsFilters["topic"];
  onChange: (topic: NewsFilters["topic"]) => void;
  disabled?: boolean;
};

const topics = ["all", "technology", "programming", "ai"] as const;

type FocusReturn = {
  button: HTMLButtonElement;
  topic: NewsFilters["topic"];
  wasDisabled: boolean;
};

export default function NewsTopicChips({ value, onChange, disabled = false }: Props) {
  const { t } = useTranslation("news");
  const focusReturn = useRef<FocusReturn | null>(null);

  useLayoutEffect(() => {
    const pending = focusReturn.current;
    if (!pending) return;
    if (pending.topic !== value) {
      focusReturn.current = null;
      return;
    }

    const document = pending.button.ownerDocument;
    if (!disabled) {
      focusReturn.current = null;
      // Native disabled buttons can lose focus to body while the query runs.
      if (pending.wasDisabled && pending.button.isConnected && document.activeElement === document.body) {
        pending.button.focus({ preventScroll: true });
      }
      return;
    }

    pending.wasDisabled = true;
    const cancel = () => { focusReturn.current = null; };
    const changedFocus = (event: FocusEvent) => {
      if (event.target !== pending.button && event.target !== document.body) cancel();
    };
    const changedVisibility = () => { if (document.hidden) cancel(); };
    // Only the pending chip interaction owns these listeners. A new intent wins.
    document.addEventListener("focusin", changedFocus, true);
    document.addEventListener("pointerdown", cancel, true);
    document.addEventListener("keydown", cancel, true);
    document.addEventListener("visibilitychange", changedVisibility);
    document.defaultView?.addEventListener("blur", cancel);
    return () => {
      document.removeEventListener("focusin", changedFocus, true);
      document.removeEventListener("pointerdown", cancel, true);
      document.removeEventListener("keydown", cancel, true);
      document.removeEventListener("visibilitychange", changedVisibility);
      document.defaultView?.removeEventListener("blur", cancel);
    };
  }, [disabled, value]);

  return (
    <TopicGroup role="group" aria-label={t("news:topic")}>
      {topics.map((topic) => (
        <TopicChip
          key={topic}
          type="button"
          variant="outlined"
          disableElevation
          disableRipple
          aria-pressed={value === topic}
          disabled={disabled}
          onClick={(event) => {
            if (topic === value) return;
            const button = event.currentTarget;
            focusReturn.current = button.ownerDocument.activeElement === button
              ? { button, topic, wasDisabled: false }
              : null;
            onChange(topic);
          }}
        >
          {t(`news:topic_${topic}`)}
        </TopicChip>
      ))}
    </TopicGroup>
  );
}
