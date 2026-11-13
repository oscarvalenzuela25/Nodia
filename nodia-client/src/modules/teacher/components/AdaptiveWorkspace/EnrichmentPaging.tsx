import { Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

export default function EnrichmentPaging({ page, hasMore, disabled, onPage }: { page: number; hasMore: boolean; disabled: boolean; onPage: (page: number) => void }) {
  const { t } = useTranslation();
  if (page === 1 && !hasMore) return <></>;
  return <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}><Button variant="outlined" disabled={disabled || page === 1} onClick={() => onPage(page - 1)}>{t("teacher:adaptive.previous_page")}</Button><Typography>{t("teacher:adaptive.page", { number: page })}</Typography><Button variant="outlined" disabled={disabled || !hasMore} onClick={() => onPage(page + 1)}>{t("teacher:adaptive.next_page")}</Button></Stack>;
}
