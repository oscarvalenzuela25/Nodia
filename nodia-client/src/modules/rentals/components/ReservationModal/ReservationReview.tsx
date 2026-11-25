import { Button, Typography } from "@mui/material";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Temporal } from "temporal-polyfill";
import { isCivilDate, isLocalTime } from "../../utils/dates";
import type { ReservationForm } from "./schema";
import { FieldGrid, ReviewGroup, ReviewSummary, ReviewValues } from "./styles";

type Props = {
  values: Partial<ReservationForm>;
  nights?: number;
  disabled: boolean;
  onEditStay: () => void;
  onEditGuest: () => void;
};

export default function ReservationReview({
  values,
  nights,
  disabled,
  onEditStay,
  onEditGuest,
}: Props) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const dateLabel = (day: string | undefined, time: string | undefined) => {
    if (!isCivilDate(day) || !isLocalTime(time)) return undefined;
    const date = Temporal.PlainDate.from(day).toLocaleString(i18n.language, {
      dateStyle: "medium",
    });
    return (
      <time dateTime={`${day}T${time}`}>
        {date} · {time}
      </time>
    );
  };
  return (
    <ReviewSummary aria-labelledby={titleId}>
      <Typography id={titleId} component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
        {t("rental:wizard_review")}
      </Typography>
      <FieldGrid>
        <ReviewGroup>
          <Typography component="h4" variant="subtitle2">
            {t("rental:wizard_stay")}
          </Typography>
          <ReviewValues>
            <div>
              <dt>{t("rental:check_in_on")}</dt>
              <dd>{dateLabel(values.check_in_on, values.check_in_time)}</dd>
            </div>
            <div>
              <dt>{t("rental:check_out_on")}</dt>
              <dd>{dateLabel(values.check_out_on, values.check_out_time)}</dd>
            </div>
            <div>
              <dt>{t("rental:nights")}</dt>
              <dd>{nights}</dd>
            </div>
          </ReviewValues>
          <Button size="small" variant="outlined" onClick={onEditStay} disabled={disabled}>
            {t("rental:wizard_edit_stay")}
          </Button>
        </ReviewGroup>
        <ReviewGroup>
          <Typography component="h4" variant="subtitle2">
            {t("rental:wizard_guest")}
          </Typography>
          <ReviewValues>
            <div>
              <dt>{t("rental:guest_name")}</dt>
              <dd>{values.guest_name}</dd>
            </div>
            <div>
              <dt>{t("rental:guests_count")}</dt>
              <dd>{values.guests_count}</dd>
            </div>
            <div>
              <dt>{t("rental:channel")}</dt>
              <dd>{values.channel && t(`rental:channel_${values.channel}`)}</dd>
            </div>
          </ReviewValues>
          <Button size="small" variant="outlined" onClick={onEditGuest} disabled={disabled}>
            {t("rental:wizard_edit_guest")}
          </Button>
        </ReviewGroup>
      </FieldGrid>
    </ReviewSummary>
  );
}
