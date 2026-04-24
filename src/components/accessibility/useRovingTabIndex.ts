"use client";

import { useCallback, useRef, useState, type KeyboardEvent, type RefCallback } from "react";

interface RovingTabIndexOptions {
  orientation?: "horizontal" | "vertical";
  loop?: boolean;
  onSelect?: (id: string) => void;
}

interface RovingItemProps {
  ref: RefCallback<HTMLElement>;
  tabIndex: number;
  onKeyDown: (e: KeyboardEvent) => void;
  onFocus: () => void;
}

/**
 * Hook for roving tabindex pattern.
 * Only one item in the group is tabbable (tabIndex=0); the rest are tabIndex=-1.
 * Arrow keys move focus between items in the group.
 */
export function useRovingTabIndex(
  ids: string[],
  activeId: string | null,
  options: RovingTabIndexOptions = {},
) {
  const { orientation = "vertical", loop = true, onSelect } = options;
  const [focusedId, setFocusedId] = useState<string | null>(activeId);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

  const getItemProps = useCallback(
    (id: string): RovingItemProps => {
      const isFocused = focusedId === id;
      // If nothing is focused, make the first item tabbable
      const isFirstAndNoneFocused = !focusedId && ids[0] === id;

      return {
        ref: (el: HTMLElement | null) => {
          if (el) {
            itemRefs.current.set(id, el);
          } else {
            itemRefs.current.delete(id);
          }
        },
        tabIndex: isFocused || isFirstAndNoneFocused ? 0 : -1,
        onKeyDown: (e: KeyboardEvent) => {
          const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
          const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";

          const currentIndex = ids.indexOf(id);
          if (currentIndex === -1) return;

          let nextIndex: number | null = null;

          if (e.key === nextKey) {
            e.preventDefault();
            nextIndex = currentIndex + 1;
            if (nextIndex >= ids.length) {
              nextIndex = loop ? 0 : null;
            }
          } else if (e.key === prevKey) {
            e.preventDefault();
            nextIndex = currentIndex - 1;
            if (nextIndex < 0) {
              nextIndex = loop ? ids.length - 1 : null;
            }
          } else if (e.key === "Home") {
            e.preventDefault();
            nextIndex = 0;
          } else if (e.key === "End") {
            e.preventDefault();
            nextIndex = ids.length - 1;
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect?.(id);
            return;
          }

          if (nextIndex !== null && nextIndex >= 0 && nextIndex < ids.length) {
            const nextId = ids[nextIndex];
            setFocusedId(nextId);
            const el = itemRefs.current.get(nextId);
            el?.focus();
          }
        },
        onFocus: () => {
          setFocusedId(id);
        },
      };
    },
    [ids, focusedId, orientation, loop, onSelect],
  );

  return { getItemProps, focusedId, setFocusedId };
}
