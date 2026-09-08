import type { FC, MouseEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  Button,
  IconButton,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  LinearProgress,
  Alert,
  AlertTitle,
  TablePagination,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { Skeleton } from "boneyard-js/react";
import { sileo } from "sileo";

import Filter from "../../../../components/Filter";
import FilterChips from "../../../../components/Filter/components/FilterChips";
import InputSearch from "../../../../components/inputs/InputSearch";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import ActionModal from "./components/ActionModal";
import {
  useActions,
  useCreateAction,
  useUpdateAction,
} from "./infrastructure/useServices";
import type { ActionItem, ActionFormData, Action } from "./types";
import {
  PageHeader,
  PageTitleContainer,
  PageTitle,
  PageSubtitle,
  FilterRow,
  ActiveFilters,
  TableTopBar,
  StyledTableContainer,
  KeyBadge,
  DescriptionTypography,
} from "./styles";

const Actions: FC = () => {
  const { t, i18n } = useTranslation(["actions", "core"]);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Filter modal draft state
  const [draftFilterActionKeys, setDraftFilterActionKeys] = useState<string[]>(
    []
  );
  const [draftFilterActive, setDraftFilterActive] = useState<boolean>(true);

  // Applied filter state
  const [appliedFilterActionKeys, setAppliedFilterActionKeys] = useState<
    string[]
  >([]);
  const [appliedFilterActive, setAppliedFilterActive] = useState<
    boolean | null
  >(null);

  // Action Create / Edit Modal state
  const [isActionModalOpen, setIsActionModalOpen] = useState<boolean>(false);
  const [selectedActionForEdit, setSelectedActionForEdit] =
    useState<ActionFormData | null>(null);

  // Table row actions menu
  const [actionMenuAnchor, setActionMenuAnchor] =
    useState<HTMLButtonElement | null>(null);
  const [targetAction, setTargetAction] = useState<ActionItem | null>(null);

  // Confirm Active / Inactive Dialog state
  const [actionToToggle, setActionToToggle] = useState<ActionItem | null>(null);
  const [isConfirmToggleOpen, setIsConfirmToggleOpen] =
    useState<boolean>(false);

  // Mutations
  const createActionMutation = useCreateAction();
  const updateActionMutation = useUpdateAction();
  const isMutating =
    createActionMutation.isPending || updateActionMutation.isPending;

  // Build Ransack query
  const ransackQuery = useMemo(() => {
    const q: Record<string, unknown> = {};
    if (searchTerm.trim()) {
      q.key_cont = searchTerm.trim();
    }
    if (appliedFilterActive !== null) {
      q.is_active_eq = appliedFilterActive;
    }
    if (appliedFilterActionKeys.length > 0) {
      q.key_in = appliedFilterActionKeys;
    }
    return q;
  }, [searchTerm, appliedFilterActive, appliedFilterActionKeys]);

  // Query 1: All actions for filter dropdowns (all=true, includes=true)
  const {
    data: allActionsResponse,
    isLoading: isLoadingAllActions,
    isFetching: isFetchingAllActions,
  } = useActions({ all: true, includes: true });

  // Query 2: Paginated actions with includes
  const {
    data: actionsResponse,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useActions({
    page: page + 1,
    size: rowsPerPage,
    includes: true,
    q: Object.keys(ransackQuery).length > 0 ? ransackQuery : undefined,
  });

  const actions: ActionItem[] = useMemo(() => {
    if (actionsResponse?.data) {
      return actionsResponse.data.map((a: Action) => {
        const keyTrans = a.translates?.find((t) => t.key === "key");
        const commentTrans = a.translates?.find((t) => t.key === "comment");
        const nameTranslations = keyTrans
          ? { es: keyTrans.es, en: keyTrans.en }
          : undefined;
        const descriptionTranslations = commentTrans
          ? { es: commentTrans.es, en: commentTrans.en }
          : undefined;
        const lang = i18n.language?.startsWith("en") ? "en" : "es";
        const altLang = lang === "en" ? "es" : "en";
        const description =
          commentTrans?.[lang] ||
          commentTrans?.[altLang] ||
          a.description ||
          null;
        const name =
          keyTrans?.[lang] ||
          keyTrans?.[altLang] ||
          (i18n.exists(`actions:action_names.${a.key}`)
            ? t(`actions:action_names.${a.key}`)
            : null);

        return {
          id: a.id,
          name,
          key: a.key,
          nameTranslations,
          descriptionTranslations,
          description,
          isActive: a.is_active ?? true,
          translates: a.translates,
        };
      });
    }
    return [];
  }, [actionsResponse, i18n.language, t, i18n]);

  const totalItems = useMemo(() => {
    return actionsResponse?.meta?.total_items ?? actions.length;
  }, [actionsResponse, actions.length]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const actionFilterOptions = useMemo(() => {
    const sourceActions = allActionsResponse?.data ?? actionsResponse?.data ?? [];
    return sourceActions.map((a: Action) => {
      const keyTrans = a.translates?.find((t) => t.key === "key");
      const lang = i18n.language?.startsWith("en") ? "en" : "es";
      const altLang = lang === "en" ? "es" : "en";
      const name =
        keyTrans?.[lang] ||
        keyTrans?.[altLang] ||
        (i18n.exists(`actions:action_names.${a.key}`)
          ? t(`actions:action_names.${a.key}`)
          : null);
      const label = name ? `${name} (${a.key})` : a.key;
      return {
        value: a.key,
        label,
      };
    });
  }, [allActionsResponse?.data, actionsResponse?.data, i18n.language, t, i18n]);

  const handleOpenActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    action: ActionItem
  ) => {
    setActionMenuAnchor(e.currentTarget);
    setTargetAction(action);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchor(null);
    setTargetAction(null);
  };

  const handleOpenCreateModal = () => {
    setSelectedActionForEdit(null);
    setIsActionModalOpen(true);
  };

  const handleOpenEditModal = () => {
    if (targetAction) {
      const keyTrans = targetAction.translates?.find((t) => t.key === "key");
      const commentTrans = targetAction.translates?.find((t) => t.key === "comment");
      setSelectedActionForEdit({
        id: targetAction.id,
        key: targetAction.key,
        nameTranslations: targetAction.nameTranslations ?? {
          es: keyTrans?.es ?? "",
          en: keyTrans?.en ?? "",
        },
        descriptionTranslations: targetAction.descriptionTranslations ?? {
          es: commentTrans?.es ?? "",
          en: commentTrans?.en ?? "",
        },
        description: null,
        isActive: targetAction.isActive,
      });
      setIsActionModalOpen(true);
    }
    handleCloseActionMenu();
  };

  const handleSaveAction = async (data: ActionFormData) => {
    const actionId = data.id;
    try {
      if (actionId) {
        await updateActionMutation.mutateAsync({
          actionId,
          payload: {
            key: data.key,
            is_active: data.isActive,
            description: null,
            translates: data.translates,
          },
        });
      } else {
        await createActionMutation.mutateAsync({
          key: data.key,
          is_active: data.isActive,
          description: null,
          translates: data.translates,
        });
      }
      setIsActionModalOpen(false);
    } catch {
      // Handled by onError sileo toast
    }
  };

  const handleRequestToggleActive = (action: ActionItem) => {
    setActionToToggle(action);
    setIsConfirmToggleOpen(true);
    handleCloseActionMenu();
  };

  const handleCloseConfirmToggle = () => {
    if (isMutating) return;
    setIsConfirmToggleOpen(false);
    setActionToToggle(null);
  };

  const handleConfirmToggleActive = async () => {
    if (!actionToToggle) return;
    try {
      await updateActionMutation.mutateAsync({
        actionId: actionToToggle.id,
        payload: {
          is_active: !actionToToggle.isActive,
        },
      });
      setIsConfirmToggleOpen(false);
      setActionToToggle(null);
    } catch {
      // Handled by mutation onError sileo toast
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    sileo.info({
      title: t("actions:copy"),
      description: t("actions:copied"),
    });
  };

  // Filter application
  const handleApplyFilters = () => {
    setAppliedFilterActionKeys(draftFilterActionKeys);
    setAppliedFilterActive(draftFilterActive);
    setPage(0);
  };

  const handleClearFilters = () => {
    setDraftFilterActionKeys([]);
    setDraftFilterActive(true);
    setAppliedFilterActionKeys([]);
    setAppliedFilterActive(null);
    setPage(0);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilterActionKeys.length > 0)
      count += appliedFilterActionKeys.length;
    if (appliedFilterActive !== null) count += 1;
    return count;
  }, [appliedFilterActionKeys, appliedFilterActive]);

  return (
    <Box>
      <PageHeader>
        <PageTitleContainer>
          <BoltOutlinedIcon color="primary" fontSize="large" />
          <PageTitle>{t("actions:title")}</PageTitle>
        </PageTitleContainer>
        <PageSubtitle>{t("actions:subtitle")}</PageSubtitle>
      </PageHeader>

      <FilterRow>
        <Filter
          onFilter={handleApplyFilters}
          onClear={handleClearFilters}
          activeCount={activeFiltersCount}
          title={t("actions:filter_modal_title")}
          subtitle={t("actions:filter_modal_subtitle")}
        >
          <SelectMultipleInput
            label={t("actions:table.key")}
            options={actionFilterOptions}
            value={draftFilterActionKeys}
            onChange={setDraftFilterActionKeys}
            placeholder={t("actions:form.key_placeholder")}
            disabled={isLoadingAllActions || isFetchingAllActions || isMutating}
          />

          <Box
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 1.5,
              borderRadius: 1.5,
              border: `1px solid ${
                theme.palette.border?.default ?? theme.palette.divider
              }`,
            })}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={draftFilterActive}
                  onChange={(e) => setDraftFilterActive(e.target.checked)}
                  color="primary"
                />
              }
              label={t("actions:form.active")}
              labelPlacement="start"
              sx={{ m: 0, width: "100%", justifyContent: "space-between" }}
            />
          </Box>
        </Filter>
      </FilterRow>

      {activeFiltersCount > 0 && (
        <ActiveFilters>
          {appliedFilterActionKeys.map((actionKey) => {
            const matched = (allActionsResponse?.data ?? actionsResponse?.data)?.find(
              (a) => a.key === actionKey
            );
            const keyTrans = matched?.translates?.find((t) => t.key === "key");
            const lang = i18n.language?.startsWith("en") ? "en" : "es";
            const altLang = lang === "en" ? "es" : "en";
            const name =
              keyTrans?.[lang] ||
              keyTrans?.[altLang] ||
              (i18n.exists(`actions:action_names.${actionKey}`)
                ? t(`actions:action_names.${actionKey}`)
                : null);
            const actLabel = name ? `${name} (${actionKey})` : actionKey;
            return (
              <FilterChips
                key={`action-${actionKey}`}
                label={t("actions:filter_chips.action", { value: actLabel })}
                onAction={() => {
                  setAppliedFilterActionKeys((prev) =>
                    prev.filter((k) => k !== actionKey)
                  );
                  setPage(0);
                }}
              />
            );
          })}
          {appliedFilterActive !== null && (
            <FilterChips
              label={
                appliedFilterActive
                  ? t("actions:filter_chips.active_only")
                  : t("actions:no")
              }
              onAction={() => {
                setAppliedFilterActive(null);
                setPage(0);
              }}
            />
          )}
        </ActiveFilters>
      )}

      {isError && (
        <Box sx={{ mb: 2.5 }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => refetch()}>
                {t("core:retry", "Reintentar")}
              </Button>
            }
          >
            <AlertTitle>
              {t("actions:error_state.title", "Error al cargar las acciones")}
            </AlertTitle>
            {error instanceof Error
              ? error.message
              : t(
                  "actions:error_state.description",
                  "No se pudo obtener el listado de acciones desde el servidor."
                )}
          </Alert>
        </Box>
      )}

      <TableTopBar>
        <Box sx={{ width: { xs: "100%", sm: "360px" } }}>
          <InputSearch
            value={searchTerm}
            onChange={(val) => {
              setSearchTerm(val);
              setPage(0);
            }}
            placeholder={t("actions:search_placeholder")}
            fullWidth
            disabled={isLoading || isMutating}
          />
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlinedIcon />}
          onClick={handleOpenCreateModal}
          disabled={isLoading || isFetching || isMutating}
          sx={(theme) => ({
            borderRadius: 2,
            color: theme.palette.primary.contrastText,
          })}
        >
          {t("actions:new_action")}
        </Button>
      </TableTopBar>

      <Skeleton loading={isLoading} name="actions-table">
        <StyledTableContainer>
          {isFetching && !isLoading && (
            <LinearProgress
              sx={{
                height: 3,
              }}
            />
          )}
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead
                sx={{
                  bgcolor: "primary.main",
                  "& th": {
                    color: "primary.contrastText",
                    fontWeight: "bold",
                  },
                }}
              >
                <TableRow>
                  <TableCell>{t("actions:table.id")}</TableCell>
                  <TableCell>{t("actions:table.name")}</TableCell>
                  <TableCell>{t("actions:table.key")}</TableCell>
                  <TableCell>{t("actions:table.description")}</TableCell>
                  <TableCell>{t("actions:table.active")}</TableCell>
                  <TableCell align="center">
                    {t("actions:table.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!isLoading && actions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      align="center"
                      sx={{ py: 6, color: "text.secondary" }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 1.5,
                        }}
                      >
                        <BoltOutlinedIcon
                          sx={{ fontSize: 48, color: "text.disabled" }}
                        />
                        <Typography variant="h6" color="text.secondary">
                          {t(
                            "actions:empty_state.title",
                            "No hay acciones disponibles"
                          )}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.disabled"
                          sx={{ maxWidth: 400 }}
                        >
                          {t(
                            "actions:empty_state.description",
                            "No se encontraron acciones actualmente. Comience agregando una nueva."
                          )}
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<AddCircleOutlinedIcon />}
                          onClick={handleOpenCreateModal}
                          disabled={isLoading || isFetching || isMutating}
                          sx={{ mt: 1 }}
                        >
                          {t(
                            "actions:empty_state.cta",
                            "Crear primera acción"
                          )}
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  actions.map((act) => {
                    return (
                      <TableRow
                        key={act.id}
                        hover
                        sx={{
                          "&:last-child td, &:last-child th": { border: 0 },
                        }}
                      >
                        <TableCell
                          sx={{
                            color: "text.secondary",
                            fontSize: "0.875rem",
                            fontFamily: "monospace",
                          }}
                        >
                          <Box
                            sx={{ display: "flex", alignItems: "center", gap: 1 }}
                          >
                            {act.id.includes("-")
                              ? `${act.id.split("-")[0]}...`
                              : act.id}
                            <Tooltip
                              title={t("actions:copy")}
                              arrow
                              placement="top"
                            >
                              <IconButton
                                size="small"
                                onClick={() => handleCopyId(act.id)}
                                aria-label={t("actions:copy")}
                                disabled={isLoading || isFetching || isMutating}
                              >
                                <ContentCopyIcon
                                   fontSize="small"
                                   sx={{ fontSize: "1rem" }}
                                />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "medium" }}
                          >
                            {act.name || t("actions:empty_value", "-")}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <KeyBadge>{act.key}</KeyBadge>
                        </TableCell>
                        <TableCell>
                          {act.description ? (
                            <DescriptionTypography>
                              {act.description}
                            </DescriptionTypography>
                          ) : (
                            t("actions:empty_value")
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              act.isActive
                                ? t("actions:yes")
                                : t("actions:no")
                            }
                            color={act.isActive ? "success" : "error"}
                            size="small"
                            variant={act.isActive ? "filled" : "outlined"}
                            sx={
                              act.isActive
                                ? { color: "success.contrastText" }
                                : {}
                            }
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="primary"
                            aria-label={t("actions:table.actions")}
                            onClick={(e) => handleOpenActionMenu(e, act)}
                            disabled={isLoading || isFetching || isMutating}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalItems}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage={t("core:pagination.rows_per_page")}
            labelDisplayedRows={({ from, to, count }) =>
              `${from}–${to} ${t("core:pagination.of")} ${
                count !== -1 ? count : `${t("core:pagination.more_than")} ${to}`
              }`
            }
          />
        </StyledTableContainer>
      </Skeleton>

      {/* Row Actions Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleCloseActionMenu}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            sx: (theme) => ({
              borderRadius: 2,
              minWidth: 140,
              boxShadow: theme.shadows[3],
              border: `1px solid ${
                theme.palette.border?.default ?? theme.palette.divider
              }`,
            }),
          },
          list: {
            sx: {
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              p: 1,
            },
          },
        }}
      >
        <MenuItem onClick={handleOpenEditModal} sx={{ borderRadius: 1 }}>
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("actions:actions_menu.update")} />
        </MenuItem>
        {targetAction && (
          <MenuItem
            onClick={() => handleRequestToggleActive(targetAction)}
            sx={{ borderRadius: 1 }}
          >
            <ListItemIcon>
              {targetAction.isActive ? (
                <BlockOutlinedIcon fontSize="small" color="error" />
              ) : (
                <CheckCircleOutlineOutlinedIcon fontSize="small" color="success" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                targetAction.isActive
                  ? t("actions:deactivate")
                  : t("actions:activate")
              }
            />
          </MenuItem>
        )}
      </Menu>

      {/* Confirm Active / Inactive Dialog */}
      <ConfirmDialog
        open={isConfirmToggleOpen}
        onClose={handleCloseConfirmToggle}
        onConfirm={handleConfirmToggleActive}
        isLoading={isMutating}
        title={
          actionToToggle?.isActive
            ? t("actions:confirm_deactivate_title")
            : t("actions:confirm_activate_title")
        }
        message={
          actionToToggle?.isActive
            ? t("actions:confirm_deactivate_message", {
                name: actionToToggle?.key,
              })
            : t("actions:confirm_activate_message", {
                name: actionToToggle?.key,
              })
        }
        confirmText={
          actionToToggle?.isActive
            ? t("actions:deactivate")
            : t("actions:activate")
        }
        cancelText={t("core:cancel")}
      />

      {/* Action Create / Edit Modal */}
      <ActionModal
        open={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        onSubmit={handleSaveAction}
        initialData={selectedActionForEdit}
        isSubmitting={isMutating}
      />
    </Box>
  );
};

export default Actions;
