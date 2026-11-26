import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useCvDraftExit } from "../../../../modules/nodiaCv/infrastructure/useCvDraftExit";

function openDraft(save: () => Promise<boolean>, initialUnsaved = true) {
  const retire = vi.fn();
  function Editor() {
    const [unsaved, setUnsaved] = useState(initialUnsaved);
    const [section, setSection] = useState("Generate");
    const exit = useCvDraftExit({
      unsaved,
      save,
      retire: (saved) => {
        retire(saved);
        setUnsaved(false);
      },
    });
    return (
      <>
        <h1>{section}</h1>
        <button onClick={() => exit.request(() => setSection("Saved"))}>Saved tab</button>
        <Link to="/profiles">Leave module</Link>
        {exit.open && (
          <div role="dialog" aria-label="Unsaved draft">
            <button onClick={exit.keepEditing}>Keep editing</button>
            <button onClick={exit.discard}>Discard</button>
            <button onClick={() => void exit.saveAndLeave()}>Save</button>
            {exit.saveFailed && <p role="alert">Save failed</p>}
          </div>
        )}
      </>
    );
  }
  const router = createMemoryRouter([
    { path: "/cv", element: <Editor /> },
    { path: "/profiles", element: <h1>Profiles</h1> },
  ], { initialEntries: ["/cv"] });
  render(<RouterProvider router={router} />);
  return { user: userEvent.setup(), router, retire };
}

describe("CV draft exit", () => {
  it("keeps editing on cancel and only discards on explicit confirmation", async () => {
    const { user, retire } = openDraft(vi.fn());
    const requestExit = () => user.click(screen.getByRole("button", { name: "Saved tab" }));

    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    await requestExit();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("heading", { name: "Generate" })).toBeVisible();
    expect(retire).not.toHaveBeenCalled();

    await requestExit();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("heading", { name: "Saved" })).toBeVisible();
    expect(retire).toHaveBeenCalledExactlyOnceWith(false);
    const cleanUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
  });

  it("keeps the route and draft on a failed save, then leaves after a verified save", async () => {
    const save = vi.fn<() => Promise<boolean>>().mockResolvedValueOnce(false);
    let completed!: (saved: boolean) => void;
    save.mockImplementationOnce(() => new Promise<boolean>((resolve) => { completed = resolve; }));
    const { user, router, retire } = openDraft(save);

    await user.click(screen.getByRole("link", { name: "Leave module" }));
    expect(screen.getByRole("dialog", { name: "Unsaved draft" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Save failed");
    expect(router.state.location.pathname).toBe("/cv");
    expect(retire).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(router.state.location.pathname).toBe("/cv");
    expect(retire).not.toHaveBeenCalled();
    await act(async () => { completed(true); });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Profiles" })).toBeVisible());
    expect(retire).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("continues without a dialog after the draft is already saved", async () => {
    const { user, retire } = openDraft(vi.fn(), false);
    await user.click(screen.getByRole("button", { name: "Saved tab" }));
    expect(screen.getByRole("heading", { name: "Saved" })).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(retire).not.toHaveBeenCalled();
  });
});
