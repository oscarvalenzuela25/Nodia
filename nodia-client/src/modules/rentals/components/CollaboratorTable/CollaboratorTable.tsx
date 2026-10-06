import { useEffect, useState } from "react";
import { Chip } from "@mui/material";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import RentalFilters from "../RentalFilters";
import {
  useRentalBusy,
  useRentalList,
  useRentalMutation,
} from "../../infrastructure/useServices";
import type {
  RentalCollaborator,
  RentalProperty,
  RentalQuery,
} from "../../types";
import RentalTable from "../RentalTable";
import RentalIntentReview from "../RentalIntentReview";
import CollaboratorModal from "../CollaboratorModal";
import { useAdministrationSubmit } from "../PropertyModal/hooks/useAdministrationSubmit";
import { Content } from "./styles";

export type CollaboratorTableProps = { property: RentalProperty };
function CollaboratorContent({ property }: CollaboratorTableProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState<RentalQuery>({
    page: 1,
    limit: 10,
    active: "active",
  });
  const listing = useRentalList("collaborators", property.id, query);
  const [modal, setModal] = useState<{ row?: RentalCollaborator } | null>(null);
  const [toggling, setToggling] = useState<RentalCollaborator | null>(null);
  const mutation = useRentalMutation(property.id);
  const globalBusy = useRentalBusy(property.id);
  const owner = property.membership.can_manage_collaborators;
  const busy = globalBusy || listing.isLoading || listing.isFetching;
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
    async (row: RentalCollaborator) => {
      if (
        !owner ||
        busy ||
        mutation.isUncertain ||
        (!row.is_active && !property.is_active)
      )
        return undefined;
      return mutation.execute({
        operation: "collaborator.update",
        id: row.id,
        data: { is_active: !row.is_active },
      });
    },
    () => setToggling(null),
  );
  return (
    <Content>
      <RentalFilters
        resource="collaborators"
        property={property}
        query={query}
        onApply={setQuery}
        disabled={busy}
      />
      <RentalTable
        title={t("rental:tabs.collaborators")}
        rows={listing.data?.data ?? []}
        columns={[
          {
            key: "name",
            label: t("rental:collaborator_user"),
            render: (row: RentalCollaborator) =>
              row.user.name ?? t("rental:unnamed_user", { id: row.user_id }),
          },
          {
            key: "position",
            label: t("rental:position"),
            render: (row: RentalCollaborator) =>
              row.position ?? t("rental:not_assigned"),
          },
          {
            key: "active",
            label: t("rental:visibility"),
            render: (row: RentalCollaborator) => (
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
        search={query.q?.position_cont ?? ""}
        onSearchChange={(search) =>
          setQuery({
            ...query,
            page: 1,
            q: search.trim() ? { position_cont: search.trim() } : undefined,
          })
        }
        onCreate={owner && property.is_active ? () => setModal({}) : undefined}
        actions={
          owner
            ? (row) => [
                {
                  key: "edit",
                  label: t("rental:edit_collaborator"),
                  onClick: () => setModal({ row }),
                },
                {
                  key: "toggle",
                  label: t(
                    row.is_active
                      ? "rental:remove_collaborator"
                      : "rental:reactivate_collaborator",
                  ),
                  disabled: !row.is_active && !property.is_active,
                  onClick: () => setToggling(row),
                },
              ]
            : undefined
        }
      />
      {modal && (
        <CollaboratorModal
          open
          property={property}
          initialData={modal.row}
          onClose={() => setModal(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(toggling)}
        title={t(
          toggling?.is_active
            ? "rental:remove_collaborator"
            : "rental:reactivate_collaborator",
        )}
        message={t("rental:collaborator_toggle_confirm", {
          name: toggling?.user.name ?? "",
        })}
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
export default function CollaboratorTable(props: CollaboratorTableProps) {
  return <CollaboratorContent key={props.property.id} {...props} />;
}
