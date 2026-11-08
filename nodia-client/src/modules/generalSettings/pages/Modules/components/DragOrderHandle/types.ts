import type { KeyboardEventHandler, PointerEventHandler } from "react";

export type DragOrderItem = {
  kind: "module" | "group";
  id: string;
  groupId?: string;
  sortOrder: number;
  label: string;
};

export type DragHandleBindings = {
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  onPointerMove: PointerEventHandler<HTMLButtonElement>;
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel: PointerEventHandler<HTMLButtonElement>;
  onLostPointerCapture: PointerEventHandler<HTMLButtonElement>;
  onKeyDown: KeyboardEventHandler<HTMLButtonElement>;
};
