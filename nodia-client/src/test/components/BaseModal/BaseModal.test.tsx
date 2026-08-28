import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import BaseModal from "../../../../src/components/BaseModal";

describe("BaseModal", () => {
  it("renders title, subtitle and content when open", () => {
    render(
      <BaseModal
        open={true}
        onClose={vi.fn()}
        title="Modal Title"
        subtitle="Modal Subtitle Description"
      >
        <div>Modal Content Body</div>
      </BaseModal>
    );

    expect(screen.getByText("Modal Title")).toBeInTheDocument();
    expect(screen.getByText("Modal Subtitle Description")).toBeInTheDocument();
    expect(screen.getByText("Modal Content Body")).toBeInTheDocument();
  });

  it("does not render content when open is false", () => {
    render(
      <BaseModal open={false} onClose={vi.fn()} title="Hidden Modal">
        <div>Hidden Content</div>
      </BaseModal>
    );

    expect(screen.queryByText("Hidden Modal")).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden Content")).not.toBeInTheDocument();
  });

  it("calls onClose when close icon button is clicked", async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <BaseModal open={true} onClose={handleClose} title="Test Modal">
        <div>Content</div>
      </BaseModal>
    );

    const closeBtn = screen.getByLabelText("close");
    await user.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders actions slot when provided", () => {
    render(
      <BaseModal
        open={true}
        onClose={vi.fn()}
        title="Test Modal"
        actions={<button type="button">Custom Action</button>}
      >
        <div>Content</div>
      </BaseModal>
    );

    expect(screen.getByText("Custom Action")).toBeInTheDocument();
  });
});
