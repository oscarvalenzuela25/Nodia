import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Pagination,
  Stack,
  Typography,
} from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useTranslation } from "react-i18next";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import NewsArticleCard from "../../components/NewsArticleCard";
import NewsInitialLoading from "../../components/NewsInitialLoading";
import NewsTopicChips from "../../components/NewsTopicChips";
import { newsSourceKeySchema, type NewsFilters, type NewsSourceKey } from "../../types";
import { useNews, useNewsRefresh } from "./infrastructure/useServices";
import {
  ArticleGrid,
  AdminRefreshControls,
  FilterBar,
  FilterControls,
  Header,
  NewsRoot,
  ReadingHeader,
} from "./styles";

export default function News() {
  const { t, i18n } = useTranslation(["news", "core"]);
  const readingHeading = useRef<HTMLHeadingElement>(null);
  const [filters, setFilters] = useState<NewsFilters>({
    topic: "all",
    source: "all",
    order: "recent",
    page: 1,
  });
  const query = useNews(filters);
  const [refreshSource, setRefreshSource] = useState<NewsSourceKey | null>(null);
  const selectedSource = query.data?.sources.find((item) => item.key === refreshSource);
  const refresh = useNewsRefresh(selectedSource?.key ?? null);
  const busy = query.isFetching || refresh.isPending;
  const hasFilters = filters.topic !== "all" || filters.source !== "all";
  const setFilter = (patch: Partial<NewsFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: 1 }));
  return (
    <NewsRoot aria-labelledby="news-heading" aria-busy={busy}>
      <Header>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="p"
            variant="overline"
            sx={{
              color: "primary.main",
              fontWeight: 700,
              letterSpacing: ".12em",
              lineHeight: 1.5,
              mb: 1,
            }}
          >
            {t("news:editorial_kicker")}
          </Typography>
          <Typography
            component="h1"
            variant="h4"
            id="news-heading"
            sx={{ fontWeight: 700, letterSpacing: "-.035em", mb: 1 }}
          >
            {t("news:title")}
          </Typography>
          <Typography color="text.secondary">{t("news:subtitle")}</Typography>
        </Box>
        {refresh.canRefresh && (
          <AdminRefreshControls role="group" aria-label={t("news:refresh_controls")}>
            <SelectSingleInput
              id="news-refresh-source"
              label={t("news:refresh_source")}
              placeholder={t("news:choose_refresh_source")}
              value={refreshSource ?? ""}
              clearable={false}
              disabled={busy}
              options={query.data?.sources.map((item) => ({ value: item.key, label: item.name })) ?? []}
              onChange={(value) => {
                const source = newsSourceKeySchema.safeParse(value);
                if (source.success) setRefreshSource(source.data);
              }}
            />
            <Button
              variant="contained"
              startIcon={<RefreshOutlinedIcon />}
              loading={refresh.isPending}
              disabled={busy || !selectedSource}
              onClick={refresh.refresh}
            >
              {t("news:refresh")}
            </Button>
          </AdminRefreshControls>
        )}
      </Header>
      <FilterBar aria-label={t("news:reading_filters")}>
        <NewsTopicChips
          value={filters.topic}
          disabled={busy}
          onChange={(topic) => setFilter({ topic })}
        />
        <FilterControls>
          <SelectSingleInput
            id="news-source"
            label={t("news:source")}
            value={filters.source}
            clearable={false}
            disabled={busy}
            options={[
              { value: "all", label: t("news:all_sources") },
              ...(query.data?.sources.map((item) => ({
                value: item.key,
                label: item.name,
              })) ?? []),
            ]}
            onChange={(value) => {
              if (value === "all") setFilter({ source: value });
              else {
                const source = newsSourceKeySchema.safeParse(value);
                if (source.success) setFilter({ source: source.data });
              }
            }}
          />
          <SelectSingleInput
            id="news-order"
            label={t("news:order")}
            value={filters.order}
            clearable={false}
            disabled={busy}
            options={[
              { value: "recent", label: t("news:order_recent") },
              { value: "received", label: t("news:order_received") },
            ]}
            onChange={(value) => {
              if (value === "recent" || value === "received")
                setFilter({ order: value });
            }}
          />
        </FilterControls>
      </FilterBar>
      <Stack sx={{ gap: 1 }}>
        {query.data?.sources.map((source) => (
          <Stack key={source.key} sx={{ gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {source.last_success_at
                ? t("news:source_last_updated", {
                    source: source.name,
                    date: new Intl.DateTimeFormat(i18n.language, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(source.last_success_at)),
                  })
                : t("news:source_not_updated", { source: source.name })}
            </Typography>
            {source.last_error_code && !(refresh.failure && source.key === refreshSource) && (
              <Alert severity="warning">{t("news:source_refresh_error_named", { source: source.name })}</Alert>
            )}
          </Stack>
        ))}
        {refresh.failure && <Alert severity="error">{refresh.failure}</Alert>}
        {query.isError && (
          <Alert
            severity="error"
            action={
              <Button
                color="inherit"
                disabled={busy}
                onClick={() => {
                  void query.refetch();
                }}
              >
                {t("core:retry")}
              </Button>
            }
          >
            {t("news:load_error")}
          </Alert>
        )}
      </Stack>
      {busy && !query.isLoading && (
        <LinearProgress aria-label={t("news:loading")} />
      )}
      <Box
        component="section"
        aria-labelledby="news-reading-heading"
        sx={{ minWidth: 0 }}
      >
        <ReadingHeader>
          <Typography
            component="h2"
            ref={readingHeading}
            tabIndex={-1}
            variant="h6"
            id="news-reading-heading"
            sx={{ fontWeight: 650 }}
          >
            {t("news:explore")}
          </Typography>
          {query.data && (
            <Typography component="p" variant="caption" color="text.secondary">
              {t("news:articles_count", { count: query.data.pagination.total })}
            </Typography>
          )}
        </ReadingHeader>
        {query.isLoading ? (
          <NewsInitialLoading />
        ) : (
          query.data &&
          (query.data.items.length ? (
            <ArticleGrid>
              {query.data.items.map((article, index) => (
                <NewsArticleCard
                  key={article.id}
                  article={article}
                  leading={index === 0}
                  disabled={busy}
                />
              ))}
            </ArticleGrid>
          ) : (
            <Box
              sx={{
                py: 5,
                textAlign: "center",
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography component="h3" variant="h6" sx={{ mb: 1 }}>
                {t(hasFilters ? "news:filtered_empty" : "news:empty")}
              </Typography>
              <Typography color="text.secondary">
                {t(
                  hasFilters
                    ? "news:filtered_empty_description"
                    : "news:empty_description",
                )}
              </Typography>
              {hasFilters && (
                <Button
                  disabled={busy}
                  sx={{ mt: 2, minHeight: 44 }}
                  onClick={() => {
                    setFilter({ topic: "all", source: "all" });
                    readingHeading.current?.focus({ preventScroll: true });
                  }}
                >
                  {t("news:clear_filters")}
                </Button>
              )}
            </Box>
          ))
        )}
      </Box>
      {query.data && query.data.pagination.total_pages > 1 && (
        <Pagination
          aria-label={t("news:pagination")}
          count={query.data.pagination.total_pages}
          page={filters.page}
          disabled={busy}
          onChange={(_, page) =>
            setFilters((current) => ({ ...current, page }))
          }
          sx={{
            alignSelf: "center",
            "& .MuiPagination-ul": { justifyContent: "center" },
          }}
        />
      )}
      <Typography variant="caption" color="text.secondary">
        {t("news:reading_notice")}
      </Typography>
    </NewsRoot>
  );
}
