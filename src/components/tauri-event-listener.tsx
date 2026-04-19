"use client";

import { useEffect } from "react";
import { toast } from "sonner";

interface PhotoAutoAttachedPayload {
  jamId: string;
  jamName: string;
}

/**
 * Global Tauri event listener component.
 * Listens for backend events and shows in-app toasts.
 */
export function TauriEventListener() {
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    async function setupListeners() {
      try {
        // Dynamic import to avoid SSR issues with Tauri APIs
        const { listen } = await import("@tauri-apps/api/event");

        const unlistenFn = await listen<PhotoAutoAttachedPayload>(
          "photo-auto-attached",
          (event) => {
            const { jamName } = event.payload;
            toast("Patch photo auto-attached to " + jamName, {
              duration: 4000,
            });
          }
        );

        unlisten = unlistenFn;
      } catch {
        // Not running in Tauri context (e.g., during SSR or dev in browser)
      }
    }

    setupListeners();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  return null;
}
