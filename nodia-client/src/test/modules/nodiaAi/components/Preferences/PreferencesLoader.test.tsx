import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Preferences from "../../../../../modules/nodiaAi/components/Preferences";
import { loadPreferences } from "../../../../../modules/nodiaAi/components/Preferences/loadPreferences";
vi.mock("../../../../../modules/nodiaAi/components/Preferences/loadPreferences", () => ({ loadPreferences: vi.fn() }));
vi.mock("../../../../../config/httpFeedback", () => ({ notifyHttpError: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
describe("preference editor by intent", () => {
  it("does not load before intent and retries a chunk failure without touching the page draft", async () => {
    const user = userEvent.setup();
    vi.mocked(loadPreferences).mockRejectedValueOnce(new Error("Synthetic missing chunk"));
    vi.mocked(loadPreferences).mockResolvedValue({ default: () => <div>Loaded synthetic panel</div> });
    const props = { conversationId: null, disabled: false, onClose: vi.fn() };
    const { rerender } = render(<><input aria-label="Other draft" defaultValue="Preserved" /><Preferences {...props} open={false} /></>);
    expect(loadPreferences).not.toHaveBeenCalled();
    rerender(<><input aria-label="Other draft" defaultValue="Preserved" /><Preferences {...props} open /></>);
    await screen.findByText("No pudimos abrir las preferencias. Reintenta sin recargar la página.");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Loaded synthetic panel");
    expect(screen.getByRole("textbox", { name: "Other draft" })).toHaveValue("Preserved");
    await waitFor(() => expect(loadPreferences).toHaveBeenCalledTimes(2));
  });
});
