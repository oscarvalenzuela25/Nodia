import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import CalendarPlanCard from "../../../../../modules/teacher/components/StudyCalendar/CalendarPlanCard";
import type { CalendarSummary } from "../../../../../modules/teacher/infrastructure/studyCalendar";

const plan: CalendarSummary = {
  id: "plan", title: "Inglés", categories: [], active: false,
  schedule: { kind: "numbered", days: 1 }, day_count: 1, completed_count: 0,
};

it("opens the inactive calendar's actions with the keyboard and restores focus on Escape", async () => {
  const user = userEvent.setup();
  const select = vi.fn();
  const action = vi.fn();
  render(<ul><CalendarPlanCard plan={plan} selected={false} disabled={false} onSelect={select} onAction={action} /></ul>);
  const selection = screen.getByRole("button", { name: /Inglés.*Inactivo/ });
  const trigger = screen.getByRole("button", { name: "Acciones para Inglés" });
  expect(selection).not.toContainElement(trigger);
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  const menu = await screen.findByRole("menu", { name: "Acciones para Inglés" });
  expect(within(menu).getByRole("menuitem", { name: "Actualizar" })).toHaveFocus();
  expect(within(menu).getByRole("menuitem", { name: "Activar" })).toBeVisible();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(action).not.toHaveBeenCalled();
  expect(select).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("menuitem", { name: "Eliminar" }));
  await waitFor(() => expect(action).toHaveBeenCalledWith("delete"));
  expect(select).not.toHaveBeenCalled();
});
