import { useState } from "react";
import { Alert, Box, Button, Chip, Typography } from "@mui/material";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
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
import PolicyTable from "../PolicyTable";
import { formatRentalAmount } from "../../utils/money";
import { useAdministrationSubmit } from "../PropertyModal/hooks/useAdministrationSubmit";
import { Content, Panel, PanelGrid, PanelHeader, ArchivePanel } from "./styles";

export type ConfigurationPanelProps = {
  property: RentalProperty;
  onSaved?: () => void;
};
function ConfigurationContent({ property, onSaved }: ConfigurationPanelProps) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState<"details" | "defaults" | null>(null);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [policySelection, setPolicySelection] = useState({
    source: property.default_cancellation_policy_id,
    value: property.default_cancellation_policy_id,
    label: undefined as string | undefined,
  });
  // Reset this selection when the saved default changes, retaining filters
  // and open editors through property revalidation.
  if (policySelection.source !== property.default_cancellation_policy_id) {
    setPolicySelection({
      source: property.default_cancellation_policy_id,
      value: property.default_cancellation_policy_id,
      label: undefined,
    });
  }
  const defaultPolicy = policySelection.value;
  const setDefaultPolicy = (value: string | null, label?: string) =>
    setPolicySelection({
      source: property.default_cancellation_policy_id,
      value,
      label,
    });
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
      if (!owner || busy || mutation.isUncertain) return undefined;
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
      <Box>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 600 }}>
          {t("rental:configuration_view.title")}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {t("rental:configuration_view.subtitle")}
        </Typography>
      </Box>
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
      <PanelGrid>
        <Panel as="section">
          <PanelHeader>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <HomeOutlined color="primary" />
              <Typography variant="h6" component="h3">
                {t("rental:configuration_view.house")}
              </Typography>
            </Box>
            {owner && (
              <Button disabled={disabled} onClick={() => setEditing("details")}>
                {t("rental:configuration_view.edit_details")}
              </Button>
            )}
          </PanelHeader>
          <Typography variant="h5" sx={{ overflowWrap: "anywhere" }}>
            {property.name}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Chip
              size="small"
              label={t(
                property.is_active ? "rental:active" : "rental:inactive",
              )}
              color={property.is_active ? "success" : "default"}
            />
            <Chip
              size="small"
              variant="outlined"
              label={t("rental:configuration_view.guests", {
                count: property.max_guests,
              })}
            />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t("rental:configuration_view.location")}
            </Typography>
            <Typography>
              {property.location ?? t("rental:not_assigned")}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t("rental:configuration_view.timezone")}
            </Typography>
            <Typography>{property.timezone}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t("rental:notes")}
            </Typography>
            <Typography sx={{ whiteSpace: "pre-wrap" }}>
              {property.notes ?? t("rental:not_recorded")}
            </Typography>
          </Box>
        </Panel>
        <Panel as="section">
          <PanelHeader>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TuneOutlined color="primary" />
              <Typography variant="h6" component="h3">
                {t("rental:configuration_view.defaults")}
              </Typography>
            </Box>
            {owner && (
              <Button
                disabled={disabled}
                onClick={() => setEditing("defaults")}
              >
                {t("rental:configuration_view.edit_defaults")}
              </Button>
            )}
          </PanelHeader>
          <Box>
            <Typography color="text.secondary" variant="body2">
              {t("rental:configuration_view.nightly_rate")}
            </Typography>
            <Typography
              variant="h4"
              sx={{
                mt: 1,
                fontVariantNumeric: "tabular-nums",
                overflowWrap: "anywhere",
              }}
            >
              {property.default_nightly_rate === null
                ? t("rental:not_assigned")
                : formatRentalAmount(
                    property.default_nightly_rate,
                    i18n.language,
                  )}
            </Typography>
          </Box>
          <Box component="dl" sx={{ m: 0, display: "grid", gap: 2 }}>
            <Box>
              <Typography component="dt" variant="body2" color="text.secondary">
                {t("rental:configuration_view.deposit")}
              </Typography>
              <Typography component="dd" sx={{ m: 0, fontWeight: 600 }}>
                {property.default_deposit_percent === null
                  ? t("rental:not_assigned")
                  : t("rental:configuration_view.percent", {
                      value: property.default_deposit_percent,
                    })}
              </Typography>
            </Box>
            <Box>
              <Typography component="dt" variant="body2" color="text.secondary">
                {t("rental:configuration_view.turnover")}
              </Typography>
              <Typography component="dd" sx={{ m: 0, fontWeight: 600 }}>
                {t("rental:configuration_view.minutes", {
                  count: property.minimum_turnover_minutes,
                })}
              </Typography>
            </Box>
          </Box>
          <Alert severity="info" sx={{ mt: "auto" }}>
            {t("rental:configuration_future_only")}
          </Alert>
        </Panel>
      </PanelGrid>
      <Panel as="section">
        <Typography variant="h6" component="h3">
          {t("rental:policies")}
        </Typography>
        <Typography color="text.secondary">
          {t("rental:configuration_view.policy_hint")}
        </Typography>
        {defaultRecord.isError && (
          <Alert
            severity="error"
            action={
              <Button
                disabled={busy || defaultRecord.isFetching}
                onClick={() => void defaultRecord.refetch()}
              >
                {t("rental:retry")}
              </Button>
            }
          >
            {t("rental:load_error")}
          </Alert>
        )}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { sm: "end" },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <RentalRemoteSelect
              resource="cancellation-policies"
              propertyId={property.id}
              label={t("rental:default_cancellation_policy")}
              value={defaultPolicy}
              onChange={setDefaultPolicy}
              selectedLabel={
                defaultPolicy === property.default_cancellation_policy_id
                  ? defaultRecord.data?.name
                  : policySelection.label
              }
              query={{ active: "active", limit: 20 }}
              disabled={
                disabled || defaultRecord.isLoading || defaultRecord.isFetching
              }
            />
          </Box>
          {owner && (
            <Button
              variant="contained"
              sx={{
                alignSelf: { xs: "stretch", sm: "flex-end" },
                minHeight: 44,
              }}
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
        </Box>
        <PolicyTable
          property={property}
          disabled={
            busy ||
            mutation.isUncertain ||
            defaultRecord.isLoading ||
            defaultRecord.isFetching
          }
          onDefaultChange={
            owner
              ? (id, name) => {
                  setDefaultPolicy(id, name);
                  void saveDefault(id);
                }
              : undefined
          }
        />
      </Panel>
      <ArchivePanel>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>
            {t(
              property.is_active
                ? "rental:archive_property"
                : "rental:reactivate_property",
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("rental:archive_property_confirm")}
          </Typography>
        </Box>
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
      </ArchivePanel>
      {editing && (
        <PropertyModal
          open
          initialData={property}
          section={editing}
          onClose={() => setEditing(null)}
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
  return <ConfigurationContent key={props.property.id} {...props} />;
}
