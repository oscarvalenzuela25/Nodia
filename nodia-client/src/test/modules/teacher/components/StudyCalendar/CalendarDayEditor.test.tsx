import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CalendarDayEditor from "../../../../../modules/teacher/components/StudyCalendar/CalendarDayEditor";
import type { CalendarDay } from "../../../../../modules/teacher/infrastructure/studyCalendar";

const day: CalendarDay = {
  id: "day", ordinal: 9, date: null, title: "Gramática", minutes: 30, notes: null, revision: 3,
  activity_count: 2, completed_activity_count: 0, completed: false,
  activities: [
    { id: "lesson", text: "Ver lección", completed: false, source: { label: "Material", url: "https://example.test/lesson" } },
    { id: "practice", text: "Practicar oralmente", completed: false },
  ],
};

describe("CalendarDayEditor", () => {
  it("keeps the source with its activity and records only activity flags when all are checked", async () => {
    const save = vi.fn(async () => {});
    const user = userEvent.setup();
    render(<CalendarDayEditor day={day} busy={false} onCancel={vi.fn()} onSave={save} onReload={vi.fn()} />);
    const activities = within(screen.getByRole("region", { name: "Actividades" }));
    const status = activities.getByRole("status");
    const [lesson, practice] = within(activities.getByRole("list")).getAllByRole("listitem");
    const lessonCheckbox = within(lesson).getByRole("checkbox", { name: "Ver lección" });
    const practiceCheckbox = within(practice).getByRole("checkbox", { name: "Practicar oralmente" });
    expect(within(lesson).getByRole("link", { name: "Material" })).toHaveAttribute("href", "https://example.test/lesson");
    await user.click(within(lesson).getByText("Ver lección"));
    expect(lessonCheckbox).toBeChecked();
    expect(within(status).getByText("Jornada pendiente")).toBeVisible();
    practiceCheckbox.focus();
    await user.keyboard("[Space]");
    expect(within(status).getByText("Jornada completada")).toBeVisible();
    await user.click(practiceCheckbox);
    expect(within(status).getByText("Jornada pendiente")).toBeVisible();
    await user.click(practiceCheckbox);
    await user.click(screen.getByRole("button", { name: "Guardar jornada" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({
      revision: 3, title: "Gramática", notes: null, minutes: 30,
      activities: [
        { id: "lesson", text: "Ver lección", completed: true, source: { label: "Material", url: "https://example.test/lesson" } },
        { id: "practice", text: "Practicar oralmente", completed: true },
      ],
    });
  });

  it("preserves edits after a failed save", async () => {
    const save = vi.fn(async () => { throw new Error("network"); });
    const user = userEvent.setup();
    render(<CalendarDayEditor day={day} busy={false} onCancel={vi.fn()} onSave={save} onReload={vi.fn()} />);
    const notes = screen.getByRole("textbox", { name: "Apuntes" });
    await user.type(notes, "Repetir antes del viernes");
    await user.click(screen.getByRole("button", { name: "Guardar jornada" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(notes).toHaveValue("Repetir antes del viernes");
    expect(screen.getByRole("button", { name: "Guardar jornada" })).toBeEnabled();
  });
});
