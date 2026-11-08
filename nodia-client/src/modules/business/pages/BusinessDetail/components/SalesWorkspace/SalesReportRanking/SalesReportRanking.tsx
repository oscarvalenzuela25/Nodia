import { useId } from "react";
import { Alert, Box, Button, Chip, LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import { TableSkeleton } from "../../../../../../../components/skeletons";
import MobileRecordCard from "../../../../../../../components/MobileRecordCard";
import { formatClp } from "../../../../../infrastructure/salesPolicies";
import { formatQuantity } from "../../../../../infrastructure/saleQuantities";
import { measurementUnit } from "../../../../../infrastructure/measurementUnits";
import type { TopProducts } from "../../../../../infrastructure/salesTypes";
import { MobileRankingList, RankingPanel } from "./styles";
import { ReportReadError } from "../salesReportStyles";
interface Props { data: TopProducts | undefined; metric: "units" | "amount"; loading: boolean; fetching: boolean; error: boolean; retryDisabled: boolean; onRetry: () => void }
export default function SalesReportRanking({ data, metric, loading, fetching, error, retryDisabled, onRetry }: Props) {
  const { t, i18n } = useTranslation(["business", "core", "product"]);
  const mobile = useMediaQuery(useTheme().breakpoints.down("sm"));
  const id = useId(), hintId = `${id}-limit`;
  const headers = [t("business:product_name"), t("business:pos.supplier_code"), t("business:pos.units_sold"), t("business:pos.registered_sales")];
  return <Box sx={{ display: "grid", gap: 2, minWidth: 0 }} aria-busy={fetching}>
    <Box sx={{ display: "grid", gap: 1 }}><Typography id={id} component="h2" variant="h6">{t("business:pos.top_products")}</Typography>
      <Typography id={hintId} variant="body2" color="text.secondary">{t("business:pos.top_products_limit_hint", { metric: t(metric === "units" ? "business:pos.units_sold" : "business:pos.registered_sales").toLocaleLowerCase(i18n.language) })}</Typography></Box>
    {metric === "units" && new Set(data?.data.map((product) => measurementUnit(product.measurement_unit))).size > 1 && <Typography variant="body2" color="text.secondary">{t("business:pos.mixed_unit_ranking_help")}</Typography>}
    {fetching && !loading && <LinearProgress />}
    {error && <ReportReadError severity="error" action={<Button sx={{ minHeight: 44 }} disabled={retryDisabled} onClick={() => { if (!retryDisabled) onRetry(); }}>{t("business:pos.retry")}</Button>}>{t("core:server_error_alert")}</ReportReadError>}
    <RankingPanel>
    <Skeleton loading={loading} fallback={mobile ? undefined : <TableSkeleton rows={5} columns={headers.map((header, index) => ({ header, align: index > 1 ? "right" : "left" }))} paperSx={{ borderRadius: 0, border: 0, boxShadow: "none" }} />}>
      {mobile ? <MobileRankingList aria-labelledby={id} aria-describedby={hintId}>
        {data?.data.map((product, index) => <li key={`${product.product_id}:${measurementUnit(product.measurement_unit)}`}><MobileRecordCard title={product.name}
          status={<Chip size="small" label={t("business:pos.ranking_position", { position: index + 1 })} />}
          fields={[{ key: "code", label: headers[1], value: product.code ?? "—" },
            { key: "units", label: headers[2], value: `${formatQuantity(product.units_sold, i18n.language)} ${t(`product:units.${measurementUnit(product.measurement_unit)}`)}` },
            { key: "amount", label: headers[3], value: formatClp(product.total_amount, i18n.language), fullWidth: true }]} /></li>)}
        {data?.data.length === 0 && !error && <li><Alert severity="info">{t("business:pos.sales_empty")}</Alert></li>}
        {loading && !data && Array.from({ length: 3 }, (_, index) => <li key={index}><Box sx={{ minHeight: 160 }} /></li>)}
      </MobileRankingList> : <TableContainer role="region" tabIndex={0} aria-labelledby={id} aria-describedby={hintId}>
        <Table aria-labelledby={id}><TableHead><TableRow>{headers.map((header, index) => <TableCell key={header} align={index > 1 ? "right" : "left"}>{header}</TableCell>)}</TableRow></TableHead>
          <TableBody>{data?.data.map(product => <TableRow key={`${product.product_id}:${measurementUnit(product.measurement_unit)}`} hover>
            <TableCell sx={{ overflowWrap: "anywhere" }}>{product.name}</TableCell><TableCell sx={{ overflowWrap: "anywhere" }}>{product.code ?? "—"}</TableCell>
            <TableCell align="right">{formatQuantity(product.units_sold, i18n.language)} {t(`product:units.${measurementUnit(product.measurement_unit)}`)}</TableCell><TableCell align="right">{formatClp(product.total_amount, i18n.language)}</TableCell>
          </TableRow>)}
            {data?.data.length === 0 && !error && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}><Typography color="text.secondary">{t("business:pos.sales_empty")}</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>}
    </Skeleton>
    </RankingPanel>
  </Box>;
}
