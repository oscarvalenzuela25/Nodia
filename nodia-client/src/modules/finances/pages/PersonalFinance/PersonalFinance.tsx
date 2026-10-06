import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { Box, Tab, Tabs } from "@mui/material";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import FinanceOverview from "../../components/FinanceOverview";
import FinanceResourceTab from "../../components/FinanceResourceTab";
import { useFinanceBusy } from "../../infrastructure/useServices";
import type { FinanceQuery, FinanceResource } from "../../types";
import {
  PageHeader,
  PageTitle,
  PageSubtitle,
  PageTitleContainer,
  PageStack,
} from "./styles";

type FinanceTab = "general" | FinanceResource;
const TABS: FinanceTab[] = [
  "general",
  "movements",
  "obligations",
  "categories",
  "category-groups",
];
const TAB_LABELS: Record<FinanceTab, string> = {
  general: "finance:tabs.general",
  movements: "finance:tabs.movements",
  obligations: "finance:tabs.obligations",
  categories: "finance:tabs.categories",
  "category-groups": "finance:tabs.category_groups",
};

const PersonalFinance = () => {
  const { t } = useTranslation("finance");
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab: FinanceTab =
    TABS.find((value) => value === requestedTab) ?? "general";
  const busy = useFinanceBusy();
  const [queries, setQueries] = useState<Record<FinanceTab, FinanceQuery>>({
    general: { active: "active" },
    movements: { active: "active", page: 1, limit: 10 },
    obligations: { active: "active", page: 1, limit: 10 },
    categories: { active: "active", page: 1, limit: 10 },
    "category-groups": { active: "active", page: 1, limit: 10 },
  });
  const changeTab = (_event: unknown, next: FinanceTab) => {
    if (busy || !TABS.includes(next)) return;
    setSearchParams((previous) => {
      const nextParams = new URLSearchParams(previous);
      if (next === "general") nextParams.delete("tab");
      else nextParams.set("tab", next);
      return nextParams;
    });
  };
  const updateQuery = (query: FinanceQuery) => {
    setQueries((previous) => ({ ...previous, [tab]: query }));
  };

  return (
    <PageStack>
      <PageHeader>
        <PageTitleContainer>
          <AccountBalanceWalletOutlinedIcon color="primary" fontSize="large" />
          <PageTitle variant="h1">{t("finance:title")}</PageTitle>
        </PageTitleContainer>
        <PageSubtitle>{t("finance:subtitle")}</PageSubtitle>
      </PageHeader>
      <Tabs
        value={tab}
        onChange={changeTab}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={t("finance:title")}
      >
        {TABS.map((value) => (
          <Tab
            key={value}
            value={value}
            label={t(TAB_LABELS[value])}
            disabled={busy}
            id={`finance-tab-${value}`}
            aria-controls={`finance-panel-${value}`}
          />
        ))}
      </Tabs>
      <Box
        role="tabpanel"
        id={`finance-panel-${tab}`}
        aria-labelledby={`finance-tab-${tab}`}
      >
        {tab === "general" ? (
          <FinanceOverview
            query={queries.general}
            onQueryChange={updateQuery}
            onViewMovements={(query) => {
              if (busy) return;
              setQueries((previous) => ({
                ...previous,
                movements: { ...query, page: 1, limit: 10 },
              }));
              changeTab(undefined, "movements");
            }}
          />
        ) : (
          <FinanceResourceTab
            key={tab}
            resource={tab}
            query={queries[tab]}
            onQueryChange={updateQuery}
          />
        )}
      </Box>
    </PageStack>
  );
};

export default PersonalFinance;
