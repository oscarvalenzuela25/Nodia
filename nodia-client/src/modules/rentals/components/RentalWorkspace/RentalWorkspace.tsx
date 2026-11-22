import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Alert,
  Box,
  Button,
  Menu,
  MenuItem,
  Tab,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddOutlined from "@mui/icons-material/AddOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
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
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import RentalOverview from "../RentalOverview";
import type { RentalCashPeriod } from "../RentalOverview";
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
import PaymentModal from "../PaymentModal";
import ExpenseTable from "../ExpenseTable";
import CollaboratorTable from "../CollaboratorTable";
import ConfigurationPanel from "../ConfigurationPanel";
import RentalAudit from "../RentalAudit";
import { RentalAccessContext } from "../../infrastructure/scope";
import {
  WorkspaceStack,
  WorkspaceAction,
  WorkspaceHeader,
  WorkspaceTabs,
  WorkspacePanelHeader,
} from "./styles";

const PRIMARY_TABS = [
  "calendar",
  "reservations",
  "turnovers",
  "cash",
  "collaborators",
  "configuration",
] as const;
const TABS = [...PRIMARY_TABS, "general", "expenses"] as const;
type RentalTab = (typeof TABS)[number];
type Modal = (
  | { kind: "payment_new"; reservationId: string }
  | { kind: "payments"; reservationId?: string }
  | { kind: "audit" }
  | { kind: "detail" | "turnover"; id: string }
  | { kind: "edit"; id: string; initialData?: RentalReservation }
  | { kind: "block_edit"; id: string; initialData?: RentalBlock }
  | { kind: "new"; stay?: { check_in_on: string; check_out_on: string } }
  | { kind: "block_new" }
  | {
      kind: "confirm" | "cancel" | "start" | "complete";
      row: RentalReservation;
    }
) & { returnToReservationId?: string };
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
  const mobile = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((value) => value === params.get("tab")) ?? "calendar";
  const primaryTab = tab === "general" || tab === "expenses" ? "cash" : tab;
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [modal, setModal] = useState<Modal>();
  const [secondaryTurnover, setSecondaryTurnover] = useState<string>();
  const [blocks, setBlocks] = useState(false);
  const [cashPeriod, setCashPeriod] = useState<RentalCashPeriod>();
  const blocksHeadingRef = useRef<HTMLHeadingElement>(null);
  const adminButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusPanelOnNavigation = useRef(false);
  const adminButtonId = useId();
  const adminMenuId = useId();
  const blocksHeadingId = useId();
  const [selectedReservationId, setSelectedReservationId] = useState<string>();
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
  useEffect(() => {
    if (blocks && tab === "calendar") blocksHeadingRef.current?.focus();
  }, [blocks, tab]);
  useEffect(() => {
    if (focusPanelOnNavigation.current) {
      focusPanelOnNavigation.current = false;
      panelRef.current?.focus();
    }
  }, [tab]);
  // Capture the validated detail once when opening the edit intent. Cache eviction
  // must not destroy its form or the hook that can recover an uncertain write.
  if (modal?.kind === "edit" && !modal.initialData && editing.data)
    setModal({ ...modal, initialData: editing.data });
  if (modal?.kind === "block_edit" && !modal.initialData && block.data)
    setModal({ ...modal, initialData: block.data });
  const changeTab = (next: RentalTab, focusPanel = false) => {
    if (busy) return;
    focusPanelOnNavigation.current = focusPanel && next !== tab;
    setModal(undefined);
    setBlocks(false);
    setSelectedReservationId(undefined);
    setParams((previous) => {
      const query = new URLSearchParams(previous);
      query.set("tab", next);
      query.delete("reservation");
      return query;
    });
  };
  const detail = (id: string) => setModal({ kind: "detail", id });
  const openFromDetail = (next: Modal) =>
    setModal((current) =>
      current?.kind === "detail"
        ? { ...next, returnToReservationId: current.id }
        : current,
    );
  const closeModal = () =>
    setModal((current) =>
      current?.returnToReservationId
        ? { kind: "detail", id: current.returnToReservationId }
        : undefined,
    );
  const closeBlocks = () => {
    setBlocks(false);
    adminButtonRef.current?.focus();
  };
  const turnover = (id: string) => {
    if (modal?.kind === "confirm") setSecondaryTurnover(id);
    else setModal({ kind: "turnover", id });
  };
  return (
    <WorkspaceStack>
      {!property.is_active && (
        <Alert severity="info">{t("rental:archive_warning")}</Alert>
      )}
      <WorkspaceHeader>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h5"
            component="h2"
            sx={{ fontWeight: 700, overflowWrap: "anywhere" }}
          >
            {property.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {property.timezone}
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 1,
            flexWrap: "wrap",
            width: { xs: "100%", sm: "auto" },
          }}
        >
          <WorkspaceAction
            variant="contained"
            startIcon={<AddOutlined />}
            disabled={busy || Boolean(modal) || !property.is_active}
            onClick={() => setModal({ kind: "new" })}
          >
            {t("rental:new_reservation")}
          </WorkspaceAction>
          <WorkspaceAction
            ref={adminButtonRef}
            id={adminButtonId}
            variant="outlined"
            endIcon={<ExpandMoreOutlined />}
            disabled={busy || Boolean(modal)}
            aria-haspopup="menu"
            aria-controls={menuAnchor ? adminMenuId : undefined}
            aria-expanded={Boolean(menuAnchor)}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
          >
            {t("rental:calendar_manage")}
          </WorkspaceAction>
        </Box>
      </WorkspaceHeader>
      <Menu
        slotProps={{ list: { id: adminMenuId, "aria-labelledby": adminButtonId } }}
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            changeTab("calendar");
            setBlocks(true);
          }}
        >
          {t("rental:manage_blocks")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            changeTab("expenses", true);
          }}
        >
          {t("rental:tabs.expenses")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setModal({ kind: "audit" });
          }}
        >
          {t("rental:history")}
        </MenuItem>
      </Menu>
      {mobile ? (
        <SelectSingleInput
          label={t("rental:section")}
          value={primaryTab}
          clearable={false}
          autoFocusSearch={false}
          disabled={busy || Boolean(modal)}
          options={PRIMARY_TABS.map((value) => ({ value, label: t(`rental:tabs.${value}`) }))}
          onChange={(value) => {
            const next = PRIMARY_TABS.find((option) => option === value);
            if (next) changeTab(next);
          }}
        />
      ) : (
        <WorkspaceTabs
          value={primaryTab}
          onChange={(_, next: RentalTab) => changeTab(next)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={t("rental:title")}
        >
          {PRIMARY_TABS.map((value) => (
            <Tab
              key={value}
              value={value}
              disabled={busy || Boolean(modal)}
              label={t(`rental:tabs.${value}`)}
              id={`rental-tab-${value}`}
              aria-controls={`rental-panel-${value}`}
            />
          ))}
        </WorkspaceTabs>
      )}
      <Box
        ref={panelRef}
        tabIndex={-1}
        sx={(theme) => ({
          minWidth: 0,
          "&:focus-visible": {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 3,
          },
        })}
        role={mobile ? "region" : "tabpanel"}
        id={`rental-panel-${primaryTab}`}
        aria-labelledby={mobile ? undefined : `rental-tab-${primaryTab}`}
        aria-label={mobile ? t(`rental:tabs.${tab}`) : undefined}
      >
        {(tab === "general" || tab === "cash") && (
          <RentalOverview
            cashOnly={tab === "cash"}
            property={property}
            period={cashPeriod}
            onPeriodChange={setCashPeriod}
            onOpenReservation={detail}
            onOpenTurnover={turnover}
            onViewPayments={() => setModal({ kind: "payments" })}
            onViewExpenses={() => changeTab("expenses", true)}
            onViewReservations={() => changeTab("reservations", true)}
            onViewTurnovers={() => {
              changeTab("turnovers", true);
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
              selectedReservationId={selectedReservationId}
              onSelectReservation={setSelectedReservationId}
              onManageBlocks={() => setBlocks((value) => !value)}
              onCreateReservation={(stay) => setModal({ kind: "new", stay })}
              onQuickPayment={(reservationId) =>
                setModal({ kind: "payment_new", reservationId })
              }
            />
            {blocks && (
              <WorkspaceStack
                role="region"
                aria-labelledby={blocksHeadingId}
              >
                <WorkspacePanelHeader>
                  <Typography
                    ref={blocksHeadingRef}
                    id={blocksHeadingId}
                    component="h2"
                    variant="h6"
                    tabIndex={-1}
                  >
                    {t("rental:blocks_heading")}
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={closeBlocks}
                    disabled={busy}
                  >
                    {t("rental:return_to_agenda")}
                  </Button>
                </WorkspacePanelHeader>
                <BlockTable
                  property={property}
                  onCreate={() => setModal({ kind: "block_new" })}
                  onEdit={(row) => setModal({ kind: "block_edit", id: row.id })}
                />
              </WorkspaceStack>
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
          <WorkspaceStack>
            <WorkspacePanelHeader>
              <Typography component="h2" variant="h6">
                {t("rental:tabs.expenses")}
              </Typography>
              <Button
                variant="outlined"
                disabled={busy}
                onClick={() => changeTab("cash", true)}
              >
                {t("rental:return_to_cash")}
              </Button>
            </WorkspacePanelHeader>
            <ExpenseTable property={property} onOpenReservation={detail} />
          </WorkspaceStack>
        )}
        {tab === "collaborators" && <CollaboratorTable property={property} />}
        {tab === "configuration" && (
          <WorkspaceStack>
            <ConfigurationPanel property={property} />
          </WorkspaceStack>
        )}
      </Box>
      {modal?.kind === "payments" && (
        <BaseModal
          open
          size="lg"
          title={t("rental:payments_and_refunds")}
          onClose={() => {
            if (!busy) closeModal();
          }}
          disableEscapeKeyDown={busy}
        >
          {modal.reservationId && (
            <Button
              disabled={busy}
              onClick={() =>
                setModal({ ...modal, reservationId: undefined })
              }
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
          onEdit={(row) => openFromDetail({ kind: "edit", id: row.id })}
          onConfirm={(row) => openFromDetail({ kind: "confirm", row })}
          onCancel={(row) => openFromDetail({ kind: "cancel", row })}
          onStay={(row, kind) => openFromDetail({ kind, row })}
          onOpenPayments={(id) =>
            openFromDetail({ kind: "payments", reservationId: id })
          }
          onOpenTurnover={(id) => openFromDetail({ kind: "turnover", id })}
        />
      )}
      {modal?.kind === "payment_new" && (
        <PaymentModal
          open
          property={property}
          reservationId={modal.reservationId}
          onClose={() => setModal(undefined)}
        />
      )}
      {modal?.kind === "new" && (
        <ReservationModal
          open
          property={property}
          initialStay={modal.stay}
          onSaved={(id) => {
            setSelectedReservationId(id);
            detail(id);
          }}
          onClose={() => setModal((current) =>
            current?.kind === "new" ? undefined : current,
          )}
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
          onClose={closeModal}
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
          <Button disabled={busy} onClick={closeModal}>
            {t("rental:close")}
          </Button>
        </Alert>
      )}
      {modal?.kind === "confirm" && (
        <ReservationConfirm
          open
          property={property}
          reservation={modal.row}
          onClose={closeModal}
          onOpenTurnover={turnover}
        />
      )}
      {modal?.kind === "cancel" && (
        <ReservationCancel
          open
          property={property}
          reservation={modal.row}
          onClose={closeModal}
        />
      )}
      {(modal?.kind === "start" || modal?.kind === "complete") && (
        <ReservationStayActions
          open
          property={property}
          reservation={modal.row}
          command={modal.kind}
          onClose={closeModal}
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
          onClose={closeModal}
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
