import { Alert, Button, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import { useRentalList } from "../../infrastructure/useServices";
import RentalRemoteSelect from "../RentalRemoteSelect";
import { SelectorPanel } from "./styles";

export type RentalPropertySelectProps = {
  value: string | null;
  label?: string;
  onChange: (id: string | null) => void;
  onCreate: () => void;
  disabled?: boolean;
};
export default function RentalPropertySelect({
  value,
  label,
  onChange,
  onCreate,
  disabled = false,
}: RentalPropertySelectProps) {
  const { t } = useTranslation();
  const query = useRentalList("properties", undefined, {
    active: "all",
    page: 1,
    limit: 1,
  });
  const busy = disabled || query.isFetching;
  return (
    <SelectorPanel>
      <RentalRemoteSelect
        resource="properties"
        label={t("rental:select_property")}
        selectedLabel={label}
        value={value}
        onChange={onChange}
        query={{ active: "all" }}
        disabled={busy}
      />
      <Button variant="outlined" disabled={busy} onClick={onCreate}>
        {t("rental:create_property")}
      </Button>
      {query.isError && (
        <Alert
          severity="error"
          action={
            <Button disabled={busy} onClick={() => void query.refetch()}>
              {t("rental:retry")}
            </Button>
          }
        >
          {t("rental:load_error")}
        </Alert>
      )}
      {!value && (
        <Skeleton loading={query.isLoading}>
          <Typography color="text.secondary">
            {query.data?.meta.total_items === 0
              ? t("rental:property_empty")
              : t("rental:select_property_help")}
          </Typography>
        </Skeleton>
      )}
    </SelectorPanel>
  );
}
