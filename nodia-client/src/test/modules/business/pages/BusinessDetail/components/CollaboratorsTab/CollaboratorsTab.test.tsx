import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CollaboratorsTab } from "../../../../../../../modules/business/pages/BusinessDetail/components/CollaboratorsTab/CollaboratorsTab";
import type { BusinessCollaborator } from "../../../../../../../modules/business/infrastructure/types";

const mockCollaborators: BusinessCollaborator[] = [
  {
    id: "collab-1",
    user_id: "101",
    position: "Jefe de Compras",
    action_ids: ["act-1", "act-2"],
    is_active: true,
    user: {
      id: "101",
      name: "Carlos Sanchez",
      email: "carlos@test.com",
    },
  },
  {
    id: "collab-2",
    user_id: "102",
    position: null,
    action_ids: ["act-3"],
    is_active: false,
    user: {
      id: "102",
      name: "Ana Gomez",
      email: "ana@test.com",
    },
  },
];

describe("CollaboratorsTab Component", () => {
  it("renders empty state when there are no collaborators", () => {
    const onOpenAdd = vi.fn();
    render(
      <CollaboratorsTab
        collaborators={[]}
        onOpenAddCollaborator={onOpenAdd}
      />
    );

    expect(
      screen.getByText("Aún no se han configurado colaboradores para este negocio.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Agregar colaborador" })
    ).toBeInTheDocument();
  });

  it("renders table with collaborator list including avatars, names, positions, action chips, and status", () => {
    const onOpenAdd = vi.fn();
    render(
      <CollaboratorsTab
        collaborators={mockCollaborators}
        onOpenAddCollaborator={onOpenAdd}
      />
    );

    // Header title and add button
    expect(screen.getByText("Colaboradores del Negocio")).toBeInTheDocument();

    // Table column headers
    expect(screen.getByText("Colaborador / Usuario")).toBeInTheDocument();
    expect(screen.getByText("Cargo / Posición")).toBeInTheDocument();
    expect(screen.getByText("Acciones Asignadas")).toBeInTheDocument();
    expect(screen.getByText("Estado")).toBeInTheDocument();

    // First collaborator
    expect(screen.getByText("Carlos Sanchez")).toBeInTheDocument();
    expect(screen.getByText("carlos@test.com")).toBeInTheDocument();
    expect(screen.getByText("Jefe de Compras")).toBeInTheDocument();
    expect(screen.getByText("2 asignadas")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();

    // Second collaborator
    expect(screen.getByText("Ana Gomez")).toBeInTheDocument();
    expect(screen.getByText("ana@test.com")).toBeInTheDocument();
    expect(screen.getByText("Sin especificar")).toBeInTheDocument();
    expect(screen.getByText("1 asignadas")).toBeInTheDocument();
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
  });

  it("calls onOpenAddCollaborator when clicking header button or row edit button", async () => {
    const user = userEvent.setup();
    const onOpenAdd = vi.fn();
    render(
      <CollaboratorsTab
        collaborators={mockCollaborators}
        onOpenAddCollaborator={onOpenAdd}
      />
    );

    const headerAddBtn = screen.getByTestId("add-collab-tab-btn");
    await user.click(headerAddBtn);
    expect(onOpenAdd).toHaveBeenCalledTimes(1);

    const rowEditBtn = screen.getByTestId("edit-collab-btn-collab-1");
    await user.click(rowEditBtn);
    expect(onOpenAdd).toHaveBeenCalledTimes(2);
  });
});
