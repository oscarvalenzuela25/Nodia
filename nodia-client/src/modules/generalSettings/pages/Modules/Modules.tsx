import type { FC, MouseEvent } from "react";
import { useState, useMemo, useCallback, Fragment } from "react";
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
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import SubdirectoryArrowRightOutlinedIcon from "@mui/icons-material/SubdirectoryArrowRightOutlined";
import { Skeleton } from "boneyard-js/react";
import { sileo } from "sileo";

import Filter from "../../../../components/Filter";
import FilterChips from "../../../../components/Filter/components/FilterChips";
import InputSearch from "../../../../components/inputs/InputSearch";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import ModuleModal from "./components/ModuleModal";
import type {
  ModuleEntity,
  ModuleFormData,
  ParentModuleOption,
} from "./types";
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
  TypeTag,
  ParentTag,
  SubmoduleTableRow,
} from "./styles";

const Modules: FC = () => {
  const { t, i18n } = useTranslation(["modules", "core"]);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Collapsed / Expanded state for module rows
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(
    new Set()
  );

  const handleToggleExpand = (id: string) => {
    setExpandedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter modal draft state
  const [draftFilterTypes, setDraftFilterTypes] = useState<string[]>([]);
  const [draftFilterModuleKeys, setDraftFilterModuleKeys] = useState<string[]>(
    []
  );
  const [draftFilterSubmoduleKeys, setDraftFilterSubmoduleKeys] = useState<
    string[]
  >([]);
  const [draftFilterActive, setDraftFilterActive] = useState<boolean>(true);

  // Applied filter state
  const [appliedFilterTypes, setAppliedFilterTypes] = useState<string[]>([]);
  const [appliedFilterModuleKeys, setAppliedFilterModuleKeys] = useState<
    string[]
  >([]);
  const [appliedFilterSubmoduleKeys, setAppliedFilterSubmoduleKeys] = useState<
    string[]
  >([]);
  const [appliedFilterActive, setAppliedFilterActive] = useState<
    boolean | null
  >(null);

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
      const key =
        typeof keyOrModule === "string" ? keyOrModule : keyOrModule.key;

      // 1. Try translation lookup
      if (i18n.exists(`modules:module_names.${key}`)) {
        return t(`modules:module_names.${key}`);
      }

      return t("modules:empty_value", "-");
    },
    [i18n, t]
  );

  // Query 1: All modules for filter dropdowns & modal parent options
  const {
    data: allModulesResponse,
    isLoading: isLoadingAllModules,
    isFetching: isFetchingAllModules,
  } = useModules({ all: true, includes: false });

  // Check whether modules of type 'module' or 'submodule' exist
  const hasModuleType = useMemo(() => {
    return (
      allModulesResponse?.data?.some((m) => m.type === "module") ?? false
    );
  }, [allModulesResponse?.data]);

  const hasSubmoduleType = useMemo(() => {
    return (
      allModulesResponse?.data?.some((m) => m.type === "submodule") ?? false
    );
  }, [allModulesResponse?.data]);

  // Options for filter modal - Type (conditioned on existing types in the system)
  const moduleTypeFilterOptions = useMemo(() => {
    const options = [];
    if (hasModuleType) {
      options.push({
        value: "module",
        label: t("modules:types.module", "Módulo"),
      });
    }
    if (hasSubmoduleType) {
      options.push({
        value: "submodule",
        label: t("modules:types.submodule", "Submódulo"),
      });
    }
    return options;
  }, [hasModuleType, hasSubmoduleType, t]);

  // Options for filter modal - Modules of type 'module'
  const moduleFilterOptions = useMemo(() => {
    if (!allModulesResponse?.data) return [];
    return allModulesResponse.data
      .filter((m) => m.type === "module")
      .map((m) => {
        const name = getModuleDisplayName(m);
        return {
          value: m.key,
          label: name !== "-" ? name : m.key,
        };
      });
  }, [allModulesResponse?.data, getModuleDisplayName]);

  // Options for filter modal - Modules of type 'submodule'
  const submoduleFilterOptions = useMemo(() => {
    if (!allModulesResponse?.data) return [];
    return allModulesResponse.data
      .filter((m) => m.type === "submodule")
      .map((m) => {
        const name = getModuleDisplayName(m);
        return {
          value: m.key,
          label: name !== "-" ? name : m.key,
        };
      });
  }, [allModulesResponse?.data, getModuleDisplayName]);

  // Parent module options (modules whose type === 'module') for ModuleModal
  const parentModuleOptions: ParentModuleOption[] = useMemo(() => {
    if (!allModulesResponse?.data) return [];
    return allModulesResponse.data
      .filter((m) => m.type === "module")
      .map((m) => {
        const name = getModuleDisplayName(m);
        return {
          value: m.id,
          label: name !== "-" ? name : m.key,
        };
      });
  }, [allModulesResponse?.data, getModuleDisplayName]);

  // Ransack query for paginated table
  const ransackQuery = useMemo(() => {
    const q: Record<string, unknown> = {};

    if (searchTerm.trim()) {
      q.key_cont = searchTerm.trim();
    }
    if (appliedFilterTypes.length > 0) {
      q.type_in = appliedFilterTypes;
    }
    const combinedKeys = [
      ...appliedFilterModuleKeys,
      ...appliedFilterSubmoduleKeys,
    ];
    if (combinedKeys.length > 0) {
      q.key_in = combinedKeys;
    }
    if (appliedFilterActive !== null) {
      q.is_active_eq = appliedFilterActive;
    }

    return Object.keys(q).length > 0 ? q : undefined;
  }, [
    searchTerm,
    appliedFilterTypes,
    appliedFilterModuleKeys,
    appliedFilterSubmoduleKeys,
    appliedFilterActive,
  ]);

  // Query 2: Paginated modules for table
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

  const modulesList = useMemo(
    () => modulesResponse?.data ?? [],
    [modulesResponse?.data]
  );
  const totalCount = modulesResponse?.meta?.total_items ?? 0;

  interface HierarchicalModuleRow {
    module: ModuleEntity;
    children: ModuleEntity[];
  }

  const hierarchicalRows = useMemo<HierarchicalModuleRow[]>(() => {
    const mapById = new Map<string, ModuleEntity>();
    modulesList.forEach((m) => mapById.set(m.id, m));

    const childrenByParentId = new Map<string, ModuleEntity[]>();
    const isChildInView = new Set<string>();

    // Pass 1: find all submodules whose parent is also present in modulesList
    modulesList.forEach((m) => {
      const parentId = m.parent_id ?? m.parent_module?.id;
      if (parentId && mapById.has(parentId)) {
        isChildInView.add(m.id);
        const existing = childrenByParentId.get(parentId) ?? [];
        existing.push(m);
        childrenByParentId.set(parentId, existing);
      }
    });

    // Pass 2: top-level rows are items that are NOT treated as children of another row in the current view
    const rows: HierarchicalModuleRow[] = [];
    modulesList.forEach((m) => {
      if (!isChildInView.has(m.id)) {
        rows.push({
          module: m,
          children: childrenByParentId.get(m.id) ?? [],
        });
      }
    });

    return rows;
  }, [modulesList]);

  const isModuleWithChildren = useMemo(() => {
    if (!moduleToToggle || moduleToToggle.type !== "module") return false;
    const allMods = allModulesResponse?.data ?? modulesList;
    return allMods.some(
      (m) =>
        m.type === "submodule" &&
        (m.parent_id === moduleToToggle.id ||
          m.parent_module?.id === moduleToToggle.id)
    );
  }, [moduleToToggle, allModulesResponse?.data, modulesList]);

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
      setSelectedModuleForEdit({
        id: targetModule.id,
        key: targetModule.key,
        type: targetModule.type,
        parentId:
          targetModule.parent_id ??
          targetModule.parent_module?.id ??
          null,
        parentKey: targetModule.parent_module?.key ?? null,
        nameTranslations: {},
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
            type: data.type,
            parent_id: data.type === "submodule" ? data.parentId : null,
            is_active: data.isActive,
          },
        });
      } else {
        await createModuleMutation.mutateAsync({
          key: data.key,
          type: data.type,
          parent_id: data.type === "submodule" ? data.parentId : null,
          is_active: data.isActive,
        });
      }
      setIsModuleModalOpen(false);
      setSelectedModuleForEdit(null);
    } catch {
      // Toast is handled in mutation onError
    }
  };

  const handleDraftTypesChange = (newTypes: string[]) => {
    setDraftFilterTypes(newTypes);
    if (!newTypes.includes("module")) {
      setDraftFilterModuleKeys([]);
    }
    if (!newTypes.includes("submodule")) {
      setDraftFilterSubmoduleKeys([]);
    }
  };

  // Filter application
  const handleApplyFilters = () => {
    setAppliedFilterTypes(draftFilterTypes);
    setAppliedFilterModuleKeys(
      draftFilterTypes.includes("module") ? draftFilterModuleKeys : []
    );
    setAppliedFilterSubmoduleKeys(
      draftFilterTypes.includes("submodule") ? draftFilterSubmoduleKeys : []
    );
    setAppliedFilterActive(draftFilterActive);
    setPage(0);
  };

  const handleClearFilters = () => {
    setDraftFilterTypes([]);
    setDraftFilterModuleKeys([]);
    setDraftFilterSubmoduleKeys([]);
    setDraftFilterActive(true);
    setAppliedFilterTypes([]);
    setAppliedFilterModuleKeys([]);
    setAppliedFilterSubmoduleKeys([]);
    setAppliedFilterActive(null);
    setPage(0);
  };

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilterTypes.length > 0) count += appliedFilterTypes.length;
    if (appliedFilterModuleKeys.length > 0)
      count += appliedFilterModuleKeys.length;
    if (appliedFilterSubmoduleKeys.length > 0)
      count += appliedFilterSubmoduleKeys.length;
    if (appliedFilterActive !== null) count += 1;
    return count;
  }, [
    appliedFilterTypes,
    appliedFilterModuleKeys,
    appliedFilterSubmoduleKeys,
    appliedFilterActive,
  ]);


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
            label={t("modules:table.type")}
            options={moduleTypeFilterOptions}
            value={draftFilterTypes}
            onChange={handleDraftTypesChange}
            placeholder={t("modules:form.type_placeholder")}
            disabled={isBusy}
          />

          {draftFilterTypes.includes("module") && (
            <SelectMultipleInput
              label={t("modules:modules_label", "Módulos")}
              options={moduleFilterOptions}
              value={draftFilterModuleKeys}
              onChange={setDraftFilterModuleKeys}
              placeholder={t(
                "modules:modules_placeholder",
                "Seleccionar módulos..."
              )}
              disabled={isBusy}
            />
          )}

          {draftFilterTypes.includes("submodule") && (
            <SelectMultipleInput
              label={t("modules:submodules_label", "Submódulos")}
              options={submoduleFilterOptions}
              value={draftFilterSubmoduleKeys}
              onChange={setDraftFilterSubmoduleKeys}
              placeholder={t(
                "modules:submodules_placeholder",
                "Seleccionar submódulos..."
              )}
              disabled={isBusy}
            />
          )}

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
          {appliedFilterTypes.map((typeVal) => {
            const label = t(`modules:types.${typeVal}`, typeVal);
            return (
              <FilterChips
                key={`mod-type-${typeVal}`}
                label={t("modules:filter_chips.type", { value: label })}
                onAction={() => {
                  setAppliedFilterTypes((prev) =>
                    prev.filter((tp) => tp !== typeVal)
                  );
                  if (typeVal === "module") {
                    setAppliedFilterModuleKeys([]);
                  }
                  if (typeVal === "submodule") {
                    setAppliedFilterSubmoduleKeys([]);
                  }
                  setPage(0);
                }}
              />
            );
          })}
          {appliedFilterModuleKeys.map((key) => {
            const matched = allModulesResponse?.data?.find(
              (m) => m.key === key
            );
            const label = matched ? getModuleDisplayName(matched) : key;
            return (
              <FilterChips
                key={`mod-key-${key}`}
                label={t("modules:filter_chips.module", { value: label })}
                onAction={() => {
                  setAppliedFilterModuleKeys((prev) =>
                    prev.filter((k) => k !== key)
                  );
                  setPage(0);
                }}
              />
            );
          })}
          {appliedFilterSubmoduleKeys.map((key) => {
            const matched = allModulesResponse?.data?.find(
              (m) => m.key === key
            );
            const label = matched ? getModuleDisplayName(matched) : key;
            return (
              <FilterChips
                key={`submod-key-${key}`}
                label={t("modules:filter_chips.submodule", { value: label })}
                onAction={() => {
                  setAppliedFilterSubmoduleKeys((prev) =>
                    prev.filter((k) => k !== key)
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
                  <TableCell>{t("modules:table.key")}</TableCell>
                  <TableCell>{t("modules:table.name")}</TableCell>
                  <TableCell>{t("modules:table.type")}</TableCell>
                  <TableCell>{t("modules:table.parent_module")}</TableCell>
                  <TableCell>{t("modules:table.active")}</TableCell>
                  <TableCell align="center">
                    {t("modules:table.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!isLoadingModules && hierarchicalRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
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
                  hierarchicalRows.map(({ module: m, children }) => {
                    const displayName = getModuleDisplayName(m);
                    const typeLabel = t(`modules:types.${m.type}`, m.type);
                    const parentDisplayName = m.parent_module
                      ? getModuleDisplayName(m.parent_module.key)
                      : null;
                    const resolvedParentLabel =
                      parentDisplayName && parentDisplayName !== "-"
                        ? parentDisplayName
                        : m.parent_module?.key;
                    const isRowActive = m.is_active ?? true;
                    const hasChildren = children.length > 0;
                    const isExpanded = expandedModuleIds.has(m.id);

                    return (
                      <Fragment key={m.id}>
                        <TableRow
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
                              {hasChildren ? (
                                <IconButton
                                  size="small"
                                  onClick={() => handleToggleExpand(m.id)}
                                  aria-label={
                                    isExpanded
                                      ? t(
                                          "modules:collapse",
                                          "Colapsar submódulos"
                                        )
                                      : t(
                                          "modules:expand",
                                          "Expandir submódulos"
                                        )
                                  }
                                  disabled={isBusy}
                                  sx={{ p: 0.5 }}
                                >
                                  {isExpanded ? (
                                    <KeyboardArrowDownIcon fontSize="small" />
                                  ) : (
                                    <KeyboardArrowRightIcon fontSize="small" />
                                  )}
                                </IconButton>
                              ) : (
                                <Box sx={{ width: 28 }} />
                              )}
                              {m.id.split("-")[0]}...
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
                            <KeyBadge>{m.key}</KeyBadge>
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
                            <TypeTag
                              moduleType={m.type}
                              label={typeLabel}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {m.parent_module ? (
                              <ParentTag
                                hasParent={true}
                                label={resolvedParentLabel ?? "-"}
                                size="small"
                              />
                            ) : (
                              <ParentTag
                                hasParent={false}
                                label={t(
                                  "modules:no_parent",
                                  "Sin módulo padre"
                                )}
                                size="small"
                              />
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

                        {/* Submodule child rows when expanded */}
                        {isExpanded &&
                          children.map((child) => {
                            const childDisplayName =
                              getModuleDisplayName(child);
                            const childTypeLabel = t(
                              `modules:types.${child.type}`,
                              child.type
                            );
                            const childParentDisplayName = child.parent_module
                              ? getModuleDisplayName(child.parent_module.key)
                              : displayName;
                            const childResolvedParentLabel =
                              childParentDisplayName &&
                              childParentDisplayName !== "-"
                                ? childParentDisplayName
                                : child.parent_module?.key ?? m.key;
                            const isChildRowActive = child.is_active ?? true;

                            return (
                              <SubmoduleTableRow key={child.id} hover>
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
                                      pl: 3,
                                    }}
                                  >
                                    <SubdirectoryArrowRightOutlinedIcon
                                      fontSize="small"
                                      sx={{
                                        color: "text.disabled",
                                        fontSize: "1.1rem",
                                      }}
                                    />
                                    {child.id.split("-")[0]}...
                                    <Tooltip
                                      title={t("modules:copy")}
                                      arrow
                                      placement="top"
                                    >
                                      <IconButton
                                        size="small"
                                        onClick={() => handleCopyId(child.id)}
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
                                  <KeyBadge>{child.key}</KeyBadge>
                                </TableCell>
                                <TableCell>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: "medium" }}
                                  >
                                    {childDisplayName}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <TypeTag
                                    moduleType={child.type}
                                    label={childTypeLabel}
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  <ParentTag
                                    hasParent={true}
                                    label={childResolvedParentLabel ?? "-"}
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={
                                      isChildRowActive
                                        ? t("modules:yes")
                                        : t("modules:no")
                                    }
                                    color={
                                      isChildRowActive ? "success" : "error"
                                    }
                                    size="small"
                                    variant={
                                      isChildRowActive ? "filled" : "outlined"
                                    }
                                    sx={
                                      isChildRowActive
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
                                    onClick={(e) =>
                                      handleOpenActionMenu(e, child)
                                    }
                                    disabled={isBusy}
                                  >
                                    <MoreVertIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </SubmoduleTableRow>
                            );
                          })}
                      </Fragment>
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
            ? isModuleWithChildren
              ? t("modules:confirm_deactivate_with_children_message", {
                  name: moduleToToggle?.key,
                })
              : t("modules:confirm_deactivate_message", {
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
        availableParents={parentModuleOptions}
        isSubmitting={isMutating}
        isLoadingParents={isLoadingAllModules || isFetchingAllModules}
      />
    </Box>
  );
};

export default Modules;
