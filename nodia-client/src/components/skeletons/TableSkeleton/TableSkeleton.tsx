import type { FC } from "react";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
  type SxProps,
  type Theme,
} from "@mui/material";

export interface TableSkeletonColumn {
  width?: string | number;
  align?: "left" | "center" | "right";
  header?: string;
}

export interface TableSkeletonProps {
  columns: number | TableSkeletonColumn[];
  rows?: number;
  paperSx?: SxProps<Theme>;
  showHeader?: boolean;
}

export const TableSkeletonRows: FC<{
  columns: TableSkeletonColumn[];
  rows?: number;
}> = ({ columns, rows = 5 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <TableRow key={`skeleton-row-${rowIdx}`} hover>
          {columns.map((col, colIdx) => {
            const align = col.align ?? "left";

            // If it's a small action / icon column (e.g. toggle row, expand icon)
            if (col.width === 48 || col.width === "48px") {
              return (
                <TableCell
                  key={`skeleton-cell-${rowIdx}-${colIdx}`}
                  align={align}
                  sx={{ p: 0.5, width: col.width }}
                >
                  <Skeleton
                    variant="circular"
                    width={24}
                    height={24}
                    sx={{ mx: "auto" }}
                    animation="wave"
                  />
                </TableCell>
              );
            }

            // Action menu 3-dots column
            if (col.width === 80 || col.width === "80px") {
              return (
                <TableCell
                  key={`skeleton-cell-${rowIdx}-${colIdx}`}
                  align={align}
                  sx={{ width: col.width }}
                >
                  <Skeleton
                    variant="circular"
                    width={28}
                    height={28}
                    sx={{
                      ml: align === "right" ? "auto" : undefined,
                      mr: align === "left" ? "auto" : undefined,
                      mx: align === "center" ? "auto" : undefined,
                    }}
                    animation="wave"
                  />
                </TableCell>
              );
            }

            // Centered status or badge column
            if (align === "center") {
              return (
                <TableCell
                  key={`skeleton-cell-${rowIdx}-${colIdx}`}
                  align="center"
                  sx={{ width: col.width }}
                >
                  <Skeleton
                    variant="rounded"
                    width={col.width ? 60 : 70}
                    height={22}
                    sx={{ mx: "auto", borderRadius: 1.5 }}
                    animation="wave"
                  />
                </TableCell>
              );
            }

            // Right-aligned column (numbers, prices, totals)
            if (align === "right") {
              return (
                <TableCell
                  key={`skeleton-cell-${rowIdx}-${colIdx}`}
                  align="right"
                  sx={{ width: col.width }}
                >
                  <Skeleton
                    variant="text"
                    width={rowIdx % 2 === 0 ? "65%" : "50%"}
                    height={24}
                    sx={{ ml: "auto" }}
                    animation="wave"
                  />
                </TableCell>
              );
            }

            // Default left-aligned cell with realistic variance in text length
            const widths = ["75%", "85%", "60%", "90%", "70%"];
            const textWidth = widths[(rowIdx + colIdx) % widths.length];

            return (
              <TableCell
                key={`skeleton-cell-${rowIdx}-${colIdx}`}
                align="left"
                sx={{ width: col.width }}
              >
                <Skeleton
                  variant="text"
                  width={textWidth}
                  height={24}
                  animation="wave"
                />
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
};

export const TableSkeleton: FC<TableSkeletonProps> = ({
  columns,
  rows = 5,
  paperSx,
  showHeader = true,
}) => {
  const normalizedColumns: TableSkeletonColumn[] =
    typeof columns === "number"
      ? Array.from({ length: columns }, () => ({}))
      : columns;

  return (
    <Paper
      data-testid="table-skeleton"
      sx={{
        borderRadius: 3,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        boxShadow: "none",
        overflow: "hidden",
        ...paperSx,
      }}
    >
      <TableContainer>
        <Table>
          {showHeader && (
            <TableHead>
              <TableRow>
                {normalizedColumns.map((col, idx) => (
                  <TableCell
                    key={`skeleton-th-${idx}`}
                    align={col.align ?? "left"}
                    sx={{
                      width: col.width,
                      fontWeight: 600,
                    }}
                  >
                    {col.header ? (
                      col.header
                    ) : (
                      <Skeleton
                        variant="text"
                        width={col.width ? "60%" : "70%"}
                        height={20}
                        sx={{
                          mx: col.align === "center" ? "auto" : undefined,
                          ml: col.align === "right" ? "auto" : undefined,
                        }}
                        animation="wave"
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
          )}
          <TableBody>
            <TableSkeletonRows columns={normalizedColumns} rows={rows} />
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default TableSkeleton;
