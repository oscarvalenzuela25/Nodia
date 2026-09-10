import type { ReactNode } from "react";

export type SidenavItem = {
  id: string;
  nameKey?: string;
  name?: string;
  path?: string;
  icon?: ReactNode;
  subModules?: Omit<SidenavItem, "subModules">[];
};
