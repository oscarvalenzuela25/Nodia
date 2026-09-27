import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TableSkeleton } from "../../../components/skeletons";

describe("TableSkeleton Component", () => {
  it("renders with a numeric column count and default rows", () => {
    render(<TableSkeleton columns={6} rows={5} />);
    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
    // 5 body rows
    const rows = screen.getAllByRole("row");
    // 1 head row + 5 body rows = 6 rows
    expect(rows).toHaveLength(6);
  });

  it("renders with column objects including custom headers and alignments", () => {
    render(
      <TableSkeleton
        columns={[
          { width: 48, align: "center" },
          { header: "Código" },
          { header: "Nombre" },
          { header: "Precio", align: "right" },
          { header: "Estado", align: "center" },
          { width: 80, align: "right", header: "Acciones" },
        ]}
        rows={3}
      />
    );

    expect(screen.getByText("Código")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("Precio")).toBeInTheDocument();
    expect(screen.getByText("Estado")).toBeInTheDocument();
    expect(screen.getByText("Acciones")).toBeInTheDocument();

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(4); // 1 header + 3 body
  });
});
