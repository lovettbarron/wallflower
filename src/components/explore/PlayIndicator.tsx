"use client";

/**
 * Animated equalizer bars indicating active playback.
 * Three vertical bars in accent color (#E8863A) with staggered CSS keyframe
 * animations, contained within a 16x16px area.
 *
 * Bar heights per UI-SPEC:
 *  - Bar 1: 4px to 14px, 0.4s
 *  - Bar 2: 4px to 10px, 0.5s, 0.15s delay
 *  - Bar 3: 4px to 12px, 0.35s, 0.3s delay
 */
export function PlayIndicator() {
  return (
    <div
      className="flex h-4 w-4 items-end justify-center gap-[2px]"
      aria-hidden="true"
    >
      <span
        className="w-[3px] rounded-sm"
        style={{
          backgroundColor: "#E8863A",
          maxHeight: 14,
          animation: "play-bar 0.4s ease-in-out infinite alternate",
        }}
      />
      <span
        className="w-[3px] rounded-sm"
        style={{
          backgroundColor: "#E8863A",
          maxHeight: 10,
          animation: "play-bar 0.5s ease-in-out infinite alternate 0.15s",
        }}
      />
      <span
        className="w-[3px] rounded-sm"
        style={{
          backgroundColor: "#E8863A",
          maxHeight: 12,
          animation: "play-bar 0.35s ease-in-out infinite alternate 0.3s",
        }}
      />
    </div>
  );
}
