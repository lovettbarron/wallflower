"use client";

import { useState } from "react";
import { Timeline } from "@/components/library/Timeline";
import { JamDetail } from "@/components/library/JamDetail";
import { DeviceImportDialog } from "@/components/device-import-dialog";
import { useLibraryStore } from "@/lib/stores/library";
import { RecordingView } from "@/components/recording/RecordingView";
import { useRecordingStore } from "@/lib/stores/recording";

export default function Home() {
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const { selectedJamId, setSelectedJam } = useLibraryStore();
  const isRecording = useRecordingStore((s) => s.isRecording);

  // When recording is active, lock navigation and show RecordingView
  if (isRecording) {
    return (
      <main className="flex min-h-screen flex-col">
        <RecordingView />
      </main>
    );
  }

  const handleImportClick = () => {
    setShowDeviceDialog(true);
  };

  // Jam detail view
  if (selectedJamId) {
    return (
      <main className="px-12 pt-6">
        <JamDetail
          jamId={selectedJamId}
          onBack={() => setSelectedJam(null)}
        />
      </main>
    );
  }

  // Library timeline view
  return (
    <main className="px-12 pt-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Library</h1>
        <button
          type="button"
          onClick={handleImportClick}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#E8863A] focus:ring-offset-2 focus:ring-offset-[#151921]"
          style={{ background: "#E8863A" }}
        >
          Import Files
        </button>
      </div>

      {/* Timeline browser */}
      <Timeline onImportClick={handleImportClick} />

      {/* Device import dialog */}
      {showDeviceDialog && (
        <DeviceImportDialog onClose={() => setShowDeviceDialog(false)} />
      )}
    </main>
  );
}
