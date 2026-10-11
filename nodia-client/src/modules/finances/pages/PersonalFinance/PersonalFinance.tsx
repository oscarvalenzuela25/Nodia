import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { Box, Tab, Tabs, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
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
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
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
      {mobile ? (
        <SelectSingleInput
          label={t("finance:section")}
          value={tab}
          options={TABS.map((value) => ({
            value,
            label: t(TAB_LABELS[value]),
          }))}
          onChange={(value) => {
            const next = TABS.find((item) => item === value);
            if (next) changeTab(undefined, next);
          }}
          disabled={busy}
          clearable={false}
          fullWidth
        />
      ) : (
        <Tabs
          value={tab}
          onChange={changeTab}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minWidth: 0,
            "& .MuiTab-root": { minHeight: 44 },
            "& .MuiTabs-scrollButtons": { width: 44 },
          }}
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
      )}
      <Box
        sx={{ minWidth: 0 }}
        role="tabpanel"
        id={`finance-panel-${tab}`}
        aria-labelledby={mobile ? undefined : `finance-tab-${tab}`}
        aria-label={mobile ? t(TAB_LABELS[tab]) : undefined}
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
