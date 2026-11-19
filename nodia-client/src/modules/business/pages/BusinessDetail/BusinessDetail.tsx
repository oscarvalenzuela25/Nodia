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
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import FormatListBulletedOutlinedIcon from "@mui/icons-material/FormatListBulletedOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import GroupAddOutlinedIcon from "@mui/icons-material/GroupAddOutlined";
import KeyboardArrowUpOutlinedIcon from "@mui/icons-material/KeyboardArrowUpOutlined";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import { Skeleton } from "boneyard-js/react";
import { useIsMutating, useQuery } from "@tanstack/react-query";

import useAuth from "../../../../hooks/useAuth";
import useAuthStore from "../../../../store/authStore";
import { HeaderCardSkeleton } from "../../../../components/skeletons";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
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
import type { CashScope } from "../../infrastructure/cashTypes";
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
  MarketTabs,
  StatusPill,
  StatusDot,
} from "./styles";

const sections = [
  { value: "overview", label: "business:tab_overview", icon: DashboardOutlinedIcon },
  { value: "cash", label: "business:tab_cash", icon: AccountBalanceWalletOutlinedIcon },
  { value: "market", label: "business:market_lists.market", icon: StorefrontOutlinedIcon },
  { value: "pos", label: "business:pos.title", icon: PointOfSaleOutlinedIcon },
  { value: "sales", label: "business:pos.sales", icon: ShoppingBagOutlinedIcon },
  { value: "reports", label: "business:pos.reports", icon: AssessmentOutlinedIcon },
  { value: "collaborators", label: "business:tab_collaborators", icon: PeopleOutlinedIcon },
] as const;

const marketSections = [
  { value: "providers", label: "business:tab_providers", icon: LocalShippingOutlinedIcon },
  { value: "products", label: "business:tab_products", icon: Inventory2OutlinedIcon },
  { value: "invoices", label: "business:tab_invoices", icon: ReceiptLongOutlinedIcon },
  { value: "lists", label: "business:market_lists.title", icon: FormatListBulletedOutlinedIcon },
] as const;

type BusinessTab = (typeof sections | typeof marketSections)[number];

function CashSectionEntry(scope: CashScope) {
  const { t } = useTranslation("business");
  const section = useQuery({
    queryKey: ["business-cash-section-code"],
    queryFn: () => import("./CashSection"),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  if (!section.data) {
    return section.isError ? (
      <QueryErrorAlert isError isFetching={section.isFetching} onRetry={section.refetch} />
    ) : (
      <LinearProgress aria-label={t("business:tab_cash")} />
    );
  }
  const CashSection = section.data.default;
  return <CashSection {...scope} />;
}

function ListsSectionEntry(scope: CashScope) {
  const { t } = useTranslation(["business", "core"]);
  const section = useQuery({
    queryKey: ["business-shopping-lists-section-code"],
    queryFn: () => import("./components/ListsTab"),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  if (!section.data) {
    return section.isError ? (
      <QueryErrorAlert isError isFetching={section.isFetching} onRetry={section.refetch} />
    ) : (
      <LinearProgress aria-label={t("business:market_lists.title")} />
    );
  }
  const ListsTab = section.data.default;
  return <ListsTab {...scope} />;
}

const BusinessDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  const { t } = useTranslation(["business", "core"]);
  const mobile = useMediaQuery(useTheme().breakpoints.down("sm"));

  const [sectionParams, setSectionParams] = useSearchParams();
  const activeSection = sectionParams.get("section") ?? "overview";
  const selectedMarketSection = marketSections.find(section => section.value === activeSection)?.value;
  const selectedSection = selectedMarketSection ?? sections.find(section => section.value === activeSection && section.value !== "market")?.value ?? "overview";
  const selectedTab = selectedMarketSection ? "market" : selectedSection;
  const saleSection: SaleSection | null = selectedSection === "pos" || selectedSection === "sales" || selectedSection === "reports" ? selectedSection : null;
  const selectSection = (value: unknown) => {
    const target = value === "market" ? selectedMarketSection ?? "products" : value;
    const section = [...sections, ...marketSections].find(candidate => candidate.value === target);
    if (!section) return;
    setSectionParams((params) => {
      params.set("section", section.value);
      return params;
    });
  };
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
  const sectionCounts: Partial<Record<BusinessTab["value"], number>> = {
    providers: totalProviders, products: totalProducts, invoices: totalInvoices, collaborators: totalCollaborators,
  };

  const isMutating = useIsMutating() > 0;
  const isBusy = isLoading || isFetching || isMutating;

  const renderSectionTabs = (items: readonly BusinessTab[]) => items.map(({ value, label, icon: Icon }) => {
    const count = sectionCounts[value];
    return <StyledTab
      key={value}
      value={value}
      icon={<Icon sx={{ fontSize: 18 }} />}
      iconPosition="start"
      disabled={isBusy}
      label={count === undefined ? t(label) :
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
          {t(label)}
          <Chip label={count} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
        </Box>}
      data-testid={`tab-${value}`}
    />;
  });

  const handleTabChange = (_event: SyntheticEvent, newValue: unknown) => {
    selectSection(newValue);
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
            {mobile ? (
              <>
                <SelectSingleInput
                  label={t("business:pos.section")}
                  clearable={false}
                  autoFocusSearch={false}
                  value={selectedTab}
                  onChange={selectSection}
                  disabled={isBusy}
                  options={sections.map(({ value, label }) => ({ value, label: t(label) }))}
                />
                {selectedMarketSection && (
                  <Box sx={{ mt: 2 }}>
                    <SelectSingleInput
                      label={t("business:market_lists.market")}
                      clearable={false}
                      autoFocusSearch={false}
                      value={selectedMarketSection}
                      onChange={selectSection}
                      disabled={isBusy}
                      options={marketSections.map(({ value, label }) => {
                        const count = sectionCounts[value];
                        const title = t(label);
                        return { value, label: count === undefined ? title : `${title} (${count})` };
                      })}
                    />
                  </Box>
                )}
              </>
            ) : (
              <StyledTabs
                orientation="horizontal"
                value={selectedTab}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                aria-label={t("business:pos.section")}
              >
                {renderSectionTabs(sections)}
              </StyledTabs>
            )}
          </TabsWrapper>
          {!mobile && selectedMarketSection && <MarketTabs
            value={selectedMarketSection}
            onChange={handleTabChange}
            aria-label={t("business:market_lists.market")}
            variant="scrollable"
            scrollButtons="auto"
          >
            {renderSectionTabs(marketSections)}
          </MarketTabs>}
        </HeaderCard>
      </Skeleton>

      {/* Tab Panels */}
      {business && (
        <Box sx={{ width: "100%", mt: 1 }}>
          {selectedSection === "overview" && (
            <OverviewTab
              businessId={business.id}
              onOpenInvoices={() => selectSection("invoices")}
              onOpenNewProvider={() => {
                selectSection("providers");
                setDirectNewProviderOpen(true);
              }}
              onOpenNewProduct={() => {
                selectSection("products");
                setDirectNewProductOpen(true);
              }}
              onOpenNewInvoice={() => {
                selectSection("invoices");
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

          {selectedSection === "lists" && user?.id && (
            <ListsSectionEntry
              key={`${business.id}:${user.id}:${sessionVersion}`}
              businessId={business.id}
              actorId={user.id}
              sessionVersion={sessionVersion}
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

          {selectedSection === "cash" && user?.id && (
            <CashSectionEntry
              key={`${business.id}:${user.id}:${sessionVersion}`}
              businessId={business.id}
              actorId={user.id}
              sessionVersion={sessionVersion}
            />
          )}

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
