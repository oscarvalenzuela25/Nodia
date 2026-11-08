import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOrderDrag, type DragOrderItem } from "../../../../../../modules/generalSettings/pages/Modules/hooks/useOrderDrag";

const items: DragOrderItem[] = [
  { kind: "module", id: "1", groupId: "10", sortOrder: 0, label: "One" },
  { kind: "module", id: "2", groupId: "10", sortOrder: 7, label: "Two" },
  { kind: "module", id: "3", groupId: "11", sortOrder: 0, label: "Other parent" },
  { kind: "group", id: "10", sortOrder: 0, label: "Group" },
];
const onDrop = vi.fn();
const onStep = vi.fn();
type Props = { disabled?: boolean; contextKey?: number };
function Fixture({ disabled = false, contextKey = 1 }: Props) {
  const drag = useOrderDrag({ items, disabled, contextKey, onDrop, onStep });
  return <>
    <output>{drag.dragState ? "dragging" : "idle"}</output>
    {items.map((item) => <div key={item.kind + item.id} {...drag.getRowProps(item)}>
      <button {...drag.getHandleProps(item)} disabled={disabled}>{item.label}</button>
    </div>)}
  </>;
}
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly isPrimary: boolean;
  constructor(type: string, options: PointerEventInit = {}) {
    super(type, options);
    this.pointerId = options.pointerId ?? 1;
    this.isPrimary = options.isPrimary ?? true;
  }
}
let point: Element | null;
let originalPoint: PropertyDescriptor | undefined;
let originalCapture: Array<[string, PropertyDescriptor | undefined]>;
const captures = new WeakMap<Element, Set<number>>();
const coordinates = { pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: 10 };
function aim(label = "Two") {
  point = screen.getByRole("button", { name: label }).parentElement;
  vi.spyOn(point!, "getBoundingClientRect").mockReturnValue({ top: 20, bottom: 60, left: 0, right: 100, width: 100, height: 40, x: 0, y: 20, toJSON: () => ({}) });
}
function start() {
  const button = screen.getByRole("button", { name: "One" });
  fireEvent.pointerDown(button, coordinates);
  fireEvent.pointerMove(button, { ...coordinates, clientY: 25 });
  return button;
}
beforeEach(() => {
  vi.clearAllMocks();point = null;
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 7));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  originalPoint = Object.getOwnPropertyDescriptor(document, "elementFromPoint");
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => point });
  originalCapture = ["setPointerCapture", "hasPointerCapture", "releasePointerCapture"].map((key) => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)]);
  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: { configurable: true, value: vi.fn(function (this: HTMLElement, id: number) { captures.set(this, new Set([id])); }) },
    hasPointerCapture: { configurable: true, value: vi.fn(function (this: HTMLElement, id: number) { return captures.get(this)?.has(id) ?? false; }) },
    releasePointerCapture: { configurable: true, value: vi.fn(function (this: HTMLElement, id: number) { captures.get(this)?.delete(id); }) },
  });
});
afterEach(() => {
  vi.restoreAllMocks();vi.unstubAllGlobals();
  if (originalPoint) Object.defineProperty(document, "elementFromPoint", originalPoint);
  else Reflect.deleteProperty(document, "elementFromPoint");
  for (const [key, descriptor] of originalCapture) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, key);
  }
});

describe("pointer order intent", () => {
  it("commits only once on release and resolves the final pointerup coordinates", () => {
    render(<Fixture />);aim();const button = start();
    expect(onDrop).not.toHaveBeenCalled();
    expect(point).toHaveAttribute("data-order-placement", "before");
    fireEvent.pointerUp(button, { ...coordinates, clientY: 55 });
    expect(onDrop).toHaveBeenCalledExactlyOnceWith(items[0], items[1], "after");
    expect(screen.getByText("idle")).toBeVisible();
    fireEvent.pointerUp(button, { ...coordinates, clientY: 55 });
    expect(onDrop).toHaveBeenCalledTimes(1);
  });
  it.each(["One", "Other parent", "Group"])("rejects a drop on %s", (name) => {
    render(<Fixture />);aim(name);const button = start();
    fireEvent.pointerUp(button, { ...coordinates, clientY: 30 });
    expect(onDrop).not.toHaveBeenCalled();
  });
  it("does not turn a short click into a movement", () => {
    render(<Fixture />);aim();const button = screen.getByRole("button", { name: "One" });
    fireEvent.pointerDown(button, coordinates);
    fireEvent.pointerMove(button, { ...coordinates, clientY: 12 });
    fireEvent.pointerUp(button, { ...coordinates, clientY: 12 });
    expect(onDrop).not.toHaveBeenCalled();
  });
  it("Escape cancels the gesture and its animation loop", () => {
    render(<Fixture />);aim();const button = start();
    fireEvent.keyDown(button, { key: "Escape" });
    fireEvent.pointerUp(button, { ...coordinates, clientY: 30 });
    expect(onDrop).not.toHaveBeenCalled();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(screen.getByText("idle")).toBeVisible();
  });
  it.each([{ disabled: true, contextKey: 1 }, { disabled: false, contextKey: 2 }])("cancels active capture on disabled/context change %j", (props) => {
    const view = render(<Fixture />);aim();const button = start();
    view.rerender(<Fixture {...props} />);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(screen.getByText("idle")).toBeVisible();
    fireEvent.pointerUp(button, { ...coordinates, clientY: 30 });
    expect(onDrop).not.toHaveBeenCalled();
  });
  it("ignores another pointer and cancels on lost capture", () => {
    render(<Fixture />);aim();const button = start();
    fireEvent.pointerUp(button, { ...coordinates, pointerId: 2, clientY: 30 });
    expect(onDrop).not.toHaveBeenCalled();
    fireEvent.lostPointerCapture(button, coordinates);
    fireEvent.pointerUp(button, { ...coordinates, clientY: 30 });
    expect(onDrop).not.toHaveBeenCalled();
  });
  it("supports keyboard steps without a pointer drag", () => {
    const view = render(<Fixture />);
    const button = screen.getByRole("button", { name: "One" });
    fireEvent.keyDown(button, { key: "ArrowDown" });
    expect(onStep).toHaveBeenCalledExactlyOnceWith(items[0], "down");
    expect(onDrop).not.toHaveBeenCalled();
    view.rerender(<Fixture disabled />);
    fireEvent.keyDown(button, { key: "ArrowUp" });
    expect(onStep).toHaveBeenCalledTimes(1);
  });
});
