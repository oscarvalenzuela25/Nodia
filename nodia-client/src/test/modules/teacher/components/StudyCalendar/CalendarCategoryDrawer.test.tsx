import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import CalendarCategoryDrawer from "../../../../../modules/teacher/components/StudyCalendar/CalendarCategoryDrawer";
import type { CalendarCategory } from "../../../../../modules/teacher/infrastructure/studyCalendar";

const initialCategories: CalendarCategory[] = [
  { id: "languages", name: "Idiomas", color: "violet", active: true },
  { id: "practice", name: "Práctica", color: "green", active: false },
];

it("opens editing with the named pencil and restores focus when cancelled", async () => {
  const user = userEvent.setup();
  render(<CalendarCategoryDrawer categories={initialCategories} busy={false} onClose={vi.fn()} onSave={vi.fn()} onToggle={vi.fn()} />);
  const edit = screen.getByRole("button", { name: "Editar categoría Idiomas" });
  await user.click(edit);
  expect(screen.getByRole("textbox", { name: /nombre de la categoría/i })).toHaveValue("Idiomas");
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByRole("button", { name: "Editar categoría Idiomas" })).toHaveFocus();
});

it("labels inactive categories and restores focus when reactivation moves one out of the filter", async () => {
  const user = userEvent.setup();
  const toggled = vi.fn();
  function Categories() {
    const [categories, setCategories] = useState(initialCategories);
    return <CalendarCategoryDrawer categories={categories} busy={false} onClose={vi.fn()} onSave={vi.fn()}
      onToggle={async (id, active) => {
        toggled(id, active);
        setCategories(current => current.map(category => category.id === id ? { ...category, active } : category));
        return true;
      }} />;
  }
  render(<Categories />);
  expect(screen.queryByRole("button", { name: "Activar categoría Práctica" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Estado de actividad" }));
  await user.click(screen.getByText("Inactivo", { exact: true }));
  const pill = within(screen.getByRole("list", { name: "Categorías" })).getByRole("listitem");
  expect(within(pill).getByText("Inactiva")).toBeVisible();
  await user.click(within(pill).getByRole("button", { name: "Activar categoría Práctica" }));
  const confirm = screen.getByRole("dialog", { name: "Activar" });
  expect(toggled).not.toHaveBeenCalled();
  await user.click(within(confirm).getByRole("button", { name: "Activar" }));
  expect(toggled).toHaveBeenCalledWith("practice", true);
  await waitFor(() => expect(screen.getByRole("button", { name: "Nueva categoría" })).toHaveFocus());
});
