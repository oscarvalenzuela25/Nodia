import { useQuery } from "@tanstack/react-query";
import useAuth from "../../../../../../hooks/useAuth";
import { getSalesSummary, getTopProducts } from "../../../../infrastructure/salesServices";
import type { salesPeriod } from "../../../../infrastructure/salesDates";

export function useSalesReports(businessId: string, period: ReturnType<typeof salesPeriod>, metric: "units" | "amount") {
  const { user, sessionVersion, isSessionActive } = useAuth();
  const enabled = isSessionActive && Boolean(user?.id && businessId);
  // Native sale mutations invalidate this shared business prefix.
  const scope = [user?.id ?? "", sessionVersion] as const;
  const summary = useQuery({ queryKey: ["business-sales", businessId, "summary", ...scope, period],
    queryFn: () => getSalesSummary(businessId, period), enabled, retry: false, refetchOnWindowFocus: false });
  const top = useQuery({ queryKey: ["business-sales", businessId, "top", ...scope, period, metric],
    queryFn: () => getTopProducts(businessId, { ...period, metric, limit: 10 }), enabled, retry: false, refetchOnWindowFocus: false });
  return { summary, top, busy: summary.isFetching || top.isFetching };
}
