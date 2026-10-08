import { useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import MailOutlinedIcon from "@mui/icons-material/MailOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { Skeleton } from "boneyard-js/react";
import { sileo } from "sileo";
import InputSearch from "../../../../../../../../components/inputs/InputSearch";
import ConfirmDialog from "../../../../../../../../components/ConfirmDialog";
import { useContactMutations, useContacts } from "./infrastructure/useServices";
import {
  CONTACT_DAYS,
  type ContactValues,
  type ProviderContact,
} from "./types";
import ContactModal from "../ContactModal";
import { ContactPanel, ContactTableContainer, ContactToolbar } from "./styles";

type Props = { providerId: string; providerName: string; onBack: () => void };
export default function ProviderContacts({
  providerId,
  providerName,
  onBack,
}: Props) {
  const { t } = useTranslation(["provider_contacts", "core"]);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProviderContact | null | undefined>(
    undefined,
  );
  const [toggling, setToggling] = useState<ProviderContact | null>(null);
  const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuContact, setMenuContact] = useState<ProviderContact | null>(null);

  const handleOpenActionMenu = (e: MouseEvent<HTMLElement>, contact: ProviderContact) => {
    e.stopPropagation();
    setActionMenuAnchorEl(e.currentTarget);
    setMenuContact(contact);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchorEl(null);
    setMenuContact(null);
  };
  const saving = useRef(false);
  const query = useContacts(providerId, { page: page + 1, limit, search });
  const mutations = useContactMutations(providerId);
  const busy =
    query.isLoading ||
    query.isFetching ||
    mutations.create.isPending ||
    mutations.update.isPending ||
    mutations.toggle.isPending;
  async function save(values: ContactValues, requestKey: string) {
    if (saving.current) return;
    saving.current = true;
    try {
      if (editing)
        await mutations.update.mutateAsync({
          id: editing.id,
          payload: { ...values, version: editing.version },
        });
      else
        await mutations.create.mutateAsync({
          ...values,
          request_key: requestKey,
        });
    } finally {
      saving.current = false;
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      sileo.success({ title: t("provider_contacts:copied") });
    } catch {
      sileo.error({ title: t("provider_contacts:copy_error") });
    }
  }
  async function toggle() {
    if (!toggling || busy) return;
    try {
      await mutations.toggle.mutateAsync({
        id: toggling.id,
        version: toggling.version,
        active: !toggling.is_active,
      });
      setToggling(null);
    } catch {
      /* Mutation owns the HTTP feedback; keep the dialog and selection. */
    }
  }
  function linkButton(label: string, href: string, icon: ReactNode) {
    return (
      <Tooltip title={label}>
        <span>
          <IconButton
            component="a"
            href={busy ? undefined : href}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            disabled={busy}
            aria-label={label}
          >
            {icon}
          </IconButton>
        </span>
      </Tooltip>
    );
  }
  const contacts = query.data?.data ?? [];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <ContactToolbar>
        <Button
          startIcon={<ArrowBackOutlinedIcon />}
          onClick={onBack}
          disabled={busy}
        >
          {t("provider_contacts:back")}
        </Button>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => setEditing(null)}
          disabled={busy}
        >
          {t("provider_contacts:new")}
        </Button>
      </ContactToolbar>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("provider_contacts:title", { name: providerName })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("provider_contacts:subtitle")}
        </Typography>
      </Box>
      <InputSearch
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        disabled={busy}
        placeholder={t("provider_contacts:search")}
      />
      {query.isError && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              disabled={busy}
              onClick={() => void query.refetch()}
            >
              {t("core:retry")}
            </Button>
          }
        >
          {t("provider_contacts:load_error")}
        </Alert>
      )}
      <ContactPanel elevation={0}>
        {(query.isFetching ||
          mutations.create.isPending ||
          mutations.update.isPending ||
          mutations.toggle.isPending) &&
          !query.isLoading && <LinearProgress sx={{ height: 2 }} />}
        <ContactTableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                {["name", "phones", "email", "schedule", "status"].map(
                  (key) => (
                    <TableCell key={key}>
                      {t(`provider_contacts:${key}`)}
                    </TableCell>
                  ),
                )}
                <TableCell align="right">{t("core:actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {query.isLoading
                ? [0, 1, 2].map((row) => (
                    <TableRow key={row}>
                      {[0, 1, 2, 3, 4, 5].map((col) => (
                        <TableCell key={col}>
                          <Skeleton loading>
                            <Typography>
                              {t("provider_contacts:loading")}
                            </Typography>
                          </Skeleton>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : contacts.map((contact) => (
                    <TableRow key={contact.id} hover>
                      <TableCell sx={{ minWidth: 160 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {contact.name}
                        </Typography>
                        {contact.description && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "block",
                              maxWidth: 220,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {contact.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.phone.length ? (
                          contact.phone.map((phone) => (
                            <Box
                              key={phone.number}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                whiteSpace: "nowrap",
                              }}
                            >
                              <Typography variant="body2">
                                {phone.number}
                              </Typography>
                              <IconButton
                                size="small"
                                disabled={busy}
                                aria-label={t("provider_contacts:copy_phone", {
                                  number: phone.number,
                                })}
                                onClick={() => void copy(phone.number)}
                              >
                                <ContentCopyOutlinedIcon fontSize="small" />
                              </IconButton>
                              {linkButton(
                                t("provider_contacts:whatsapp", {
                                  number: phone.number,
                                }),
                                `https://wa.me/${phone.number.replace(/\D/g, "")}`,
                                <WhatsAppIcon fontSize="small" sx={{ color: "success.main" }} />,
                              )}
                            </Box>
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {t("provider_contacts:no_phone")}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 220 }}>
                        {contact.email ? (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{ overflowWrap: "anywhere" }}
                            >
                              {contact.email}
                            </Typography>
                            <IconButton
                              size="small"
                              disabled={busy}
                              aria-label={t("provider_contacts:copy_email")}
                              onClick={() => void copy(contact.email!)}
                            >
                              <ContentCopyOutlinedIcon fontSize="small" />
                            </IconButton>
                            {linkButton(
                              t("provider_contacts:send_email"),
                              `mailto:${encodeURIComponent(contact.email)}`,
                              <MailOutlinedIcon fontSize="small" />,
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {t("provider_contacts:no_email")}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        {CONTACT_DAYS.some(
                          (day) => contact.schedule[day]?.length,
                        ) ? (
                          CONTACT_DAYS.flatMap((day) =>
                            (contact.schedule[day] ?? []).map((range) => (
                              <Box
                                key={`${day}-${range.from}`}
                                sx={{ mb: 0.5 }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {t("provider_contacts:day_range", {
                                    day: t(`provider_contacts:days.${day}`),
                                    from: range.from,
                                    to: range.to,
                                  })}
                                </Typography>
                                {range.description && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: "block" }}
                                  >
                                    {range.description}
                                  </Typography>
                                )}
                              </Box>
                            )),
                          )
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {t("provider_contacts:no_schedule")}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={t(
                            contact.is_active
                              ? "provider_contacts:active"
                              : "provider_contacts:inactive",
                          )}
                          color={contact.is_active ? "success" : "default"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <IconButton
                          size="small"
                          disabled={busy}
                          onClick={(e) => handleOpenActionMenu(e, contact)}
                          data-testid={`contact-actions-btn-${contact.id}`}
                          aria-label={t("core:actions", "Acciones")}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              {!query.isLoading && !query.isError && !contacts.length && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography variant="subtitle2">
                      {t(
                        search
                          ? "provider_contacts:no_results"
                          : "provider_contacts:empty_title",
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        search
                          ? "provider_contacts:search_help"
                          : "provider_contacts:empty_description",
                      )}
                    </Typography>
                    {!search && (
                      <Button
                        sx={{ mt: 2, width: { xs: "100%", sm: "auto" } }}
                        disabled={busy}
                        onClick={() => setEditing(null)}
                        startIcon={<AddOutlinedIcon />}
                      >
                        {t("provider_contacts:new")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ContactTableContainer>
        <TablePagination
          component="div"
          count={query.data?.meta.total_items ?? 0}
          page={page}
          rowsPerPage={limit}
          rowsPerPageOptions={[25, 50, 100]}
          disabled={busy}
          onPageChange={(_, value) => setPage(value)}
          onRowsPerPageChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(0);
          }}
          labelRowsPerPage={t("core:pagination.rows_per_page")}
          getItemAriaLabel={(type) => t(`provider_contacts:page_${type}`)}
          labelDisplayedRows={({ from, to, count }) =>
            t("provider_contacts:pagination", { from, to, count })
          }
        />
      </ContactPanel>
      {editing !== undefined && (
        <ContactModal
          key={editing?.id ?? "new"}
          providerName={providerName}
          contact={editing ?? undefined}
          busy={busy}
          onSave={save}
          onClose={() => setEditing(undefined)}
        />
      )}
      <ConfirmDialog
        open={!!toggling}
        onClose={() => {
          if (!busy) setToggling(null);
        }}
        onCancel={() => setToggling(null)}
        onConfirm={toggle}
        title={t(
          toggling?.is_active
            ? "provider_contacts:deactivate"
            : "provider_contacts:activate",
        )}
        message={t("provider_contacts:confirm_status", {
          name: toggling?.name,
        })}
        isLoading={mutations.toggle.isPending}
      />

      {/* 3-Dots Action Menu */}
      <Menu
        anchorEl={actionMenuAnchorEl}
        open={Boolean(actionMenuAnchorEl)}
        onClose={handleCloseActionMenu}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            sx: (theme) => ({
              borderRadius: 2,
              minWidth: 160,
              boxShadow: theme.shadows[3],
              border: `1px solid ${theme.palette.divider}`,
            }),
          },
          list: {
            sx: {
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              p: 1,
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (menuContact) setEditing(menuContact);
            handleCloseActionMenu();
          }}
          sx={{ borderRadius: 1 }}
          data-testid="menu-item-edit-contact"
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("provider_contacts:edit")} />
        </MenuItem>

        {menuContact && (
          <MenuItem
            onClick={() => {
              setToggling(menuContact);
              handleCloseActionMenu();
            }}
            sx={{ borderRadius: 1 }}
            data-testid="menu-item-toggle-contact"
          >
            <ListItemIcon>
              {menuContact.is_active ? (
                <BlockOutlinedIcon fontSize="small" color="error" />
              ) : (
                <CheckCircleOutlinedIcon fontSize="small" color="success" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={t(
                menuContact.is_active
                  ? "provider_contacts:deactivate"
                  : "provider_contacts:activate"
              )}
            />
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}
