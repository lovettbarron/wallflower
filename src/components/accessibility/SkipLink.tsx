"use client";

/**
 * Skip-to-main-content link for keyboard navigation.
 * Visually hidden by default, becomes visible on Tab focus.
 * Must be the first focusable element in the document.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="fixed left-4 top-4 z-50 -translate-y-full rounded-lg bg-[#E8863A] px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-white"
    >
      Skip to main content
    </a>
  );
}
