import { useState } from "react";
import { useSearchParams } from "react-router";
import { Alert, Box, Button, Tab, Tabs } from "@mui/material";
import { useTranslation } from "react-i18next";
import type {
  RentalBlock,
  RentalProperty,
  RentalReservation,
} from "../../types";
import {
  useRentalBusy,
  useRentalRecord,
} from "../../infrastructure/useServices";
import BaseModal from "../../../../components/BaseModal";
import RentalOverview from "../RentalOverview";
import RentalCalendar from "../RentalCalendar";
import ReservationTable from "../ReservationTable";
import ReservationModal from "../ReservationModal";
import ReservationDetail from "../ReservationDetail";
import ReservationConfirm from "../ReservationConfirm";
import ReservationCancel from "../ReservationCancel";
import ReservationStayActions from "../ReservationStayActions";
import BlockTable from "../BlockTable";
import BlockModal from "../BlockModal";
import TurnoverTable from "../TurnoverTable";
import TurnoverModal from "../TurnoverModal";
import PaymentTable from "../PaymentTable";
import ExpenseTable from "../ExpenseTable";
import CollaboratorTable from "../CollaboratorTable";
import ConfigurationPanel from "../ConfigurationPanel";
import PolicyTable from "../PolicyTable";
import RentalAudit from "../RentalAudit";
import { RentalAccessContext } from "../../infrastructure/scope";
import { WorkspaceStack, WorkspaceAction } from "./styles";

const TABS = [
  "general",
  "calendar",
  "reservations",
  "turnovers",
  "expenses",
  "collaborators",
  "configuration",
] as const;
type RentalTab = (typeof TABS)[number];
type Modal =
  | { kind: "payments"; reservationId?: string }
  | { kind: "audit" }
  | { kind: "detail" | "turnover"; id: string }
  | { kind: "edit"; id: string; initialData?: RentalReservation }
  | { kind: "block_edit"; id: string; initialData?: RentalBlock }
  | { kind: "new" | "block_new" }
  | {
      kind: "confirm" | "cancel" | "start" | "complete";
      row: RentalReservation;
    };
