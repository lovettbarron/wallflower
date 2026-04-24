"use client";

import { useCallback, useRef } from "react";

export type RovingOrientation = "horizontal" | "vertical" | "both";

interface RovingTabIndexOptions {
  /** Which arrow keys to handle. Default: 'both'. */
  orientation?: RovingOrientation;
  /** Whether to wrap around at list boundaries. Default: true. */
  wrap?: boolean;
}

interface RovingTabIndexReturn<T extends HTMLElement> {
  /** Ref callback: assign to each list item via `ref={refs(index)}`. */
  refs: (index: number) => (el: T | null) => void;
  /** Attach to the container's onKeyDown. */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /** Returns 0 for the active item, -1 for all others. */
  getTabIndex: (index: number) => 0 | -1;
}

/**
 * Reusable roving tabindex hook for arrow-key navigation in lists and groups.
 *
 * Supports ArrowDown/Up/Left/Right, Home, End. Calls e.preventDefault()
 * only for navigation keys -- Space and Enter pass through so they don't
 * block the transport bar or other interactive elements.
 *
 * @param items - Array of item identifiers (used for length only).
 * @param activeIndex - The currently focused item index.
 * @param onActiveIndexChange - Callback when the active index should change.
 * @param options - Configuration for orientation and wrapping.
 */
export function useRovingTabIndex<T extends HTMLElement>(
  items: string[],
  activeIndex: number,
  onActiveIndexChange: (index: number) => void,
  options?: RovingTabIndexOptions,
): RovingTabIndexReturn<T> {
  const orientation = options?.orientation ?? "both";
  const wrap = options?.wrap ?? true;
  const itemRefs = useRef<Map<number, T>>(new Map());

  const refs = useCallback(
    (index: number) => (el: T | null) => {
      if (el) {
        itemRefs.current.set(index, el);
      } else {
        itemRefs.current.delete(index);
      }
    },
    [],
  );

  const focusIndex = useCallback(
    (index: number) => {
      onActiveIndexChange(index);
      const el = itemRefs.current.get(index);
      if (el) {
        el.focus();
      }
    },
    [onActiveIndexChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const count = items.length;
      if (count === 0) return;

      const isVerticalKey = e.key === "ArrowDown" || e.key === "ArrowUp";
      const isHorizontalKey = e.key === "ArrowLeft" || e.key === "ArrowRight";

      // Filter based on orientation
      if (orientation === "vertical" && isHorizontalKey) return;
      if (orientation === "horizontal" && isVerticalKey) return;

      let nextIndex = activeIndex;

      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight": {
          if (wrap) {
            nextIndex = (activeIndex + 1) % count;
          } else {
            nextIndex = Math.min(activeIndex + 1, count - 1);
          }
          break;
        }
        case "ArrowUp":
        case "ArrowLeft": {
          if (wrap) {
            nextIndex = (activeIndex - 1 + count) % count;
          } else {
            nextIndex = Math.max(activeIndex - 1, 0);
          }
          break;
        }
        case "Home": {
          nextIndex = 0;
          break;
        }
        case "End": {
          nextIndex = count - 1;
          break;
        }
        default:
          // Do NOT prevent default for Space, Enter, or any other key
          return;
      }

      e.preventDefault();
      focusIndex(nextIndex);
    },
    [items.length, activeIndex, orientation, wrap, focusIndex],
  );

  const getTabIndex = useCallback(
    (index: number): 0 | -1 => (index === activeIndex ? 0 : -1),
    [activeIndex],
  );

  return { refs, handleKeyDown, getTabIndex };
}
