"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const HighContrastContext = createContext(false);

/**
 * React context provider that detects macOS "Increase Contrast" setting
 * via the `prefers-contrast: more` media query. Provides `useHighContrast()`
 * hook for components that need programmatic contrast awareness.
 *
 * Most visual adjustments should use the CSS `@media (prefers-contrast: more)`
 * block in globals.css. This provider is for cases where JS logic differs
 * based on contrast mode (e.g., force-graph node rendering).
 */
export function HighContrastProvider({ children }: { children: ReactNode }) {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-contrast: more)");
    setIsHighContrast(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsHighContrast(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <HighContrastContext.Provider value={isHighContrast}>
      {children}
    </HighContrastContext.Provider>
  );
}

/** Returns true when the user has macOS "Increase Contrast" enabled. */
export function useHighContrast(): boolean {
  return useContext(HighContrastContext);
}
