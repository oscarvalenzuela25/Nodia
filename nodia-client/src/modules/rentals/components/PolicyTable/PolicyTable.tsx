import { useEffect, useState } from "react";
import { Alert, Button, Chip } from "@mui/material";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import RentalFilters from "../RentalFilters";
import {
  useRentalBusy,
  useRentalList,
  useRentalMutation,
  useRentalRecord,
} from "../../infrastructure/useServices";
import type { RentalPolicy, RentalProperty, RentalQuery } from "../../types";
import RentalTable from "../RentalTable";
import RentalIntentReview from "../RentalIntentReview";
import PolicyModal from "../PolicyModal";
import { useAdministrationSubmit } from "../PropertyModal/hooks/useAdministrationSubmit";
import { Content } from "./styles";

export type PolicyTableProps = { property: RentalProperty };
function PolicyContent({ property }: PolicyTableProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState<RentalQuery>({
    page: 1,
    limit: 10,
    active: "active",
  });
  const listing = useRentalList("cancellation-policies", property.id, query);
  const [modal, setModal] = useState<{ id?: string } | null>(null);
  const [toggling, setToggling] = useState<RentalPolicy | null>(null);
  const detail = useRentalRecord(
    "cancellation-policies",
    property.id,
    modal?.id,
    Boolean(modal?.id),
  );
  const mutation = useRentalMutation(property.id);
  const globalBusy = useRentalBusy(property.id);
  const owner = property.membership.can_manage_configuration;
  const busy =
    globalBusy ||
    listing.isLoading ||
    listing.isFetching ||
    Boolean(modal?.id && (detail.isLoading || detail.isFetching));
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  useEffect(() => {
    const pages = Math.max(1, listing.data?.meta.total_pages ?? page);
    let active = true;
    if (listing.data && page > pages)
      queueMicrotask(() => {
        if (active) setQuery((previous) => ({ ...previous, page: pages }));
      });
    return () => {
      active = false;
    };
  }, [listing.data, page]);
  const toggle = useAdministrationSubmit(
    async (row: RentalPolicy) => {
      if (
        !owner ||
        busy ||
        mutation.isUncertain ||
        row.id === property.default_cancellation_policy_id
      )
        return undefined;
      return mutation.execute({
        operation: "policy.update",
        id: row.id,
        data: { is_active: !row.is_active },
      });
    },
    () => setToggling(null),
  );
  return (
    <Content>
      <RentalFilters
        resource="cancellation-policies"
        property={property}
        query={query}
        onApply={setQuery}
        disabled={busy}
      />
      <RentalTable
        title={t("rental:policies")}
        rows={listing.data?.data ?? []}
        columns={[
          {
            key: "name",
            label: t("rental:name"),
            render: (row: RentalPolicy) => row.name,
          },
          {
            key: "rules",
            label: t("rental:policy_rules"),
            render: (row: RentalPolicy) =>
              row.rules
                .map((rule) =>
                  t("rental:rule_summary", {
                    days: rule.min_days_before,
                    percent: rule.refund_percent,
                  }),
                )
                .join(" · "),
          },
          {
            key: "active",
            label: t("rental:visibility"),
            render: (row: RentalPolicy) => (
              <Chip
                size="small"
                label={t(row.is_active ? "rental:active" : "rental:inactive")}
                color={row.is_active ? "success" : "default"}
              />
            ),
          },
        ]}
        query={listing}
        busy={busy}
        meta={listing.data?.meta}
        page={page}
        limit={limit}
        onPageChange={(next) => setQuery({ ...query, page: next })}
        onLimitChange={(next) => setQuery({ ...query, page: 1, limit: next })}
        search={query.q?.name_cont ?? ""}
        onSearchChange={(search) =>
          setQuery({
            ...query,
            page: 1,
            q: search.trim() ? { name_cont: search.trim() } : undefined,
          })
        }
        onCreate={owner && property.is_active ? () => setModal({}) : undefined}
        actions={(row) => [
          {
            key: "detail",
            label: t(owner ? "rental:edit_policy" : "rental:view_policy"),
            onClick: () => setModal({ id: row.id }),
          },
          ...(owner
            ? [
                {
                  key: "toggle",
                  label: t(
                    row.is_active ? "rental:deactivate" : "rental:activate",
                  ),
                  disabled: row.id === property.default_cancellation_policy_id,
                  onClick: () => setToggling(row),
                },
              ]
            : []),
        ]}
      />
      {modal?.id && detail.isError && (
        <Alert
          severity="error"
          action={
            <Button
              disabled={detail.isFetching}
              onClick={() => void detail.refetch()}
            >
              {t("rental:retry")}
            </Button>
          }
        >
          {t("rental:load_error")}
        </Alert>
      )}
      {modal && (!modal.id || detail.data) && (
        <PolicyModal
          open
          property={property}
          initialData={modal.id ? detail.data : undefined}
          onClose={() => setModal(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(toggling)}
        title={t(toggling?.is_active ? "rental:deactivate" : "rental:activate")}
        message={t("rental:policy_toggle_confirm")}
        onClose={() => {
          if (!busy && !mutation.isUncertain) setToggling(null);
        }}
        onConfirm={() => {
          if (toggling && !busy && owner) return toggle(toggling);
        }}
        isLoading={busy || mutation.isPending || mutation.isUncertain}
        confirmDisabled={!owner}
      >
        <RentalIntentReview
          mutation={mutation}
          onResolved={() => setToggling(null)}
        />
      </ConfirmDialog>
    </Content>
  );
}
export default function PolicyTable(props: PolicyTableProps) {
  return <PolicyContent key={props.property.id} {...props} />;
}
