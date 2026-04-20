"use client";

import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { SeparationProgressEvent } from "@/lib/types";

interface SeparationProgressProps {
  bookmarkName: string;
  progress: SeparationProgressEvent | null;
  onCancel: () => void;
  onRetry?: () => void;
}

export function SeparationProgress({
  bookmarkName,
  progress,
  onCancel,
  onRetry,
}: SeparationProgressProps) {
  const isPaused = progress?.status === "paused";
  const isFailed = progress?.status === "failed";
  const percent = progress?.percentComplete ?? 0;
  const currentChunk = progress?.currentChunk ?? 0;
  const totalChunks = progress?.totalChunks ?? 0;
  const estimatedRemaining = Math.round(progress?.estimatedSecondsRemaining ?? 0);

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-8">
      <p className="text-sm font-semibold text-foreground">
        Separating: {bookmarkName}
      </p>

      <div className="w-full max-w-md">
        <Progress value={isFailed ? 100 : percent}>
          <ProgressTrack
            className={isFailed ? "[&>[data-slot=progress-indicator]]:bg-destructive" : "[&>[data-slot=progress-indicator]]:bg-[#E8863A]"}
          >
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>
      </div>

      <div className="flex w-full max-w-md items-center justify-between text-xs text-muted-foreground">
        {isFailed ? (
          <span className="text-destructive">
            Stem separation failed. The audio may be too short or in an unsupported format. Try a different section.
          </span>
        ) : isPaused ? (
          <span>Paused -- recording in progress</span>
        ) : (
          <>
            <span>
              Chunk {currentChunk}/{totalChunks}
            </span>
            <span>~{estimatedRemaining}s remaining</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isFailed && onRetry && (
          <Button
            size="sm"
            onClick={onRetry}
            className="bg-[#E8863A] text-white hover:bg-[#E8863A]/90"
          >
            Retry
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-destructive hover:text-destructive"
        >
          Cancel Separation
        </Button>
      </div>
    </div>
  );
}
