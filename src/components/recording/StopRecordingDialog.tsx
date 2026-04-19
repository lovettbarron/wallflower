"use client";

import { useRecordingStore } from "@/lib/stores/recording";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function formatDurationWords(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  }
  // Show seconds only if under 1 hour
  if (hours === 0 && seconds > 0) {
    parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  }
  // Edge case: 0 seconds
  if (parts.length === 0) {
    return "0 seconds";
  }

  return parts.join(", ");
}

export function StopRecordingDialog() {
  const showStopDialog = useRecordingStore((s) => s.showStopDialog);
  const cancelStop = useRecordingStore((s) => s.cancelStop);
  const confirmStop = useRecordingStore((s) => s.confirmStop);
  const elapsedSeconds = useRecordingStore((s) => s.elapsedSeconds);

  return (
    <Dialog
      open={showStopDialog}
      onOpenChange={(open) => {
        if (!open) cancelStop();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        style={{
          backgroundColor: "#1D2129",
          borderRadius: "12px",
          border: "1px solid #323844",
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="text-foreground"
            style={{ fontSize: "20px", fontWeight: 600 }}
          >
            Stop Recording?
          </DialogTitle>
          <DialogDescription
            className="text-muted-foreground"
            style={{ fontSize: "14px", fontWeight: 400 }}
          >
            {formatDurationWords(elapsedSeconds)} captured.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-end gap-3 pt-4">
          {/* Keep Recording: safe default, auto-focused per D-12 */}
          <button
            type="button"
            onClick={cancelStop}
            autoFocus
            className="text-sm text-foreground transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
            style={{
              background: "#272C36",
              borderRadius: "8px",
              paddingLeft: "16px",
              paddingRight: "16px",
              paddingTop: "8px",
              paddingBottom: "8px",
            }}
          >
            Keep Recording
          </button>

          {/* Stop Recording: destructive action */}
          <button
            type="button"
            onClick={confirmStop}
            className="text-sm text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#E8863A]"
            style={{
              background: "#D93636",
              borderRadius: "8px",
              paddingLeft: "16px",
              paddingRight: "16px",
              paddingTop: "8px",
              paddingBottom: "8px",
            }}
          >
            Stop Recording
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
