import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { ReviewList, ReviewRow } from "./styles";
export type SameDayRequirement = {
  incoming_reservation_id: string | null;
  turnover_id: string | null;
  needs_approval: boolean;
  plan_valid: boolean;
};
export type SameDayReviewProps = {
  requirements: SameDayRequirement[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onOpenTurnover: (id: string) => void;
  disabled?: boolean;
};
export default function SameDayReview({
  requirements,
  selected,
  onChange,
  onOpenTurnover,
  disabled = false,
}: SameDayReviewProps) {
  const { t } = useTranslation();
  return (
    <ReviewList>
      <Alert severity="info">{t("rental:same_day_explanation")}</Alert>
      {requirements.length === 0 && (
        <Typography>{t("rental:no_same_day_requirements")}</Typography>
      )}
      {requirements.map((requirement, index) => (
        <ReviewRow
          key={
            requirement.turnover_id ??
            `unsaved-${requirement.incoming_reservation_id ?? index}`
          }
        >
          <Typography>
            {t("rental:incoming_transition", {
              id: requirement.incoming_reservation_id ?? t("rental:unsaved"),
            })}
          </Typography>
          {!requirement.plan_valid && (
            <Typography color="warning.main">
              {t("rental:prospective_plan_warning")}
            </Typography>
          )}
          {requirement.turnover_id ? (
            <>
              <Button
                disabled={disabled}
                onClick={() => onOpenTurnover(requirement.turnover_id!)}
              >
                {t("rental:review_preparation")}
              </Button>
              {requirement.needs_approval && (
                <FormControlLabel
                  label={t("rental:consent_same_day", {
                    id: requirement.turnover_id,
                  })}
                  control={
                    <Checkbox
                      disabled={disabled}
                      checked={selected.includes(requirement.turnover_id)}
                      onChange={(_, checked) =>
                        onChange(
                          checked
                            ? [
                                ...new Set([
                                  ...selected,
                                  requirement.turnover_id!,
                                ]),
                              ]
                            : selected.filter(
                                (id) => id !== requirement.turnover_id,
                              ),
                        )
                      }
                    />
                  }
                />
              )}
              {!requirement.needs_approval && (
                <Typography>{t("rental:approval_not_required")}</Typography>
              )}
            </>
          ) : (
            <Typography>{t("rental:save_draft_before_review")}</Typography>
          )}
        </ReviewRow>
      ))}
    </ReviewList>
  );
}
