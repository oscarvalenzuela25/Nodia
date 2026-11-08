import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AttachmentDraftPreview from "../../../../../modules/nodiaAi/components/Attachments/AttachmentDraftPreview";

const createDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
const createUrl = vi.fn();
const revokeUrl = vi.fn();
beforeEach(() => {
  createUrl.mockReset().mockImplementation((file: File) => `blob:synthetic-${file.name}`);
  revokeUrl.mockReset();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createUrl });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeUrl });
});
afterEach(() => {
  if (createDescriptor) Object.defineProperty(URL, "createObjectURL", createDescriptor);
  else Reflect.deleteProperty(URL, "createObjectURL");
  if (revokeDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeDescriptor);
  else Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("local attachment thumbnail", () => {
  it("renders local bytes without fetching and releases its object URL when removed", () => {
    const file = new File(["synthetic image"], "photo.png", { type: "image/png" });
    const view = render(<AttachmentDraftPreview file={file} />);
    expect(screen.getByRole("img", { name: "Vista previa de photo.png" })).toHaveAttribute("src", "blob:synthetic-photo.png");
    expect(createUrl).toHaveBeenCalledWith(file);
    view.unmount();
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith("blob:synthetic-photo.png");
  });

  it("releases the old preview when another local File replaces it", () => {
    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.png", { type: "image/png" });
    const view = render(<AttachmentDraftPreview file={first} />);
    view.rerender(<AttachmentDraftPreview file={second} />);
    expect(revokeUrl).toHaveBeenCalledWith("blob:synthetic-first.png");
    expect(screen.getByRole("img", { name: "Vista previa de second.png" })).toHaveAttribute("src", "blob:synthetic-second.png");
    view.unmount();
    expect(revokeUrl).toHaveBeenCalledWith("blob:synthetic-second.png");
  });

  it("shows a safe fallback on an invalid image and revokes its bytes without retrying", () => {
    const file = new File(["not a valid image"], "invalid.png", { type: "image/png" });
    render(<AttachmentDraftPreview file={file} />);
    fireEvent.error(screen.getByRole("img", { name: "Vista previa de invalid.png" }));
    expect(screen.queryByRole("img", { name: "Vista previa de invalid.png" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Vista previa no disponible" })).toBeInTheDocument();
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith("blob:synthetic-invalid.png");
    expect(createUrl).toHaveBeenCalledTimes(1);
  });
});
