import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import ConfirmDialog from "../../../../src/components/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders title, message and action buttons when open", () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Confirm Deactivation"
        message="Are you sure you want to deactivate this item?"
      />
    );

    expect(screen.getByText("Confirm Deactivation")).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to deactivate this item?")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
  });

  it("does not render content when open is false", () => {
    render(
      <ConfirmDialog
        open={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Hidden Dialog"
        message="Hidden message"
      />
    );

    expect(screen.queryByText("Hidden Dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden message")).not.toBeInTheDocument();
  });

  it("renders custom children content when provided", () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Custom Content"
      >
        <div data-testid="custom-child">Custom Children Nodes</div>
      </ConfirmDialog>
    );

    expect(screen.getByTestId("custom-child")).toBeInTheDocument();
    expect(screen.getByText("Custom Children Nodes")).toBeInTheDocument();
  });

  it("calls onClose when close icon button is clicked", async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open={true}
        onClose={handleClose}
        onConfirm={vi.fn()}
        title="Test Dialog"
        message="Test message"
      />
    );

    const closeBtn = screen.getByLabelText(/close|cerrar/i);
    await user.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const handleConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
        title="Test Confirm"
        message="Confirm message"
      />
    );

    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    await user.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const handleCancel = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open={true}
        onClose={handleClose}
        onCancel={handleCancel}
        onConfirm={vi.fn()}
        title="Test Cancel"
        message="Cancel message"
      />
    );

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    expect(handleCancel).toHaveBeenCalledTimes(1);
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("falls back to onClose when cancel button is clicked and onCancel is not provided", async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open={true}
        onClose={handleClose}
        onConfirm={vi.fn()}
        title="Test Cancel Fallback"
        message="Cancel message"
      />
    );

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("disables buttons and prevents callbacks when isLoading is true", () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        isLoading={true}
        title="Loading State"
        message="Processing action"
      />
    );

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    const closeBtn = screen.getByLabelText(/close|cerrar/i);

    expect(cancelBtn).toBeDisabled();
    expect(confirmBtn).toBeDisabled();
    expect(closeBtn).toBeDisabled();
    expect(handleConfirm).not.toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("renders custom confirmText and cancelText", () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Custom Buttons"
        confirmText="Yes, delete it"
        cancelText="No, keep it"
      />
    );

    expect(
      screen.getByRole("button", { name: "Yes, delete it" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "No, keep it" })
    ).toBeInTheDocument();
  });

  it("does not call onClose when escape key is pressed or backdrop is clicked", async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open={true}
        onClose={handleClose}
        onConfirm={vi.fn()}
        title="Test Confirm"
        message="Are you sure?"
      />
    );

    await user.keyboard("{Escape}");
    expect(handleClose).not.toHaveBeenCalled();

    const backdrop = document.querySelector(".MuiBackdrop-root");
    if (backdrop) {
      await user.click(backdrop);
    }
    expect(handleClose).not.toHaveBeenCalled();
  });
});
