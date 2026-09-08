import type { FC, MouseEvent } from "react";
import { useState, useMemo, useCallback } from "react";
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
  TablePagination,
  Alert,
  AlertTitle,
  LinearProgress,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
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
import ModuleModal from "./components/ModuleModal";
import type { ModuleEntity, ModuleFormData } from "./types";
import {
  useModules,
  useCreateModule,
  useUpdateModule,
} from "./infrastructure/useServices";
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
} from "./styles";

const Modules: FC = () => {
  const { t, i18n } = useTranslation(["modules", "core"]);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Filter modal draft state
  const [draftFilterKeys, setDraftFilterKeys] = useState<string[]>([]);
  const [draftFilterGroups, setDraftFilterGroups] = useState<string[]>([]);
  const [draftFilterActive, setDraftFilterActive] = useState<boolean>(true);

  // Applied filter state
  const [appliedFilterKeys, setAppliedFilterKeys] = useState<string[]>([]);
  const [appliedFilterGroups, setAppliedFilterGroups] = useState<string[]>([]);
  const [appliedFilterActive, setAppliedFilterActive] = useState<boolean | null>(
    null
  );

  // Module Create / Edit Modal state
  const [isModuleModalOpen, setIsModuleModalOpen] = useState<boolean>(false);
  const [selectedModuleForEdit, setSelectedModuleForEdit] =
    useState<ModuleFormData | null>(null);

  // Table row actions menu
  const [actionMenuAnchor, setActionMenuAnchor] =
    useState<HTMLButtonElement | null>(null);
  const [targetModule, setTargetModule] = useState<ModuleEntity | null>(null);

  // Confirm Active / Inactive Dialog state
  const [moduleToToggle, setModuleToToggle] = useState<ModuleEntity | null>(null);
  const [isConfirmToggleOpen, setIsConfirmToggleOpen] =
    useState<boolean>(false);

  // Resolves the module display name using translation or fallback
  const getModuleDisplayName = useCallback(
    (keyOrModule: string | ModuleEntity): string => {
      if (typeof keyOrModule === "object" && keyOrModule) {
        const lang = i18n.language?.startsWith("en") ? "en" : "es";
        const altLang = lang === "en" ? "es" : "en";
        const keyTrans = keyOrModule.translates?.find((tr) => tr.key === "key");
        const translated = keyTrans?.[lang] || keyTrans?.[altLang];
        if (translated) return translated;
      }
      const key =
        typeof keyOrModule === "string" ? keyOrModule : keyOrModule.key;

      if (i18n.exists(`modules:module_names.${key}`)) {
        return t(`modules:module_names.${key}`);
      }

      return t("modules:empty_value", "-");
    },
    [i18n, t]
  );

  // Query 1: All modules for filter dropdowns (all=true, includes=false)
  const {
    data: allModulesResponse,
    isLoading: isLoadingAllModules,
    isFetching: isFetchingAllModules,
  } = useModules({ all: true, includes: false });

  // Key filter options
  const keyFilterOptions = useMemo(() => {
    if (!allModulesResponse?.data) return [];
    return allModulesResponse.data.map((m) => {
      const name = getModuleDisplayName(m);
      return {
        value: m.key,
        label: name !== "-" ? `${name} (${m.key})` : m.key,
      };
    });
  }, [allModulesResponse?.data, getModuleDisplayName]);

  // Group filter options
  const groupByFilterOptions = useMemo(() => {
    if (!allModulesResponse?.data) return [];
    const groups = Array.from(
      new Set(allModulesResponse.data.map((m) => m.group_by).filter(Boolean))
    );
    return groups.map((group) => ({
      value: group,
      label: group,
    }));
  }, [allModulesResponse?.data]);

  // Ransack query for paginated table
  const ransackQuery = useMemo(() => {
    const q: Record<string, unknown> = {};

    if (searchTerm.trim()) {
      q.key_cont = searchTerm.trim();
    }
    if (appliedFilterKeys.length > 0) {
      q.key_in = appliedFilterKeys;
    }
    if (appliedFilterGroups.length > 0) {
      q.group_by_in = appliedFilterGroups;
    }
    if (appliedFilterActive !== null) {
      q.is_active_eq = appliedFilterActive;
    }

    return Object.keys(q).length > 0 ? q : undefined;
  }, [
    searchTerm,
    appliedFilterKeys,
    appliedFilterGroups,
    appliedFilterActive,
  ]);

  // Query 2: Paginated modules for table (with includes=true for translations)
  const {
    data: modulesResponse,
    isLoading: isLoadingModules,
    isFetching: isFetchingModules,
    isError: isErrorModules,
    error: modulesError,
    refetch: refetchModules,
  } = useModules({
    page: page + 1,
    size: rowsPerPage,
    includes: true,
    q: ransackQuery,
  });

  // Mutations
  const createModuleMutation = useCreateModule();
  const updateModuleMutation = useUpdateModule();

  const isMutating =
    createModuleMutation.isPending || updateModuleMutation.isPending;
  const isBusy = isLoadingModules || isFetchingModules || isMutating;

  const modulesList: ModuleEntity[] = useMemo(
    () => modulesResponse?.data ?? [],
    [modulesResponse?.data]
  );
  const totalCount = modulesResponse?.meta?.total_items ?? 0;

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    sileo.info({
      title: t("modules:copy"),
      description: t("modules:copied"),
    });
  };

  const handleOpenActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    item: ModuleEntity
  ) => {
    setActionMenuAnchor(e.currentTarget);
    setTargetModule(item);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchor(null);
    setTargetModule(null);
  };

  const handleOpenCreateModal = () => {
    setSelectedModuleForEdit(null);
    setIsModuleModalOpen(true);
  };

  const handleOpenEditModal = () => {
    if (targetModule) {
      const transItem = targetModule.translates?.find((tr) => tr.key === "key");
      setSelectedModuleForEdit({
        id: targetModule.id,
        key: targetModule.key,
        group_by: targetModule.group_by,
        nameTranslations: {
          es: transItem?.es || "",
          en: transItem?.en || "",
        },
        isActive: targetModule.is_active ?? true,
      });
      setIsModuleModalOpen(true);
    }
    handleCloseActionMenu();
  };

  const handleRequestToggleActive = (item: ModuleEntity) => {
    setModuleToToggle(item);
    setIsConfirmToggleOpen(true);
    handleCloseActionMenu();
  };

  const handleCloseConfirmToggle = () => {
    setIsConfirmToggleOpen(false);
    setModuleToToggle(null);
  };

  const handleConfirmToggleActive = async () => {
    if (!moduleToToggle) return;
    try {
      await updateModuleMutation.mutateAsync({
        moduleId: moduleToToggle.id,
        payload: {
          is_active: !(moduleToToggle.is_active ?? true),
        },
      });
      setIsConfirmToggleOpen(false);
      setModuleToToggle(null);
    } catch {
      // Toast is handled in mutation onError
    }
  };

  const handleSaveModule = async (data: ModuleFormData) => {
    try {
      if (data.id) {
        await updateModuleMutation.mutateAsync({
          moduleId: data.id,
          payload: {
            key: data.key,
            group_by: data.group_by,
            is_active: data.isActive,
            translates: data.translates,
          },
        });
      } else {
        await createModuleMutation.mutateAsync({
          key: data.key,
          group_by: data.group_by,
          is_active: data.isActive,
          translates: data.translates,
        });
      }
      setIsModuleModalOpen(false);
      setSelectedModuleForEdit(null);
    } catch {
      // Toast is handled in mutation onError
    }
  };

  // Filter application
  const handleApplyFilters = () => {
    setAppliedFilterKeys(draftFilterKeys);
    setAppliedFilterGroups(draftFilterGroups);
    setAppliedFilterActive(draftFilterActive);
    setPage(0);
  };

  const handleClearFilters = () => {
    setDraftFilterKeys([]);
    setDraftFilterGroups([]);
    setDraftFilterActive(true);
    setAppliedFilterKeys([]);
    setAppliedFilterGroups([]);
    setAppliedFilterActive(null);
    setPage(0);
  };

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilterKeys.length > 0) count += appliedFilterKeys.length;
    if (appliedFilterGroups.length > 0) count += appliedFilterGroups.length;
    if (appliedFilterActive !== null) count += 1;
    return count;
  }, [appliedFilterKeys, appliedFilterGroups, appliedFilterActive]);

  return (
    <Box>
      <PageHeader>
        <PageTitleContainer>
          <ViewModuleOutlinedIcon color="primary" fontSize="large" />
          <PageTitle>{t("modules:title")}</PageTitle>
        </PageTitleContainer>
        <PageSubtitle>{t("modules:subtitle")}</PageSubtitle>
      </PageHeader>

      <FilterRow>
        <Filter
          onFilter={handleApplyFilters}
          onClear={handleClearFilters}
          activeCount={activeFiltersCount}
          title={t("modules:filter_modal_title")}
          subtitle={t("modules:filter_modal_subtitle")}
        >
          <SelectMultipleInput
            label={t("modules:table.key")}
            options={keyFilterOptions}
            value={draftFilterKeys}
            onChange={setDraftFilterKeys}
            placeholder={t("modules:form.key_placeholder")}
            disabled={isBusy || isLoadingAllModules || isFetchingAllModules}
          />

          <SelectMultipleInput
            label={t("modules:table.group_by")}
            options={groupByFilterOptions}
            value={draftFilterGroups}
            onChange={setDraftFilterGroups}
            placeholder={t("modules:form.group_by_placeholder")}
            disabled={isBusy || isLoadingAllModules || isFetchingAllModules}
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
                  disabled={isBusy}
                />
              }
              label={t("modules:form.active")}
              labelPlacement="start"
              sx={{ m: 0, width: "100%", justifyContent: "space-between" }}
            />
          </Box>
        </Filter>
      </FilterRow>

      {activeFiltersCount > 0 && (
        <ActiveFilters>
          {appliedFilterKeys.map((key) => {
            const matched = allModulesResponse?.data?.find(
              (m) => m.key === key
            );
            const label = matched ? getModuleDisplayName(matched) : key;
            return (
              <FilterChips
                key={`mod-key-${key}`}
                label={t("modules:filter_chips.key", {
                  value: label !== "-" ? `${label} (${key})` : key,
                })}
                onAction={() => {
                  setAppliedFilterKeys((prev) => prev.filter((k) => k !== key));
                  setPage(0);
                }}
              />
            );
          })}
          {appliedFilterGroups.map((group) => (
            <FilterChips
              key={`mod-group-${group}`}
              label={t("modules:filter_chips.group_by", { value: group })}
              onAction={() => {
                setAppliedFilterGroups((prev) =>
                  prev.filter((g) => g !== group)
                );
                setPage(0);
              }}
            />
          ))}
          {appliedFilterActive !== null && (
            <FilterChips
              label={
                appliedFilterActive
                  ? t("modules:filter_chips.active_only")
                  : t("modules:no")
              }
              onAction={() => {
                setAppliedFilterActive(null);
                setPage(0);
              }}
            />
          )}
        </ActiveFilters>
      )}

      {isErrorModules && (
        <Box sx={{ mb: 2.5 }}>
          <Alert
            severity="error"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => refetchModules()}
              >
                {t("core:retry", "Reintentar")}
              </Button>
            }
          >
            <AlertTitle>
              {t("modules:error_state.title", "Error al cargar los módulos")}
            </AlertTitle>
            {modulesError instanceof Error
              ? modulesError.message
              : t(
                  "modules:error_state.description",
                  "No se pudo obtener el listado de módulos desde el servidor."
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
            placeholder={t("modules:search_placeholder")}
            fullWidth
            disabled={isLoadingModules || isMutating}
          />
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlinedIcon />}
          onClick={handleOpenCreateModal}
          disabled={isBusy}
          sx={(theme) => ({
            borderRadius: 2,
            color: theme.palette.primary.contrastText,
          })}
        >
          {t("modules:new_module")}
        </Button>
      </TableTopBar>

      <Skeleton loading={isLoadingModules} name="modules-table">
        <StyledTableContainer>
          {isFetchingModules && !isLoadingModules && (
            <LinearProgress sx={{ height: 3 }} />
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
                  <TableCell>{t("modules:table.id")}</TableCell>
                  <TableCell>{t("modules:table.name")}</TableCell>
                  <TableCell>{t("modules:table.key")}</TableCell>
                  <TableCell>{t("modules:table.group_by")}</TableCell>
                  <TableCell>{t("modules:table.active")}</TableCell>
                  <TableCell align="center">
                    {t("modules:table.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!isLoadingModules && modulesList.length === 0 ? (
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
                        <ViewModuleOutlinedIcon
                          sx={{ fontSize: 48, color: "text.disabled" }}
                        />
                        <Typography variant="h6" color="text.secondary">
                          {t(
                            "modules:empty_state.title",
                            "No hay módulos disponibles"
                          )}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.disabled"
                          sx={{ maxWidth: 400 }}
                        >
                          {t(
                            "modules:empty_state.description",
                            "No se encontraron módulos actualmente. Comience agregando uno nuevo."
                          )}
                        </Typography>
                        <Button
                          variant="contained"
                          size="small"
                          color="primary"
                          startIcon={<AddCircleOutlinedIcon />}
                          onClick={handleOpenCreateModal}
                          disabled={isBusy}
                          sx={(theme) => ({
                            mt: 1,
                            borderRadius: 2,
                            color: theme.palette.primary.contrastText,
                          })}
                        >
                          {t("modules:empty_state.cta", "Crear primer módulo")}
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  modulesList.map((m) => {
                    const displayName = getModuleDisplayName(m);
                    const isRowActive = m.is_active ?? true;

                    return (
                      <TableRow
                        key={m.id}
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
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            {m.id.includes("-")
                              ? `${m.id.split("-")[0]}...`
                              : m.id}
                            <Tooltip
                              title={t("modules:copy")}
                              arrow
                              placement="top"
                            >
                              <IconButton
                                size="small"
                                onClick={() => handleCopyId(m.id)}
                                aria-label={t("modules:copy")}
                                disabled={isBusy}
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
                            {displayName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <KeyBadge>{m.key}</KeyBadge>
                        </TableCell>
                        <TableCell>
                          {m.group_by ? (
                            <Chip
                              label={m.group_by}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ) : (
                            t("modules:empty_value")
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              isRowActive
                                ? t("modules:yes")
                                : t("modules:no")
                            }
                            color={isRowActive ? "success" : "error"}
                            size="small"
                            variant={isRowActive ? "filled" : "outlined"}
                            sx={
                              isRowActive
                                ? { color: "success.contrastText" }
                                : {}
                            }
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="primary"
                            aria-label={t("modules:table.actions")}
                            onClick={(e) => handleOpenActionMenu(e, m)}
                            disabled={isBusy}
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
            count={totalCount}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            disabled={isBusy}
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
        <MenuItem
          onClick={handleOpenEditModal}
          sx={{ borderRadius: 1 }}
          disabled={isBusy}
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("modules:actions_menu.update")} />
        </MenuItem>
        {targetModule && (
          <MenuItem
            onClick={() => handleRequestToggleActive(targetModule)}
            sx={{ borderRadius: 1 }}
            disabled={isBusy}
          >
            <ListItemIcon>
              {targetModule.is_active ?? true ? (
                <BlockOutlinedIcon fontSize="small" color="error" />
              ) : (
                <CheckCircleOutlineOutlinedIcon
                  fontSize="small"
                  color="success"
                />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                targetModule.is_active ?? true
                  ? t("modules:deactivate")
                  : t("modules:activate")
              }
            />
          </MenuItem>
        )}
      </Menu>

      {/* Confirm Toggle Active Dialog */}
      <ConfirmDialog
        open={isConfirmToggleOpen}
        onClose={handleCloseConfirmToggle}
        onConfirm={handleConfirmToggleActive}
        isLoading={isMutating}
        title={
          moduleToToggle?.is_active ?? true
            ? t("modules:confirm_deactivate_title")
            : t("modules:confirm_activate_title")
        }
        message={
          moduleToToggle?.is_active ?? true
            ? t("modules:confirm_deactivate_message", {
                name: moduleToToggle?.key,
              })
            : t("modules:confirm_activate_message", {
                name: moduleToToggle?.key,
              })
        }
        confirmText={
          moduleToToggle?.is_active ?? true
            ? t("modules:deactivate")
            : t("modules:activate")
        }
        cancelText={t("core:cancel")}
      />

      {/* Module Create / Edit Modal */}
      <ModuleModal
        open={isModuleModalOpen}
        onClose={() => {
          setIsModuleModalOpen(false);
          setSelectedModuleForEdit(null);
        }}
        onSubmit={handleSaveModule}
        initialData={selectedModuleForEdit}
        isSubmitting={isMutating}
      />
    </Box>
  );
};

export default Modules;
