/**
 * Unit tests for useRovingTabIndex keyboard navigation logic.
 *
 * These tests validate the core navigation algorithm by simulating
 * keyboard events. Uses vitest -- install with `npm install -D vitest`
 * if not already available.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRovingTabIndex } from "../useRovingTabIndex";

const items = ["item-a", "item-b", "item-c", "item-d"];

function makeKeyEvent(key: string): React.KeyboardEvent {
  return {
    key,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent;
}

describe("useRovingTabIndex", () => {
  it("ArrowDown moves to next item", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useRovingTabIndex(items, 0, onChange),
    );

    const event = makeKeyEvent("ArrowDown");
    act(() => result.current.handleKeyDown(event));

    expect(onChange).toHaveBeenCalledWith(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("ArrowUp moves to previous item", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useRovingTabIndex(items, 2, onChange),
    );

    const event = makeKeyEvent("ArrowUp");
    act(() => result.current.handleKeyDown(event));

    expect(onChange).toHaveBeenCalledWith(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("ArrowDown on last item wraps to first", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useRovingTabIndex(items, 3, onChange),
    );

    const event = makeKeyEvent("ArrowDown");
    act(() => result.current.handleKeyDown(event));

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("ArrowUp on first item wraps to last", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useRovingTabIndex(items, 0, onChange),
    );

    const event = makeKeyEvent("ArrowUp");
    act(() => result.current.handleKeyDown(event));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("Home moves to first item", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useRovingTabIndex(items, 2, onChange),
    );

    const event = makeKeyEvent("Home");
    act(() => result.current.handleKeyDown(event));

    expect(onChange).toHaveBeenCalledWith(0);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("End moves to last item", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useRovingTabIndex(items, 0, onChange),
    );

    const event = makeKeyEvent("End");
    act(() => result.current.handleKeyDown(event));

    expect(onChange).toHaveBeenCalledWith(3);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("orientation: vertical ignores ArrowLeft/ArrowRight", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useRovingTabIndex(items, 1, onChange, { orientation: "vertical" }),
    );

    const leftEvent = makeKeyEvent("ArrowLeft");
    act(() => result.current.handleKeyDown(leftEvent));
    expect(onChange).not.toHaveBeenCalled();
    expect(leftEvent.preventDefault).not.toHaveBeenCalled();

    const rightEvent = makeKeyEvent("ArrowRight");
    act(() => result.current.handleKeyDown(rightEvent));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("orientation: horizontal ignores ArrowUp/ArrowDown", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useRovingTabIndex(items, 1, onChange, { orientation: "horizontal" }),
    );

    const upEvent = makeKeyEvent("ArrowUp");
    act(() => result.current.handleKeyDown(upEvent));
    expect(onChange).not.toHaveBeenCalled();
    expect(upEvent.preventDefault).not.toHaveBeenCalled();

    const downEvent = makeKeyEvent("ArrowDown");
    act(() => result.current.handleKeyDown(downEvent));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Space and Enter are NOT prevented", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useRovingTabIndex(items, 1, onChange),
    );

    const spaceEvent = makeKeyEvent(" ");
    act(() => result.current.handleKeyDown(spaceEvent));
    expect(spaceEvent.preventDefault).not.toHaveBeenCalled();

    const enterEvent = makeKeyEvent("Enter");
    act(() => result.current.handleKeyDown(enterEvent));
    expect(enterEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("getTabIndex returns 0 for active, -1 for others", () => {
    const { result } = renderHook(() =>
      useRovingTabIndex(items, 2, vi.fn()),
    );

    expect(result.current.getTabIndex(0)).toBe(-1);
    expect(result.current.getTabIndex(1)).toBe(-1);
    expect(result.current.getTabIndex(2)).toBe(0);
    expect(result.current.getTabIndex(3)).toBe(-1);
  });
});
