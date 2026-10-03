export type RouteLoaderVariant = "page" | "fullscreen";

export interface RouteLoaderProps {
  variant?: RouteLoaderVariant;
  messageKey?: string;
  defaultMessage?: string;
}
