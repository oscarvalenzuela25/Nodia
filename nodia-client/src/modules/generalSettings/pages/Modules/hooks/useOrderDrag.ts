import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { DragHandleBindings, DragOrderItem } from "../components/DragOrderHandle/types";

export type { DragOrderItem } from "../components/DragOrderHandle/types";
export type DropPlacement = "before" | "after";
type DragState = { source: DragOrderItem; target: DragOrderItem | null; placement: DropPlacement };
type Session = {
  source: DragOrderItem;
  contextKey: string | number;
  pointerId: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  armed: boolean;
  button: HTMLButtonElement;
  scroll: Element | null;
  target: DragOrderItem | null;
  placement: DropPlacement;
};
type Options = {
  items: DragOrderItem[];
  disabled: boolean;
  contextKey: string | number;
  onDrop(source: DragOrderItem, target: DragOrderItem, placement: DropPlacement): void;
  onStep(item: DragOrderItem, direction: "up" | "down"): void;
};

export function canDropOrderItem(source: DragOrderItem, target: DragOrderItem): boolean {
  return source.id !== target.id && source.kind === target.kind &&
    (source.kind === "group" || Boolean(source.groupId) && source.groupId === target.groupId);
}

function scrollParent(button: Element): Element | null {
  let node = button.parentElement;
  while (node) {
    if (node.scrollHeight > node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY)) return node;
    node = node.parentElement;
  }
  return document.scrollingElement;
}

export function useOrderDrag({ items, disabled, contextKey, onDrop, onStep }: Options) {
  const session = useRef<Session | null>(null);
  const frame = useRef<number | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const clear = useCallback(() => {
    const value = session.current;
    session.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (value?.button.hasPointerCapture?.(value.pointerId)) value.button.releasePointerCapture(value.pointerId);
  }, []);
  const cancelDrag = useCallback(() => { clear(); setDragState(null); }, [clear]);
  useEffect(() => {
    if (disabled || session.current?.contextKey !== contextKey) cancelDrag();
  }, [disabled, contextKey, cancelDrag]);
  useEffect(() => () => {
    const value = session.current;
    session.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (value?.button.hasPointerCapture?.(value.pointerId)) value.button.releasePointerCapture(value.pointerId);
  }, []);

  const updateTarget = (value: Session) => {
    const element = document.elementFromPoint(value.x, value.y)?.closest<HTMLElement>("[data-order-kind][data-order-id]");
    const candidate = element && items.find((item) => item.id === element.dataset.orderId && item.kind === element.dataset.orderKind);
    value.target = candidate && canDropOrderItem(value.source, candidate) ? candidate : null;
    value.placement = element && value.y >= element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2 ? "after" : "before";
    const target = value.target;
    setDragState((previous) => previous?.source === value.source && previous.target === target && previous.placement === value.placement
      ? previous : { source: value.source, target, placement: value.placement });
  };
  const autoScroll = () => {
    const value = session.current;
    if (!value?.armed) return;
    const container = value.scroll;
    if (container) {
      const rect = container === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : container.getBoundingClientRect();
      const delta = value.y < rect.top + 48 ? -12 : value.y > rect.bottom - 48 ? 12 : 0;
      if (delta) { container.scrollTop += delta; updateTarget(value); }
    }
    frame.current = requestAnimationFrame(autoScroll);
  };
  const finish = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const value = session.current;
    if (!value || event.pointerId !== value.pointerId) return;
    value.x = event.clientX; value.y = event.clientY;
    if (!disabled && contextKey === value.contextKey && value.armed) updateTarget(value);
    const target = value.target;
    cancelDrag();
    if (!disabled && contextKey === value.contextKey && value.armed && target) {
      event.preventDefault();
      onDrop(value.source, target, value.placement);
    }
  };
  const getHandleProps = (item: DragOrderItem): DragHandleBindings => ({
    onPointerDown: (event) => {
      if (disabled || session.current || event.button !== 0 || !event.isPrimary) return;
      event.currentTarget.focus({ preventScroll: true });
      session.current = { source: item, contextKey, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        startX: event.clientX, startY: event.clientY, armed: false, button: event.currentTarget,
        scroll: scrollParent(event.currentTarget), target: null, placement: "before" };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event) => {
      const value = session.current;
      if (!value || event.pointerId !== value.pointerId) return;
      if (disabled || contextKey !== value.contextKey) { cancelDrag(); return; }
      value.x = event.clientX; value.y = event.clientY;
      if (!value.armed && Math.hypot(value.x - value.startX, value.y - value.startY) < 6) return;
      event.preventDefault();
      if (!value.armed) { value.armed = true; frame.current = requestAnimationFrame(autoScroll); }
      updateTarget(value);
    },
    onPointerUp: finish,
    onPointerCancel: cancelDrag,
    onLostPointerCapture: cancelDrag,
    onKeyDown: (event) => {
      if (event.key === "Escape") { event.preventDefault(); cancelDrag(); return; }
      if (disabled || session.current || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      onStep(item, event.key === "ArrowUp" ? "up" : "down");
    },
  });
  const getRowProps = (item: DragOrderItem) => ({
    "data-order-kind": item.kind,
    "data-order-id": item.id,
    "data-order-placement": dragState?.target?.kind === item.kind && dragState.target.id === item.id ? dragState.placement : undefined,
    "data-order-dragging": dragState?.source.kind === item.kind && dragState.source.id === item.id ? "true" : undefined,
  });
  return { dragState, getHandleProps, getRowProps, cancelDrag };
}
