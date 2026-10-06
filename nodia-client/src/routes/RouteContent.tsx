import { Suspense, type PropsWithChildren } from "react";
import { useLocation } from "react-router";
import RouteLoader from "../components/RouteLoader";
import type { RouteLoaderVariant } from "../components/RouteLoader/types";

export default function RouteContent({
  children,
  variant = "page",
}: PropsWithChildren<{ variant?: RouteLoaderVariant }>) {
  const { pathname } = useLocation();

  // A new screen resets the boundary so router transitions reveal its loader.
  // Search/hash changes keep the current page and its local form state mounted.
  return (
    <Suspense key={pathname} fallback={<RouteLoader variant={variant} />}>
      {children}
    </Suspense>
  );
}
