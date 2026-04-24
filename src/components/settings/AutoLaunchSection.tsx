"use client";

import { useState, useEffect } from "react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

export function AutoLaunchSection() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    isEnabled()
      .then((val) => {
        if (!cancelled) {
          setEnabled(val);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = async () => {
    try {
      if (enabled) {
        await disable();
        setEnabled(false);
      } else {
        await enable();
        setEnabled(true);
      }
    } catch {
      // Non-critical -- autostart may not be available in dev
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label
            htmlFor="auto-launch-toggle"
            className="block text-sm text-foreground"
          >
            Launch on login
          </label>
          <p className="text-xs text-muted-foreground">
            Start Wallflower automatically when you log in to macOS.
          </p>
        </div>
        <button
          id="auto-launch-toggle"
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={loading}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#E8863A] focus:ring-offset-2 focus:ring-offset-[#151921] disabled:cursor-not-allowed disabled:opacity-50 ${
            enabled ? "bg-[#E8863A]" : "bg-[#323844]"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
