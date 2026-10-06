import { Alert, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { RentalAck } from "../../types";
import type { RentalMutation } from "../../infrastructure/useServices";
import { ReviewActions } from "./styles";
export default function RentalIntentReview({
  mutation,
  onResolved,
}: {
  mutation: RentalMutation;
  onResolved?: (ack: RentalAck) => void;
}) {
  const { t } = useTranslation();
  if (!mutation.isUncertain) return null;
  const resolve = async (recovery: boolean) => {
    const ack = await (recovery ? mutation.recover() : mutation.retry());
    if (ack) onResolved?.(ack);
  };
  return (
    <Alert severity="warning" role="alert">
      {t("rental:uncertain_result")}
      <ReviewActions>
        <Button
          disabled={mutation.isPending}
          onClick={() => void resolve(true)}
        >
          {t("rental:recover")}
        </Button>
        <Button
          disabled={mutation.isPending}
          onClick={() => void resolve(false)}
        >
          {t("rental:retry_same_intent")}
        </Button>
      </ReviewActions>
    </Alert>
  );
}
