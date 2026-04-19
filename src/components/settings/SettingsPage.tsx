"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { getSettings, updateSettings } from "@/lib/tauri";
import type { AppSettings } from "@/lib/types";

/** Default silence threshold in dB. */
const DEFAULT_SILENCE_THRESHOLD_DB = -40;

/** Default global hotkey for recording. */
const RECORD_SHORTCUT = "Cmd+Shift+R";

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [silenceThreshold, setSilenceThreshold] = useState(
    DEFAULT_SILENCE_THRESHOLD_DB,
  );
  const [loading, setLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        setSilenceThreshold(s.silenceThresholdDb ?? DEFAULT_SILENCE_THRESHOLD_DB);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Save silence threshold on change (debounced by the slider's onPointerUp)
  const handleThresholdChange = useCallback(
    (value: number) => {
      setSilenceThreshold(value);
    },
    [],
  );

  const handleThresholdCommit = useCallback(
    (value: number) => {
      updateSettings({ silenceThresholdDb: value })
        .then((updated) => setSettings(updated))
        .catch(() => {
          // Silently fail -- the slider still shows the local value
        });
    },
    [],
  );

  if (loading) {
    return (
      <div className="px-12 pt-6">
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="px-12 pt-6">
      {/* Header with back navigation */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[#E8863A] focus:ring-offset-2 focus:ring-offset-[#151921] rounded"
          aria-label="Back to Library"
        >
          <ArrowLeft size={16} />
          <span>Library</span>
        </button>
      </div>

      <h1 className="mb-6 text-xl font-semibold text-foreground">Settings</h1>

      {/* Storage settings card */}
      <div
        className="mb-4 rounded-xl border p-5"
        style={{
          background: "#1D2129",
          borderColor: "#323844",
        }}
      >
        <h2 className="mb-4 text-sm font-semibold text-foreground">Storage</h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Watch Folder
            </label>
            <p className="text-sm text-foreground">
              {settings?.watchFolder ?? "~/wallflower"}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Storage Directory
            </label>
            <p className="text-sm text-foreground">
              {settings?.storageDir ?? ""}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Duplicate Handling
            </label>
            <p className="text-sm text-foreground">
              {settings?.duplicateHandling ?? "skip"}
            </p>
          </div>
        </div>
      </div>

      {/* Recording settings card */}
      <div
        className="mb-4 rounded-xl border p-5"
        style={{
          background: "#1D2129",
          borderColor: "#323844",
        }}
      >
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          Recording
        </h2>

        <div className="space-y-5">
          {/* Silence Threshold */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="silence-threshold"
                className="text-sm text-foreground"
              >
                Silence Threshold
              </label>
              <span
                className="text-sm text-foreground"
                style={{ fontFeatureSettings: '"tnum"' }}
              >
                {silenceThreshold}dB
              </span>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              Mark sections below this volume as silent. Quieter values catch
              more silence.
            </p>
            <input
              id="silence-threshold"
              type="range"
              min={-60}
              max={-20}
              step={1}
              value={silenceThreshold}
              onChange={(e) =>
                handleThresholdChange(Number(e.target.value))
              }
              onPointerUp={() => handleThresholdCommit(silenceThreshold)}
              onKeyUp={() => handleThresholdCommit(silenceThreshold)}
              className="silence-threshold-slider"
              style={{ width: "200px" }}
            />
          </div>

          {/* Record Shortcut */}
          <div>
            <label className="mb-1 block text-sm text-foreground">
              Record Shortcut
            </label>
            <p className="mb-2 text-xs text-muted-foreground">
              Start and stop recording from any app. Default: Cmd+Shift+R
            </p>
            <span
              className="inline-block rounded-md border px-3 py-1 text-sm"
              style={{
                background: "#272C36",
                borderColor: "#323844",
                fontSize: "14px",
              }}
            >
              {RECORD_SHORTCUT}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              Shortcut customization coming in a future update.
            </p>
          </div>
        </div>
      </div>

      {/* Slider styling */}
      <style jsx global>{`
        .silence-threshold-slider {
          -webkit-appearance: none;
          appearance: none;
          background: #323844;
          height: 4px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .silence-threshold-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #e8863a;
          border: 2px solid white;
          cursor: pointer;
        }
        .silence-threshold-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #e8863a;
          border: 2px solid white;
          cursor: pointer;
        }
        .silence-threshold-slider::-webkit-slider-runnable-track {
          background: #323844;
          height: 4px;
          border-radius: 2px;
        }
        .silence-threshold-slider::-moz-range-track {
          background: #323844;
          height: 4px;
          border-radius: 2px;
        }
        .silence-threshold-slider:focus {
          outline: 2px solid #e8863a;
          outline-offset: 4px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
