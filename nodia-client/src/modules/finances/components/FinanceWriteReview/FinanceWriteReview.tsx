import { Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ReviewAlert } from "./styles";

type Props = {
  uncertain: boolean;
  busy: boolean;
  onReview: () => Promise<void>;
};
export default function FinanceWriteReview({
  uncertain,
  busy,
  onReview,
}: Props) {
  const { t } = useTranslation();
  if (!uncertain) return null;
  return (
    <ReviewAlert
      severity="info"
      action={
        <Button
          disabled={busy}
          onClick={() => {
            void onReview().catch(() => undefined);
          }}
        >
          {t("finance:review_result")}
        </Button>
      }
    >
      {t("finance:review_before_retry")}
    </ReviewAlert>
  );
}
