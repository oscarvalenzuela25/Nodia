import type { FC } from "react";
import Box from "@mui/material/Box";
import type { BreadcrumbProps } from "./types";
import {
  BreadcrumbRoot,
  StyledBreadcrumbs,
  BreadcrumbLink,
  BreadcrumbCurrent,
} from "./styles";

export const Breadcrumb: FC<BreadcrumbProps> = ({ items, extra, className }) => {
  return (
    <BreadcrumbRoot className={className} data-testid="breadcrumb-root">
      <StyledBreadcrumbs separator="/" aria-label="breadcrumb">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          if (isLast || !item.to) {
            return (
              <BreadcrumbCurrent
                key={`${item.label}-${index}`}
                aria-current={isLast ? "page" : undefined}
              >
                {item.icon}
                {item.label}
              </BreadcrumbCurrent>
            );
          }

          return (
            <BreadcrumbLink key={`${item.label}-${index}`} to={item.to}>
              {item.icon}
              {item.label}
            </BreadcrumbLink>
          );
        })}
      </StyledBreadcrumbs>

      {extra && <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>{extra}</Box>}
    </BreadcrumbRoot>
  );
};

export default Breadcrumb;
