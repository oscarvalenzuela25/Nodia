import { useState } from "react";
import { Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import BaseModal from "../../../../components/BaseModal";
import type {
  RentalAudit as AuditRecord,
  RentalProperty,
  RentalQuery,
} from "../../types";
import { useRentalBusy, useRentalList } from "../../infrastructure/useServices";
import { formatRentalInstant } from "../../utils/dates";
import RentalTable from "../RentalTable";
import RentalFilters from "../RentalFilters";
import { auditFieldLabel, formatAuditValue } from "./formatChanges";
import { DetailFields } from "./styles";
export type RentalAuditProps = { property: RentalProperty };
function Audit({ property }: RentalAuditProps) {
  const { t, i18n } = useTranslation();
  const globalBusy = useRentalBusy(property.id);
  const [params, setParams] = useState<RentalQuery>({ page: 1, limit: 10 });
  const [detail, setDetail] = useState<AuditRecord>();
  const page = params.page ?? 1,
    limit = params.limit ?? 10;
  const list = useRentalList("audit-events", property.id, params);
  const busy = globalBusy || list.isFetching;
  return (
    <>
      <Typography sx={{ mb: 2 }} color="text.secondary">
        {t("rental:audit_safe_hint")}
      </Typography>
      <RentalFilters
        resource="audit-events"
        property={property}
        query={params}
        onApply={setParams}
        disabled={busy}
      />
      <RentalTable
        title={t("rental:history")}
        rows={list.data?.data ?? []}
        columns={[
          {
            key: "actor",
            label: t("rental:actor"),
            render: (row) => row.actor_id,
          },
          {
            key: "date",
            label: t("rental:created_at"),
            render: (row) =>
              formatRentalInstant(
                row.created_at,
                property.timezone,
                i18n.language,
              ),
          },
          {
            key: "action",
            label: t("rental:action"),
            render: (row) =>
              t(`rental:audit_actions.${row.action.replaceAll(".", "_")}`),
          },
          {
            key: "resource",
            label: t("rental:resource_type"),
            render: (row) => t(`rental:resource_${row.resource_type}`),
          },
          {
            key: "id",
            label: t("rental:resource_id"),
            render: (row) => row.resource_id,
          },
        ]}
        meta={list.data?.meta}
        page={page}
        limit={limit}
        onPageChange={(value) => setParams({ ...params, page: value })}
        onLimitChange={(value) =>
          setParams({ ...params, page: 1, limit: value })
        }
        query={list}
        busy={globalBusy}
        actions={(row) => [
          {
            key: "changes",
            label: t("rental:view_changes"),
            onClick: () => setDetail(row),
          },
        ]}
      />
      <BaseModal
        open={Boolean(detail)}
        title={t("rental:view_changes")}
        onClose={() => setDetail(undefined)}
      >
        <DetailFields>
          {detail && Object.keys(detail.changes).length === 0 && (
            <Typography>{t("rental:empty_changes")}</Typography>
          )}
          {detail &&
            Object.keys(detail.changes).map((key) => (
              <Typography key={key}>
                {auditFieldLabel(key, t)}:{" "}
                {formatAuditValue(detail.changes[key], t)}
              </Typography>
            ))}
        </DetailFields>
      </BaseModal>
    </>
  );
}
export default function RentalAudit(props: RentalAuditProps) {
  return <Audit key={props.property.id} {...props} />;
}
