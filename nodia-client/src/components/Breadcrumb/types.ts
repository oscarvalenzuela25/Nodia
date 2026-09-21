import type { ReactNode } from "react";

export interface BreadcrumbItem {
  label: string;
  to?: string;
  icon?: ReactNode;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  extra?: ReactNode;
  className?: string;
}
