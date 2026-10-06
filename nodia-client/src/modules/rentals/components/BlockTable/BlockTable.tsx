import { useState } from "react";
import { useTranslation } from "react-i18next";
import RentalFilters from "../RentalFilters";
import type { RentalBlock, RentalProperty, RentalQuery } from "../../types";
import { useRentalList, useRentalBusy } from "../../infrastructure/useServices";
import { formatRentalInstant } from "../../utils/dates";
import RentalTable from "../RentalTable";
import { Wrapper } from "./styles";
export type BlockTableProps = {
  property: RentalProperty;
  onEdit: (block: RentalBlock) => void;
  onCreate: () => void;
};
export default function BlockTable({
  property,
  onEdit,
  onCreate,
}: BlockTableProps) {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useState<RentalQuery>({
    page: 1,
    limit: 10,
    active: "active",
  });
  const page = params.page ?? 1,
    limit = params.limit ?? 10,
    search = params.q?.reason_cont ?? "";
  const update = (changes: Partial<RentalQuery>) =>
    setParams((previous) => ({ ...previous, ...changes }));
  const query = useRentalList("blocks", property.id, params);
  const busy = useRentalBusy(property.id);
  return (
    <Wrapper>
      <RentalFilters
        resource="blocks"
        property={property}
        query={params}
        onApply={setParams}
        disabled={busy}
      />
      <RentalTable
        title={t("rental:manage_blocks")}
        busy={busy}
        rows={query.data?.data ?? []}
        query={query}
        meta={query.data?.meta}
        page={page}
        limit={limit}
        onPageChange={(value) => update({ page: value })}
        onLimitChange={(value) => update({ page: 1, limit: value })}
        search={search}
        onSearchChange={(value) =>
          update({ page: 1, q: value ? { reason_cont: value } : undefined })
        }
        onCreate={property.is_active ? onCreate : undefined}
        columns={[
          { key: "reason", label: t("rental:reason"), render: (r) => r.reason },
          {
            key: "start",
            label: t("rental:starts_at"),
            render: (r) =>
              formatRentalInstant(
                r.starts_at,
                property.timezone,
                i18n.language,
              ),
          },
          {
            key: "end",
            label: t("rental:ends_at"),
            render: (r) =>
              formatRentalInstant(r.ends_at, property.timezone, i18n.language),
          },
          {
            key: "active",
            label: t("rental:active"),
            render: (r) => t(r.is_active ? "rental:active" : "rental:inactive"),
          },
        ]}
        actions={(r) => [
          { key: "edit", label: t("rental:edit"), onClick: () => onEdit(r) },
        ]}
      />
    </Wrapper>
  );
}
