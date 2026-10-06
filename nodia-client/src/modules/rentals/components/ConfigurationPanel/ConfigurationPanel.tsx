import { useState } from "react";
import { Alert, Button, Chip, Divider, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import {
  useRentalBusy,
  useRentalMutation,
  useRentalRecord,
} from "../../infrastructure/useServices";
import type { RentalProperty } from "../../types";
import RentalRemoteSelect from "../RentalRemoteSelect";
import RentalIntentReview from "../RentalIntentReview";
import PropertyModal from "../PropertyModal";
import { useAdministrationSubmit } from "../PropertyModal/hooks/useAdministrationSubmit";
import { Content, ModalActions } from "./styles";

export type ConfigurationPanelProps = {
  property: RentalProperty;
  onSaved?: () => void;
};
function ConfigurationContent({ property, onSaved }: ConfigurationPanelProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [defaultPolicy, setDefaultPolicy] = useState<string | null>(
    property.default_cancellation_policy_id,
  );
  const mutation = useRentalMutation(property.id);
  const owner = property.membership.can_manage_configuration;
  const globalBusy = useRentalBusy(property.id);
  const defaultRecord = useRentalRecord(
    "cancellation-policies",
    property.id,
    property.default_cancellation_policy_id ?? undefined,
    Boolean(property.default_cancellation_policy_id),
  );
  const busy = globalBusy || mutation.isPending;
  const disabled = busy || mutation.isUncertain || !owner;
  const saveDefault = useAdministrationSubmit(
    async (id: string | null) => {
      if (!owner || mutation.isUncertain) return undefined;
      return mutation.execute({
        operation: "property.update",
        id: property.id,
        data: { default_cancellation_policy_id: id },
      });
    },
    () => onSaved?.(),
  );
  const toggle = useAdministrationSubmit(
    async (value: boolean) => {
      if (!owner || mutation.isUncertain) return undefined;
      return mutation.execute({
        operation: "property.update",
        id: property.id,
        data: { is_active: value },
      });
    },
    () => {
      setToggleOpen(false);
      onSaved?.();
    },
  );
  return (
    <Content>
      <Typography variant="h6">{t("rental:configuration")}</Typography>
      {!toggleOpen && (
        <RentalIntentReview
          mutation={mutation}
          onResolved={() => onSaved?.()}
        />
      )}
      {!owner && <Alert severity="info">{t("rental:owner_only")}</Alert>}
      {!property.is_active && (
        <Alert severity="warning">{t("rental:archived_property")}</Alert>
      )}
      <Typography variant="h5">{property.name}</Typography>
      <Chip
        sx={{ alignSelf: "start" }}
        label={t(property.is_active ? "rental:active" : "rental:inactive")}
        color={property.is_active ? "success" : "default"}
      />
      <Typography>
        {t("rental:property_summary", {
          timezone: property.timezone,
          guests: property.max_guests,
          checkIn: property.check_in_time,
          checkOut: property.check_out_time,
        })}
      </Typography>
      <Typography color="text.secondary">
        {property.location ?? t("rental:not_assigned")}
      </Typography>
      <Typography>
        {t("rental:property_defaults", {
          rate: property.default_nightly_rate ?? t("rental:not_assigned"),
          percent: property.default_deposit_percent ?? t("rental:not_assigned"),
          minutes: property.minimum_turnover_minutes,
        })}
      </Typography>
      {property.notes !== null && (
        <Typography sx={{ whiteSpace: "pre-wrap" }}>
          {property.notes}
        </Typography>
      )}
      <Alert severity="info">{t("rental:configuration_future_only")}</Alert>
      <ModalActions>
        {owner && (
          <Button
            variant="contained"
            disabled={disabled}
            onClick={() => setEditing(true)}
          >
            {t("rental:edit_property")}
          </Button>
        )}
        {owner && (
          <Button
            variant="outlined"
            color={property.is_active ? "warning" : "primary"}
            disabled={disabled}
            onClick={() => setToggleOpen(true)}
          >
            {t(
              property.is_active
                ? "rental:archive_property"
                : "rental:reactivate_property",
            )}
          </Button>
        )}
      </ModalActions>
      <Divider />
      <RentalRemoteSelect
        resource="cancellation-policies"
        propertyId={property.id}
        label={t("rental:default_cancellation_policy")}
        value={defaultPolicy}
        onChange={setDefaultPolicy}
        selectedLabel={defaultRecord.data?.name}
        query={{ active: "active", limit: 20 }}
        disabled={
          disabled || defaultRecord.isLoading || defaultRecord.isFetching
        }
      />
      {owner && (
        <Button
          variant="contained"
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
          disabled={
            disabled ||
            defaultRecord.isLoading ||
            defaultRecord.isFetching ||
            defaultPolicy === property.default_cancellation_policy_id
          }
          onClick={() => void saveDefault(defaultPolicy)}
        >
          {t("rental:save_default_policy")}
        </Button>
      )}
      {editing && (
        <PropertyModal
          open
          initialData={property}
          onClose={() => setEditing(false)}
          onSaved={() => onSaved?.()}
        />
      )}
      <ConfirmDialog
        open={toggleOpen}
        title={t(
          property.is_active
            ? "rental:archive_property"
            : "rental:reactivate_property",
        )}
        message={t("rental:archive_property_confirm")}
        onClose={() => {
          if (!busy && !mutation.isUncertain) setToggleOpen(false);
        }}
        onConfirm={() => {
          if (!disabled) return toggle(!property.is_active);
        }}
        isLoading={busy || mutation.isUncertain}
        confirmDisabled={!owner}
      >
        <RentalIntentReview
          mutation={mutation}
          onResolved={() => {
            setToggleOpen(false);
            onSaved?.();
          }}
        />
      </ConfirmDialog>
    </Content>
  );
}
export default function ConfigurationPanel(props: ConfigurationPanelProps) {
  return (
    <ConfigurationContent
      key={`${props.property.id}:${props.property.default_cancellation_policy_id ?? "none"}`}
      {...props}
    />
  );
}
