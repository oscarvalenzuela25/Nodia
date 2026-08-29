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
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

import Filter from "../../../../components/Filter";
import FilterChips from "../../../../components/Filter/components/FilterChips";
import InputSearch from "../../../../components/inputs/InputSearch";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import ModuleModal from "./components/ModuleModal";
import type {
  ModuleItem,
  ModuleFormData,
  ParentModuleOption,
} from "./types";
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
} from "./styles";

const INITIAL_MODULES: ModuleItem[] = [
  {
    id: "m1114567-e89b-12d3-a456-426614174001",
    key: "general_settings",
    type: "module",
    parentModule: null,
    nameTranslations: {
      es: "Ajustes Generales",
      en: "General Settings",
    },
    isActive: true,
  },
  {
    id: "m1114567-e89b-12d3-a456-426614174002",
    key: "users",
    type: "submodule",
    parentModule: {
      id: "m1114567-e89b-12d3-a456-426614174001",
      key: "general_settings",
    },
    nameTranslations: {
      es: "Usuarios",
      en: "Users",
    },
    isActive: true,
  },
  {
    id: "m1114567-e89b-12d3-a456-426614174003",
    key: "roles",
    type: "submodule",
    parentModule: {
      id: "m1114567-e89b-12d3-a456-426614174001",
      key: "general_settings",
    },
    nameTranslations: {
      es: "Roles",
      en: "Roles",
    },
    isActive: true,
  },
  {
    id: "m1114567-e89b-12d3-a456-426614174004",
    key: "actions",
    type: "submodule",
    parentModule: {
      id: "m1114567-e89b-12d3-a456-426614174001",
      key: "general_settings",
    },
    nameTranslations: {
      es: "Acciones",
      en: "Actions",
    },
    isActive: true,
  },
  {
    id: "m1114567-e89b-12d3-a456-426614174005",
    key: "modules",
    type: "submodule",
    parentModule: {
      id: "m1114567-e89b-12d3-a456-426614174001",
      key: "general_settings",
    },
    nameTranslations: {
      es: "Módulos",
      en: "Modules",
    },
    isActive: true,
  },
  {
    id: "m2224567-e89b-12d3-a456-426614174001",
    key: "security",
    type: "module",
    parentModule: null,
    nameTranslations: {
      es: "Seguridad y Accesos",
      en: "Security & Access",
    },
    isActive: true,
  },
  {
    id: "m2224567-e89b-12d3-a456-426614174002",
    key: "audit",
    type: "submodule",
    parentModule: {
      id: "m2224567-e89b-12d3-a456-426614174001",
      key: "security",
    },
    nameTranslations: {
      es: "Auditoría",
      en: "Audit",
    },
    isActive: true,
  },
  {
    id: "m3334567-e89b-12d3-a456-426614174001",
    key: "analytics",
    type: "module",
    parentModule: null,
    nameTranslations: {
      es: "Reportes y Métricas",
      en: "Analytics & Reports",
    },
    isActive: true,
  },
  {
    id: "m3334567-e89b-12d3-a456-426614174002",
    key: "export_logs",
    type: "submodule",
    parentModule: {
      id: "m3334567-e89b-12d3-a456-426614174001",
      key: "analytics",
    },
    nameTranslations: {
      es: "Exportación de Datos",
      en: "Data Export",
    },
    isActive: false,
  },
];

