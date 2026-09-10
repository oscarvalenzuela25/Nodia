import type { ComponentType } from "react";

export type WithAuthorizationContextOptions = {
  enabled?: boolean;
};

export type HOC<Props extends object> = (
  Component: ComponentType<Props>
) => ComponentType<Props>;
