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
        const { listen } = await import("@tauri-apps/api/event");

        // Request notification permission on first launch
        try {
          const {
            isPermissionGranted,
            requestPermission,
          } = await import("@tauri-apps/plugin-notification");
          const granted = await isPermissionGranted();
          if (!granted) {
            await requestPermission();
          }
        } catch {
          // Notification plugin not available
        }

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
