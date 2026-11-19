import { useId, useState } from "react";
import FeedOutlinedIcon from "@mui/icons-material/FeedOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { Typography } from "@mui/material";
import { ArticleCard, ArticleCardLink, ArticleCopy, ArticleMedia, ArticleMediaMark } from "./styles";
import type { PersonalArticle } from "./types";

interface PersonalArticleCardProps {
  article: PersonalArticle;
  providerName: string;
  dates: Intl.DateTimeFormat;
}

export default function PersonalArticleCard({ article, providerName, dates }: PersonalArticleCardProps) {
  const heading = useId();
  const [failedCover, setFailedCover] = useState<string>();
  const cover = article.provider === "dev-community" ? article.cover_image_url : undefined;
  const showCover = cover && cover !== failedCover;

  return (
    <ArticleCardLink href={article.url} target="_blank" rel="noopener noreferrer" aria-labelledby={heading}>
      <ArticleCard>
        <ArticleMedia aria-hidden="true">
          {showCover ? (
            <img
              key={cover}
              src={cover}
              alt=""
              width={640}
              height={360}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setFailedCover(cover)}
            />
          ) : <ArticleMediaMark><FeedOutlinedIcon /></ArticleMediaMark>}
        </ArticleMedia>
        <ArticleCopy>
          <Typography variant="caption" component="p" color="text.secondary">
            {providerName}
            {article.published_at && (
              <> · <time dateTime={article.published_at}>{dates.format(new Date(article.published_at))}</time></>
            )}
          </Typography>
          <Typography component="h3" variant="subtitle1" id={heading} sx={{ fontWeight: 650, lineHeight: 1.4 }}>
            <span>{article.title}</span>
            <OpenInNewOutlinedIcon aria-hidden="true" />
          </Typography>
        </ArticleCopy>
      </ArticleCard>
    </ArticleCardLink>
  );
}
