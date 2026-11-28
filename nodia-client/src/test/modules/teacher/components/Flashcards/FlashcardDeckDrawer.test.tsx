import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import FlashcardDeckDrawer from "../../../../../modules/teacher/components/Flashcards/FlashcardDeckDrawer";

const set = { id: "450e45c5-b22e-463a-abf3-fc13bac10fae", title: "Inglés", deck_count: 0 };

it("requires a Set for a manual deck and passes that same destination to the JSON route", async () => {
  const user = userEvent.setup();
  const save = vi.fn().mockResolvedValue(undefined);
  const importJson = vi.fn();
  render(<FlashcardDeckDrawer kind="new-deck" sets={[set]} busy={false} onClose={vi.fn()}
    onSave={save} onImportJson={importJson} />);

  await user.type(screen.getByRole("textbox", { name: /Nombre del mazo/ }), "Día 1");
  expect(screen.getByRole("button", { name: "Crear mazo" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Set" }));
  await user.click(screen.getByRole("option", { name: "Inglés" }));
  await user.click(screen.getByRole("button", { name: "Crear mazo" }));
  expect(save).toHaveBeenCalledExactlyOnceWith({ title: "Día 1", category: null, set_id: set.id });
  await user.click(screen.getByRole("button", { name: "Crear desde JSON" }));
  expect(importJson).toHaveBeenCalledExactlyOnceWith(set.id);
});