const Modules: FC = () => {
  const { t, i18n } = useTranslation(["modules", "core"]);

  const [modulesList, setModulesList] = useState<ModuleItem[]>(INITIAL_MODULES);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Filter modal draft state
  const [draftFilterKeys, setDraftFilterKeys] = useState<string[]>([]);
  const [draftFilterTypes, setDraftFilterTypes] = useState<string[]>([]);
  const [draftFilterParentKeys, setDraftFilterParentKeys] = useState<string[]>(
    []
  );
  const [draftFilterActive, setDraftFilterActive] = useState<boolean>(true);

  // Applied filter state
  const [appliedFilterKeys, setAppliedFilterKeys] = useState<string[]>([]);
  const [appliedFilterTypes, setAppliedFilterTypes] = useState<string[]>([]);
  const [appliedFilterParentKeys, setAppliedFilterParentKeys] = useState<
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
  const [targetModule, setTargetModule] = useState<ModuleItem | null>(null);

  // Resolves the module display name using translation or fallback
  const getModuleDisplayName = useCallback(
    (keyOrModule: string | ModuleItem): string => {
      const key =
        typeof keyOrModule === "string" ? keyOrModule : keyOrModule.key;
      const currentLang = i18n.language?.toLowerCase().startsWith("en")
        ? "en"
        : "es";

      // 1. Try translation lookup
      if (i18n.exists(`modules:module_names.${key}`)) {
        return t(`modules:module_names.${key}`);
      }

      // 2. Try object's custom translations
      if (typeof keyOrModule !== "string" && keyOrModule.nameTranslations) {
        if (keyOrModule.nameTranslations[currentLang]) {
          return keyOrModule.nameTranslations[currentLang];
        }
        if (keyOrModule.nameTranslations.es) {
          return keyOrModule.nameTranslations.es;
        }
        if (keyOrModule.nameTranslations.en) {
          return keyOrModule.nameTranslations.en;
        }
      }

      return key;
    },
    [i18n, t]
  );

  // Parent module options (only modules whose type === 'module')
  const parentModuleOptions: ParentModuleOption[] = useMemo(() => {
    return modulesList
      .filter((m) => m.type === "module")
      .map((m) => ({
        value: m.key,
        label: getModuleDisplayName(m),
      }));
  }, [modulesList, getModuleDisplayName]);

  // Options for filter modal - Key / Identifier
  const moduleKeyFilterOptions = useMemo(() => {
    return modulesList.map((m) => ({
      value: m.key,
      label: getModuleDisplayName(m),
    }));
  }, [modulesList, getModuleDisplayName]);

  // Options for filter modal - Type
  const moduleTypeFilterOptions = useMemo(() => {
    return [
      { value: "module", label: t("modules:types.module", "Módulo") },
      { value: "submodule", label: t("modules:types.submodule", "Submódulo") },
    ];
  }, [t]);

  const handleOpenActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    item: ModuleItem
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
        parentId: targetModule.parentModule?.key ?? null,
        parentKey: targetModule.parentModule?.key ?? null,
        nameTranslations: targetModule.nameTranslations,
        isActive: targetModule.isActive,
      });
      setIsModuleModalOpen(true);
    }
    handleCloseActionMenu();
  };

  const handleSaveModule = (data: ModuleFormData) => {
    if (data.id) {
      setModulesList((prev) =>
        prev.map((m) =>
          m.id === data.id
            ? {
                ...m,
                key: data.key,
                type: data.type,
                parentModule:
                  data.type === "submodule" && data.parentId
                    ? {
                        id: `pm-${data.parentId}`,
                        key: data.parentId,
                      }
                    : null,
                nameTranslations: data.nameTranslations,
                isActive: data.isActive,
              }
            : m
        )
      );
    } else {
      const newModule: ModuleItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : `mod-${Date.now()}`,
        key: data.key,
        type: data.type,
        parentModule:
          data.type === "submodule" && data.parentId
            ? {
                id: `pm-${data.parentId}`,
                key: data.parentId,
              }
            : null,
        nameTranslations: data.nameTranslations,
        isActive: data.isActive,
      };
      setModulesList((prev) => [newModule, ...prev]);
    }
  };

  // Filter application
  const handleApplyFilters = () => {
    setAppliedFilterKeys(draftFilterKeys);
    setAppliedFilterTypes(draftFilterTypes);
    setAppliedFilterParentKeys(draftFilterParentKeys);
    setAppliedFilterActive(draftFilterActive);
  };

  const handleClearFilters = () => {
    setDraftFilterKeys([]);
    setDraftFilterTypes([]);
    setDraftFilterParentKeys([]);
    setDraftFilterActive(true);
    setAppliedFilterKeys([]);
    setAppliedFilterTypes([]);
    setAppliedFilterParentKeys([]);
    setAppliedFilterActive(null);
  };

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilterKeys.length > 0) count += appliedFilterKeys.length;
    if (appliedFilterTypes.length > 0) count += appliedFilterTypes.length;
    if (appliedFilterParentKeys.length > 0)
      count += appliedFilterParentKeys.length;
    if (appliedFilterActive !== null) count += 1;
    return count;
  }, [
    appliedFilterKeys,
    appliedFilterTypes,
    appliedFilterParentKeys,
    appliedFilterActive,
  ]);

  // Filtered modules list
  const filteredModules = useMemo(() => {
    return modulesList.filter((m) => {
      const displayName = getModuleDisplayName(m).toLowerCase();
      const rawKey = m.key.toLowerCase();

      // 1. Search bar only by name or identifier
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matches = displayName.includes(query) || rawKey.includes(query);
        if (!matches) {
          return false;
        }
      }

      // 2. Filter by Module Key
      if (appliedFilterKeys.length > 0) {
        if (!appliedFilterKeys.includes(m.key)) {
          return false;
        }
      }

      // 3. Filter by Type
      if (appliedFilterTypes.length > 0) {
        if (!appliedFilterTypes.includes(m.type)) {
          return false;
        }
      }

      // 4. Filter by Submodules of (Parent Module)
      if (appliedFilterParentKeys.length > 0) {
        if (!m.parentModule || !appliedFilterParentKeys.includes(m.parentModule.key)) {
          return false;
        }
      }

      // 5. Filter by Active
      if (appliedFilterActive !== null) {
        if (m.isActive !== appliedFilterActive) {
          return false;
        }
      }

      return true;
    });
  }, [
    modulesList,
    searchTerm,
    appliedFilterKeys,
    appliedFilterTypes,
    appliedFilterParentKeys,
    appliedFilterActive,
    getModuleDisplayName,
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
            label={t("modules:table.key")}
            options={moduleKeyFilterOptions}
            value={draftFilterKeys}
            onChange={setDraftFilterKeys}
            placeholder={t("modules:form.key_placeholder")}
          />

          <SelectMultipleInput
            label={t("modules:table.type")}
            options={moduleTypeFilterOptions}
            value={draftFilterTypes}
            onChange={setDraftFilterTypes}
            placeholder={t("modules:form.type_placeholder")}
          />

          <SelectMultipleInput
            label={t("modules:filter_chips.parent", { value: "" }).replace(
              ": ",
              ""
            )}
            options={parentModuleOptions}
            value={draftFilterParentKeys}
            onChange={setDraftFilterParentKeys}
            placeholder={t("modules:form.parent_module_placeholder")}
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
            const matched = modulesList.find((m) => m.key === key);
            const label = matched ? getModuleDisplayName(matched) : key;
            return (
              <FilterChips
                key={`mod-key-${key}`}
                label={t("modules:filter_chips.module", { value: label })}
                onAction={() =>
                  setAppliedFilterKeys((prev) => prev.filter((k) => k !== key))
                }
              />
            );
          })}
          {appliedFilterTypes.map((typeVal) => {
            const label = t(`modules:types.${typeVal}`, typeVal);
            return (
              <FilterChips
                key={`mod-type-${typeVal}`}
                label={t("modules:filter_chips.type", { value: label })}
                onAction={() =>
                  setAppliedFilterTypes((prev) =>
                    prev.filter((tp) => tp !== typeVal)
                  )
                }
              />
            );
          })}
          {appliedFilterParentKeys.map((pKey) => {
            const label = getModuleDisplayName(pKey);
            return (
              <FilterChips
                key={`parent-key-${pKey}`}
                label={t("modules:filter_chips.parent", { value: label })}
                onAction={() =>
                  setAppliedFilterParentKeys((prev) =>
                    prev.filter((pk) => pk !== pKey)
                  )
                }
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
              onAction={() => setAppliedFilterActive(null)}
            />
          )}
        </ActiveFilters>
      )}

      <TableTopBar>
        <Box sx={{ width: { xs: "100%", sm: "360px" } }}>
          <InputSearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t("modules:search_placeholder")}
            fullWidth
          />
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlinedIcon />}
          onClick={handleOpenCreateModal}
          sx={(theme) => ({
            borderRadius: 2,
            color: theme.palette.primary.contrastText,
          })}
        >
          {t("modules:new_module")}
        </Button>
      </TableTopBar>

      <StyledTableContainer>
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
              {filteredModules.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    align="center"
                    sx={{ py: 4, color: "text.secondary" }}
                  >
                    {t("core:no_options_found")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredModules.map((m) => {
                  const displayName = getModuleDisplayName(m);
                  const typeLabel = t(`modules:types.${m.type}`, m.type);
                  const parentDisplayName = m.parentModule
                    ? getModuleDisplayName(m.parentModule.key)
                    : null;

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
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          {m.id.split("-")[0]}...
                          <Tooltip
                            title={t("modules:copy")}
                            arrow
                            placement="top"
                          >
                            <IconButton
                              size="small"
                              onClick={() =>
                                navigator.clipboard.writeText(m.id)
                              }
                              aria-label={t("modules:copy")}
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
                        {parentDisplayName ? (
                          <ParentTag
                            hasParent={true}
                            label={parentDisplayName}
                            size="small"
                          />
                        ) : (
                          <ParentTag
                            hasParent={false}
                            label={t("modules:no_parent", "Sin módulo padre")}
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            m.isActive
                              ? t("modules:yes")
                              : t("modules:no")
                          }
                          color={m.isActive ? "success" : "error"}
                          size="small"
                          variant={m.isActive ? "filled" : "outlined"}
                          sx={
                            m.isActive
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
      </StyledTableContainer>

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
          <ListItemText primary={t("modules:actions_menu.update")} />
        </MenuItem>
      </Menu>

      {/* Module Create / Edit Modal */}
      <ModuleModal
        open={isModuleModalOpen}
        onClose={() => setIsModuleModalOpen(false)}
        onSubmit={handleSaveModule}
        initialData={selectedModuleForEdit}
        availableParents={parentModuleOptions}
      />
    </Box>
  );
};

export default Modules;
