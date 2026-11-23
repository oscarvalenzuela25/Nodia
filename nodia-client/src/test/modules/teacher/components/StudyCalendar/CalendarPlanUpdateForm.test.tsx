import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import CalendarPlanUpdateForm from "../../../../../modules/teacher/components/StudyCalendar/CalendarPlanUpdateForm";
import type { CalendarCategory, CalendarSummary } from "../../../../../modules/teacher/infrastructure/studyCalendar";

const inactiveAssigned: CalendarCategory = { id: "legacy", name: "Viajes", color: "blue", active: false };
const available: CalendarCategory = { id: "languages", name: "Idiomas", color: "violet", active: true };
const inactiveUnassigned: CalendarCategory = { id: "retired", name: "Archivada", color: "green", active: false };
const plan: CalendarSummary = {
  id: "plan", title: "Inglés", categories: [inactiveAssigned], active: false,
  schedule: { kind: "numbered", days: 1 }, day_count: 1, completed_count: 0,
};

it("allows editing an inactive plan while retaining assigned inactive categories and omitting other inactive choices", async () => {
  const save = vi.fn(async () => {});
  const user = userEvent.setup();
  render(<CalendarPlanUpdateForm plan={plan} categories={[inactiveAssigned, available, inactiveUnassigned]} busy={false}
    onCancel={vi.fn()} onSave={save} />);
  expect(screen.getByRole("checkbox", { name: "Viajes (inactiva)" })).toBeChecked();
  expect(screen.queryByRole("checkbox", { name: /Archivada/ })).not.toBeInTheDocument();
  const title = screen.getByRole("textbox", { name: /Título del calendario/ });
  await user.clear(title);
  await user.type(title, "Inglés actualizado");
  await user.click(screen.getByRole("checkbox", { name: "Idiomas" }));
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith({ title: "Inglés actualizado", category_ids: ["legacy", "languages"] }));
});
