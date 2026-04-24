"use client";

import { useState, useEffect } from "react";
import { Circle } from "lucide-react";
import { Timeline } from "@/components/library/Timeline";
import { JamDetail } from "@/components/library/JamDetail";
import { DeviceImportDialog } from "@/components/device-import-dialog";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { FirstLaunchDialog } from "@/components/settings/FirstLaunchDialog";
import { useLibraryStore } from "@/lib/stores/library";
import { RecordingView } from "@/components/recording/RecordingView";
import { useRecordingStore } from "@/lib/stores/recording";
import { queuePendingAnalysis, getAutoLaunchDialogShown } from "@/lib/tauri";

type ActiveTab = "library" | "explore" | "settings";

const TAB_CONFIG: { key: ActiveTab; label: string }[] = [
  { key: "library", label: "Library" },
  { key: "explore", label: "Explore" },
  { key: "settings", label: "Settings" },
];

export default function Home() {
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("library");
  const [showFirstLaunchDialog, setShowFirstLaunchDialog] = useState(false);
  const { selectedJamId, setSelectedJam } = useLibraryStore();
  const isRecording = useRecordingStore((s) => s.isRecording);
  const startRec = useRecordingStore((s) => s.startRec);

  // Queue pending analysis on mount so newly imported jams get analyzed
  useEffect(() => {
    queuePendingAnalysis().catch(() => {
      // Silently ignore -- analysis may not be available
    });
  }, []);

  // Check if first-launch auto-launch dialog should be shown
  useEffect(() => {
    getAutoLaunchDialogShown()
      .then((shown) => {
        if (!shown) setShowFirstLaunchDialog(true);
      })
      .catch(() => {
        // Silently ignore
      });
  }, []);

  // When recording is active, lock navigation and show RecordingView
  if (isRecording) {
    return (
      <main id="main-content" role="main" aria-label="Recording" className="flex min-h-screen flex-col">
        <RecordingView />
      </main>
    );
  }

  const handleImportClick = () => {
    setShowDeviceDialog(true);
  };

  return (
    <main id="main-content" role="main" aria-label="Main content" className="flex min-h-screen flex-col">
      {/* Tab bar -- persistent across all views (per D-04) */}
      <nav role="navigation" aria-label="Wallflower navigation" className="flex items-center justify-between bg-[#1D2129] px-8">
        <div role="tablist" className="flex items-center gap-1">
          {TAB_CONFIG.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => {
                setActiveTab(key);
                // Clear jam detail selection when switching tabs
                if (key !== "library") setSelectedJam(null);
              }}
              className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === key
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {activeTab === key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E8863A]" />
              )}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 py-2">
          <button
            type="button"
            onClick={() => startRec()}
            className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#E53E3E] focus:ring-offset-2 focus:ring-offset-[#1D2129]"
            style={{ background: "#E53E3E", color: "#fff" }}
            aria-label="Start Recording"
          >
            <Circle size={10} fill="currentColor" stroke="currentColor" />
            Record
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#E8863A] focus:ring-offset-2 focus:ring-offset-[#1D2129]"
            style={{ background: "#E8863A" }}
          >
            Import Files
          </button>
        </div>
      </nav>

      {/* Tab content */}
      <div className="flex flex-1 flex-col">
        {activeTab === "library" && (
          <>
            {selectedJamId ? (
              <div className="px-12 pt-6">
                <JamDetail
                  jamId={selectedJamId}
                  onBack={() => setSelectedJam(null)}
                />
              </div>
            ) : (
              <div className="px-12 pt-6">
                <Timeline onImportClick={handleImportClick} />
              </div>
            )}
          </>
        )}

        {activeTab === "explore" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-12 py-24">
            <h2 className="text-xl font-semibold text-foreground">
              Sample Browser
            </h2>
            <p className="max-w-md text-center text-sm text-muted-foreground">
              Search and filter bookmarks, loops, and sections extracted from your recordings. Coming soon.
            </p>
          </div>
        )}

        {activeTab === "settings" && (
          <SettingsPage onBack={() => setActiveTab("library")} />
        )}
      </div>

      {/* Device import dialog */}
      {showDeviceDialog && (
        <DeviceImportDialog onClose={() => setShowDeviceDialog(false)} />
      )}

      {/* First-launch auto-launch dialog */}
      <FirstLaunchDialog
        open={showFirstLaunchDialog}
        onClose={() => setShowFirstLaunchDialog(false)}
      />
    </main>
  );
}