export default function RentalWorkspace({
  property,
  accessible = true,
}: {
  property: RentalProperty;
  accessible?: boolean;
}) {
  return (
    <RentalAccessContext.Provider value={accessible}>
      <Workspace property={property} />
    </RentalAccessContext.Provider>
  );
}
function Workspace({ property }: { property: RentalProperty }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((value) => value === params.get("tab")) ?? "general";
  const [modal, setModal] = useState<Modal>();
  const [secondaryTurnover, setSecondaryTurnover] = useState<string>();
  const [blocks, setBlocks] = useState(false);
  const busy = useRentalBusy(property.id);
  const editing = useRentalRecord(
    "reservations",
    property.id,
    modal?.kind === "edit" ? modal.id : undefined,
  );
  const block = useRentalRecord(
    "blocks",
    property.id,
    modal?.kind === "block_edit" ? modal.id : undefined,
  );
  // Capture the validated detail once when opening the edit intent. Cache eviction
  // must not destroy its form or the hook that can recover an uncertain write.
  if (modal?.kind === "edit" && !modal.initialData && editing.data)
    setModal({ ...modal, initialData: editing.data });
  if (modal?.kind === "block_edit" && !modal.initialData && block.data)
    setModal({ ...modal, initialData: block.data });
  const changeTab = (next: RentalTab) => {
    if (busy) return;
    setModal(undefined);
    setBlocks(false);
    setParams((previous) => {
      const query = new URLSearchParams(previous);
      query.set("tab", next);
      query.delete("reservation");
      return query;
    });
  };
  const detail = (id: string) => setModal({ kind: "detail", id });
  const turnover = (id: string) => {
    if (modal?.kind === "confirm") setSecondaryTurnover(id);
    else setModal({ kind: "turnover", id });
  };
  return (
    <WorkspaceStack>
      {!property.is_active && (
        <Alert severity="info">{t("rental:archive_warning")}</Alert>
      )}
      <WorkspaceAction
        disabled={busy || Boolean(modal)}
        onClick={() => setModal({ kind: "audit" })}
      >
        {t("rental:history")}
      </WorkspaceAction>
      <Tabs
        value={tab}
        onChange={(_, next: RentalTab) => changeTab(next)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={t("rental:title")}
      >
        {TABS.map((value) => (
          <Tab
            key={value}
            value={value}
            disabled={busy || Boolean(modal)}
            label={t(`rental:tabs.${value}`)}
            id={`rental-tab-${value}`}
            aria-controls={`rental-panel-${value}`}
          />
        ))}
      </Tabs>
      <Box
        role="tabpanel"
        id={`rental-panel-${tab}`}
        aria-labelledby={`rental-tab-${tab}`}
      >
        {tab === "general" && (
          <RentalOverview
            property={property}
            onOpenReservation={detail}
            onOpenTurnover={turnover}
            onViewPayments={() => setModal({ kind: "payments" })}
            onViewExpenses={() => changeTab("expenses")}
            onViewReservations={() => changeTab("reservations")}
            onViewTurnovers={() => {
              changeTab("turnovers");
              setBlocks(false);
            }}
          />
        )}
        {tab === "calendar" && (
          <WorkspaceStack>
            <RentalCalendar
              property={property}
              onOpenReservation={detail}
              onOpenTurnover={turnover}
              onManageBlocks={() => setBlocks((value) => !value)}
            />
            {blocks && (
              <BlockTable
                property={property}
                onCreate={() => setModal({ kind: "block_new" })}
                onEdit={(row) => setModal({ kind: "block_edit", id: row.id })}
              />
            )}
          </WorkspaceStack>
        )}
        {tab === "reservations" && (
          <ReservationTable
            property={property}
            onCreateReservation={() => setModal({ kind: "new" })}
            onOpenReservation={detail}
            onEditReservation={(row) => setModal({ kind: "edit", id: row.id })}
          />
        )}
        {tab === "turnovers" && (
          <TurnoverTable
            property={property}
            onOpenReservation={detail}
            onOpenTurnover={turnover}
          />
        )}
        {tab === "expenses" && (
          <ExpenseTable property={property} onOpenReservation={detail} />
        )}
        {tab === "collaborators" && <CollaboratorTable property={property} />}
        {tab === "configuration" && (
          <WorkspaceStack>
            <ConfigurationPanel property={property} />
            <PolicyTable property={property} />
          </WorkspaceStack>
        )}
      </Box>
      {modal?.kind === "payments" && (
        <BaseModal
          open
          size="lg"
          title={t("rental:payments_and_refunds")}
          onClose={() => {
            if (!busy) setModal(undefined);
          }}
          disableEscapeKeyDown={busy}
        >
          {modal.reservationId && (
            <Button
              disabled={busy}
              onClick={() => setModal({ kind: "payments" })}
            >
              {t("rental:clear_reservation_filter")}
            </Button>
          )}
          <PaymentTable
            property={property}
            reservationId={modal.reservationId}
            onOpenReservation={detail}
          />
        </BaseModal>
      )}
      {modal?.kind === "audit" && (
        <BaseModal
          open
          size="lg"
          title={t("rental:history")}
          onClose={() => {
            if (!busy) setModal(undefined);
          }}
          disableEscapeKeyDown={busy}
        >
          <RentalAudit property={property} />
        </BaseModal>
      )}
      {modal?.kind === "detail" && (
        <ReservationDetail
          property={property}
          id={modal.id}
          onClose={() => setModal(undefined)}
          onEdit={(row) => setModal({ kind: "edit", id: row.id })}
          onConfirm={(row) => setModal({ kind: "confirm", row })}
          onCancel={(row) => setModal({ kind: "cancel", row })}
          onStay={(row, kind) => setModal({ kind, row })}
          onOpenPayments={(id) =>
            setModal({ kind: "payments", reservationId: id })
          }
          onOpenTurnover={turnover}
        />
      )}
      {modal?.kind === "new" && (
        <ReservationModal
          open
          property={property}
          onClose={() => setModal(undefined)}
        />
      )}
      {modal?.kind === "edit" && modal.initialData && (
        <ReservationModal
          key={modal.id}
          open
          property={property}
          initialData={editing.data ?? modal.initialData}
          readError={editing.isError || (!editing.data && !editing.isLoading)}
          onRetryRead={() => void editing.refetch()}
          onClose={() => setModal(undefined)}
        />
      )}
      {((modal?.kind === "edit" && !modal.initialData && editing.isError) ||
        (modal?.kind === "block_edit" &&
          !modal.initialData &&
          block.isError)) && (
        <Alert
          severity="error"
          action={
            <Button
              disabled={busy}
              onClick={() =>
                void (modal.kind === "edit"
                  ? editing.refetch()
                  : block.refetch())
              }
            >
              {t("rental:retry")}
            </Button>
          }
        >
          {t("rental:load_error")}
          <Button disabled={busy} onClick={() => setModal(undefined)}>
            {t("rental:close")}
          </Button>
        </Alert>
      )}
      {modal?.kind === "confirm" && (
        <ReservationConfirm
          open
          property={property}
          reservation={modal.row}
          onClose={() => setModal(undefined)}
          onOpenTurnover={turnover}
        />
      )}
      {modal?.kind === "cancel" && (
        <ReservationCancel
          open
          property={property}
          reservation={modal.row}
          onClose={() => setModal(undefined)}
        />
      )}
      {(modal?.kind === "start" || modal?.kind === "complete") && (
        <ReservationStayActions
          open
          property={property}
          reservation={modal.row}
          command={modal.kind}
          onClose={() => setModal(undefined)}
        />
      )}
      {modal?.kind === "block_new" && (
        <BlockModal
          open
          property={property}
          onClose={() => setModal(undefined)}
        />
      )}
      {modal?.kind === "block_edit" && modal.initialData && (
        <BlockModal
          key={modal.id}
          open
          property={property}
          initialData={block.data ?? modal.initialData}
          readError={block.isError || (!block.data && !block.isLoading)}
          onRetryRead={() => void block.refetch()}
          onClose={() => setModal(undefined)}
        />
      )}
      {modal?.kind === "turnover" && (
        <TurnoverModal
          open
          property={property}
          id={modal.id}
          onClose={() => setModal(undefined)}
        />
      )}
      {secondaryTurnover && (
        <TurnoverModal
          open
          property={property}
          id={secondaryTurnover}
          onClose={() => setSecondaryTurnover(undefined)}
        />
      )}
    </WorkspaceStack>
  );
}
