import { useMediaQuery, useTheme } from "@mui/material";
import type { FC, SyntheticEvent } from "react";
import { BUSINESS_ROUTE } from "../../constants/routes";
import { useId, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import GroupAddOutlinedIcon from "@mui/icons-material/GroupAddOutlined";
import KeyboardArrowUpOutlinedIcon from "@mui/icons-material/KeyboardArrowUpOutlined";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import { Skeleton } from "boneyard-js/react";
import { useIsMutating } from "@tanstack/react-query";

import useAuth from "../../../../hooks/useAuth";
import { HeaderCardSkeleton } from "../../../../components/skeletons";
import BusinessModal from "../Business/components/BusinessModal";
import BusinessCollaboratorModal from "../Business/components/BusinessCollaboratorModal";
import {
  useBusiness,
  useUpdateBusiness,
  useInvoices,
} from "../../infrastructure/useServices";
import type { BusinessFormData } from "../../infrastructure/types";
import { getBusinessDescription } from "../../infrastructure/businessDescription";

import OverviewTab from "./components/OverviewTab";
import ProductsTab from "./components/ProductsTab";
import ProvidersTab from "./components/ProvidersTab";
import InvoicesTab from "./components/InvoicesTab";
import CollaboratorsTab from "./components/CollaboratorsTab";
import SalesWorkspace from "./components/SalesWorkspace";
import type { SaleSection } from "../../infrastructure/salesTypes";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";

import {
  DetailContainer,
  DetailBreadcrumb,
  HeaderCard,
  HeaderTopSection,
  BusinessAvatarBox,
  HeaderInfoContainer,
  HeaderMetaRow,
  HeaderActions,
  TabsWrapper,
  StyledTabs,
  StyledTab,
  StatusPill,
  StatusDot,
} from "./styles";

const sections = [
  { value: "overview", label: "business:tab_overview", icon: DashboardOutlinedIcon },
  { value: "providers", label: "business:tab_providers", icon: StorefrontOutlinedIcon },
  { value: "products", label: "business:tab_products", icon: Inventory2OutlinedIcon },
  { value: "invoices", label: "business:tab_invoices", icon: ReceiptLongOutlinedIcon },
  { value: "pos", label: "business:pos.title" },
  { value: "sales", label: "business:pos.sales" },
  { value: "reports", label: "business:pos.reports" },
  { value: "collaborators", label: "business:tab_collaborators", icon: PeopleOutlinedIcon },
] as const;

const BusinessDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation(["business", "core"]);
  const mobile = useMediaQuery(useTheme().breakpoints.down("sm"));

  const [sectionParams, setSectionParams] = useSearchParams();
  const activeSection = sectionParams.get("section") ?? "overview";
  const activeTab = Math.max(0, sections.findIndex((section) => section.value === activeSection));
  const selectedSection = sections[activeTab].value;
  const saleSection: SaleSection | null = selectedSection === "pos" || selectedSection === "sales" || selectedSection === "reports" ? selectedSection : null;
  const setActiveTab = (index: number) => setSectionParams((params) => { params.set("section", sections[index]?.value ?? "overview"); return params; });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);
  const [collapsedHeaders, setCollapsedHeaders] = useState<Record<string, boolean>>({});
  const headerId = useId();
  const headerExpanded = collapsedHeaders[id ?? ""] === false;

  // Direct modal trigger states (from quick action buttons)
  const [directNewProductOpen, setDirectNewProductOpen] = useState(false);
  const [directNewProviderOpen, setDirectNewProviderOpen] = useState(false);
  const [directNewInvoiceOpen, setDirectNewInvoiceOpen] = useState(false);

  const { data: business, isLoading, isFetching, isError, refetch } = useBusiness(id);
  const updateMutation = useUpdateBusiness();
  const canManageBusiness = business?.user_role === "owner" || (!!user && business?.owner_id === user.id);

  // Badge counts (products, providers and collaborators are already available in business entity)
  const { data: invoicesData } = useInvoices({ q: { business_id_eq: id }, limit: 1 });

  const totalProducts = business?.products_count ?? 0;
  const totalProviders = business?.total_providers_count ?? 0;
  const totalInvoices = invoicesData?.meta?.total_items ?? 0;
  const totalCollaborators = business?.collaborators?.length ?? business?.collaborators_count ?? 0;
  const sectionCounts: Partial<Record<(typeof sections)[number]["value"], number>> = {
    providers: totalProviders, products: totalProducts, invoices: totalInvoices, collaborators: totalCollaborators,
  };

  const isMutating = useIsMutating() > 0;
  const isBusy = isLoading || isFetching || isMutating;

  const handleTabChange = (_event: SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleUpdateSubmit = async (data: BusinessFormData) => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({
        id,
        payload: {
          name: data.name,
          is_active: data.is_active,
          translates: data.translates,
        },
      });
      setIsEditModalOpen(false);
    } catch {
      // Do not close modal on error, allowing user to retry
    }
  };

  if (isError) {
    return (
      <DetailContainer>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(BUSINESS_ROUTE)}
          sx={{ alignSelf: "flex-start", borderRadius: 2 }}
        >
          {t("business:back_to_list")}
        </Button>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              {t("core:retry")}
            </Button>
          }
        >
          {t("core:server_error_alert")}
        </Alert>
      </DetailContainer>
    );
  }

  const descriptionText = getBusinessDescription(business);

  return (
    <DetailContainer>
      {/* Soft loading indicator */}
      {(isFetching || isMutating) && !isLoading && (
        <LinearProgress
          sx={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1200 }}
        />
      )}

      {/* Global Breadcrumb */}
      <DetailBreadcrumb
        items={[
          { label: t("business:title"), to: BUSINESS_ROUTE },
          { label: business?.name ?? t("business:detail_title") },
        ]}
        extra={<Tooltip title={t(headerExpanded ? "business:detail_header_collapse" : "business:detail_header_expand")}>
          <span>
            <IconButton
              aria-label={t(headerExpanded ? "business:detail_header_collapse" : "business:detail_header_expand")}
              aria-expanded={headerExpanded}
              aria-controls={headerId}
              disabled={isBusy || !id || !business}
              onClick={() => { if (id) setCollapsedHeaders(previous => ({ ...previous, [id]: !(previous[id] ?? true) })); }}
              sx={{ width: 44, height: 44, flexShrink: 0 }}
            >
              {headerExpanded ? <KeyboardArrowUpOutlinedIcon /> : <KeyboardArrowDownOutlinedIcon />}
            </IconButton>
          </span>
        </Tooltip>}
      />

      {/* Header Card with Business Info and Embedded Tabs */}
      <Skeleton loading={isLoading} fallback={<HeaderCardSkeleton />}>
        <HeaderCard>
          <Collapse id={headerId} in={headerExpanded} timeout="auto" aria-hidden={!headerExpanded} inert={!headerExpanded}>
            <HeaderTopSection>
            <HeaderInfoContainer>
              <BusinessAvatarBox>
                <StorefrontOutlinedIcon sx={{ fontSize: 32 }} />
              </BusinessAvatarBox>

              <Box sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
                    {business?.name ?? "..."}
                  </Typography>

                  <StatusPill active={business?.is_active ?? true}>
                    <StatusDot active={business?.is_active ?? true} />
                    {business?.is_active
                      ? t("business:status_active")
                      : t("business:status_inactive")}
                  </StatusPill>
                </Box>

                <HeaderMetaRow>
                  <Typography variant="caption" color="text.secondary">
                    {`ID: ${business?.id ?? ""}`}
                  </Typography>

                  {business?.owner && (
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                      <Avatar
                        src={business.owner.image_url ?? undefined}
                        alt={business.owner.name}
                        sx={{ width: 18, height: 18, fontSize: 10 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {business.owner.name} ({t("business:owner_badge")})
                      </Typography>
                    </Box>
                  )}
                </HeaderMetaRow>

                {descriptionText && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.5 }}>
                    {descriptionText}
                  </Typography>
                )}
              </Box>
            </HeaderInfoContainer>

            {/* Action buttons */}
            <HeaderActions>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditOutlinedIcon />}
                onClick={() => { if (canManageBusiness) setIsEditModalOpen(true); }}
                disabled={isBusy || !canManageBusiness}
                sx={{ borderRadius: 2, textTransform: "none" }}
              >
                {t("business:action_update")}
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<GroupAddOutlinedIcon />}
                onClick={() => { if (canManageBusiness) setIsCollaboratorModalOpen(true); }}
                disabled={isBusy || !canManageBusiness}
                sx={{ borderRadius: 2, textTransform: "none" }}
              >
                {t("business:action_add_collaborator")}
              </Button>
            </HeaderActions>
            </HeaderTopSection>
          </Collapse>

          {/* Embedded Navigation Tabs */}
          <TabsWrapper>
            {mobile ? <SelectSingleInput label={t("business:pos.section")} clearable={false} value={selectedSection} onChange={(value) => setActiveTab(sections.findIndex((section) => section.value === value))} disabled={isBusy} options={sections.map((section) => ({ value: section.value, label: t(section.label) }))} /> : <StyledTabs
              orientation="horizontal"
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
            >
              {sections.map((section) => {
                const Icon = "icon" in section ? section.icon : undefined;
                const count = sectionCounts[section.value];
                return <StyledTab
                  key={section.value}
                  icon={Icon ? <Icon sx={{ fontSize: 18 }} /> : undefined}
                  disabled={isBusy}
                  iconPosition="start"
                  label={count === undefined ? t(section.label) :
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                      {t(section.label)}
                      <Chip label={count} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
                    </Box>}
                  data-testid={`tab-${section.value}`}
                />;
              })}
            </StyledTabs>}
          </TabsWrapper>
        </HeaderCard>
      </Skeleton>

      {/* Tab Panels */}
      {business && (
        <Box sx={{ width: "100%", mt: 1 }}>
          {selectedSection === "overview" && (
            <OverviewTab
              businessId={business.id}
              onSwitchTab={(tabIdx) => setActiveTab(tabIdx)}
              onOpenNewProvider={() => {
                setActiveTab(1);
                setDirectNewProviderOpen(true);
              }}
              onOpenNewProduct={() => {
                setActiveTab(2);
                setDirectNewProductOpen(true);
              }}
              onOpenNewInvoice={() => {
                setActiveTab(3);
                setDirectNewInvoiceOpen(true);
              }}
            />
          )}

          {selectedSection === "providers" && (
            <ProvidersTab
              businessId={business.id}
              isCreateModalOpenDirectly={directNewProviderOpen}
              onCloseDirectCreateModal={() => setDirectNewProviderOpen(false)}
            />
          )}

          {selectedSection === "products" && (
            <ProductsTab
              businessId={business.id}
              isCreateModalOpenDirectly={directNewProductOpen}
              onCloseDirectCreateModal={() => setDirectNewProductOpen(false)}
            />
          )}

          {selectedSection === "invoices" && (
            <InvoicesTab
              businessId={business.id}
              isCreateModalOpenDirectly={directNewInvoiceOpen}
              onCloseDirectCreateModal={() => setDirectNewInvoiceOpen(false)}
            />
          )}

          {saleSection && <SalesWorkspace key={`${business.id}:${user?.id ?? ""}`} businessId={business.id} businessName={business.name} section={saleSection} />}

          {selectedSection === "collaborators" && (
            <CollaboratorsTab
              businessId={business.id}
              businessName={business.name}
              collaborators={business.collaborators}
              canManage={canManageBusiness}
              onOpenAddCollaborator={() => { if (canManageBusiness) setIsCollaboratorModalOpen(true); }}
              isBusy={isBusy}
              isLoading={isLoading}
            />
          )}
        </Box>
      )}

      {/* Header Modals */}
      {business && (
        <>
          <BusinessModal
            open={isEditModalOpen && canManageBusiness}
            onClose={() => setIsEditModalOpen(false)}
            onSubmit={handleUpdateSubmit}
            initialData={business}
            isSubmitting={updateMutation.isPending}
          />

          <BusinessCollaboratorModal
            open={isCollaboratorModalOpen && canManageBusiness}
            onClose={() => setIsCollaboratorModalOpen(false)}
            businessId={business.id}
            businessName={business.name}
            initialCollaborators={business.collaborators}
          />
        </>
      )}
    </DetailContainer>
  );
};

export default BusinessDetail;
