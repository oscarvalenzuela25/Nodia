import { Link, Stack, Typography } from "@mui/material";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { useTranslation } from "react-i18next";
import type { MouseEvent } from "react";
import type { NewsArticle } from "../../types";
import { Article, ArticleMetadata, SourceBadge, TopicTag } from "./styles";

export default function NewsArticleCard({
  article,
  leading = false,
  disabled = false,
}: {
  article: NewsArticle;
  leading?: boolean;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation("news");
  const date = article.published_at ?? article.received_at;
  const linkState = {
    "aria-disabled": disabled || undefined,
    tabIndex: disabled ? -1 : undefined,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (disabled) event.preventDefault();
    },
  };
  return (
    <Article data-leading={leading}>
      <ArticleMetadata>
        {article.provenances.map((source) => (
          <SourceBadge key={source.source_key}>{source.source_name}</SourceBadge>
        ))}
        <Typography component="span" variant="caption">
          {t(article.published_at ? "news:published" : "news:received")}{" "}
          <time dateTime={date}>
            {new Intl.DateTimeFormat(i18n.language, {
              dateStyle: "medium",
            }).format(new Date(date))}
          </time>
        </Typography>
      </ArticleMetadata>
      <Typography
        component="h3"
        sx={{
          m: 0,
          fontWeight: 650,
          fontSize: "1.375rem",
          lineHeight: 1.3,
          letterSpacing: "-.025em",
        }}
      >
        <Link
          {...linkState}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          color="inherit"
          underline="hover"
        >
          {article.title}
        </Link>
      </Typography>
      {article.excerpt && (
        <Typography
          variant="body1"
          sx={{ color: "text.secondary", maxWidth: "65ch", lineHeight: 1.7 }}
        >
          {article.excerpt}
        </Typography>
      )}
      <Stack
        direction="row"
        sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
      >
        <TopicTag>{t(`news:topic_${article.topic}`)}</TopicTag>
        {article.author && (
          <Typography variant="caption" color="text.secondary">
            {t("news:by_author", { author: article.author })}
          </Typography>
        )}
      </Stack>
      <Stack sx={{ gap: 0.5, color: "text.secondary" }}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", gap: 2, flexWrap: "wrap" }}
        >
          <Link
            {...linkState}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              minHeight: 44,
              fontSize: ".875rem",
            }}
          >
            {t("news:read_original")}
            <OpenInNewOutlinedIcon sx={{ fontSize: 15 }} />
          </Link>
          {article.provenances.map((source) => (
            <Link
              key={source.source_key}
              {...linkState}
              href={source.license_url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                minHeight: 44,
                display: "inline-flex",
                alignItems: "center",
                color: "text.secondary",
                fontSize: ".75rem",
              }}
            >
              {article.provenances.length > 1
                ? t("news:source_license", { source: source.source_name })
                : t("news:license")}
            </Link>
          ))}
          {article.provenances.some((source) => source.source_key === "node-js") && (
            <Link
              {...linkState}
              href={`${import.meta.env.BASE_URL}legal/news-nodejs-notice.txt`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ minHeight: 44, display: "inline-flex", alignItems: "center", fontSize: ".75rem" }}
            >
              {t("news:nodejs_notice")}
            </Link>
          )}
        </Stack>
        {article.excerpt && (
          <Typography variant="caption">{t("news:excerpt_notice")}</Typography>
        )}
      </Stack>
    </Article>
  );
}
