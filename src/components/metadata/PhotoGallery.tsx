"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { JamPhoto } from "@/lib/types";
import { attachPhoto, removePhoto } from "@/lib/tauri";

export interface PhotoGalleryProps {
  photos: JamPhoto[];
  jamId: string;
  jamName: string;
  onUpdate: () => void;
}

export function PhotoGallery({
  photos,
  jamId,
  jamName,
  onUpdate,
}: PhotoGalleryProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // ---- Mutations ----
  const attachPhotoMutation = useMutation({
    mutationFn: ({ jamId, filePath }: { jamId: string; filePath: string }) =>
      attachPhoto(jamId, filePath),
    onSuccess: () => {
      toast.success(`Photo attached to ${jamName}`, { duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ["jam", jamId] });
      onUpdate();
    },
    onError: (error: Error) => {
      toast.error(`Could not attach photo: ${error.message}`, {
        duration: 6000,
        dismissible: true,
      });
    },
  });

  const removePhotoMutation = useMutation({
    mutationFn: (id: string) => removePhoto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jam", jamId] });
      onUpdate();
      setRemovingPhotoId(null);
    },
    onError: () => {
      toast.error("Could not remove photo. Check your connection and try again.");
      setRemovingPhotoId(null);
    },
  });

  // ---- Drag-drop via Tauri ----
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    async function setupDragDrop() {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const fn = await getCurrentWebview().onDragDropEvent((event) => {
          if (!mounted) return;

          if (event.payload.type === "drop") {
            const paths = event.payload.paths;
            const imageExtensions = [
              ".jpg",
              ".jpeg",
              ".png",
              ".gif",
              ".webp",
              ".heic",
            ];
            const existingPaths = new Set(photos.map((p) => p.filePath));

            for (const path of paths) {
              const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
              if (imageExtensions.includes(ext) && !existingPaths.has(path)) {
                attachPhotoMutation.mutate({ jamId, filePath: path });
              }
            }
          }
          if (event.payload.type === "over") {
            setIsDragOver(true);
          }
          if (
            event.payload.type === "leave" ||
            event.payload.type === "drop"
          ) {
            setIsDragOver(false);
          }
        });
        unlisten = fn;
      } catch {
        // Not running in Tauri (e.g., during SSR/build)
      }
    }

    setupDragDrop();

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [jamId, photos]);

  // ---- Photo source URL ----
  function getPhotoSrc(photo: JamPhoto): string {
    try {
      // In Tauri, use convertFileSrc for local file access
      const { convertFileSrc } = require("@tauri-apps/api/core");
      return convertFileSrc(photo.thumbnailPath || photo.filePath);
    } catch {
      // Fallback for SSR/build
      return photo.thumbnailPath || photo.filePath;
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="group relative aspect-square overflow-hidden rounded-lg bg-secondary"
        >
          <img
            src={getPhotoSrc(photo)}
            alt={photo.filename}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {/* Remove overlay */}
          <Dialog
            open={removingPhotoId === photo.id}
            onOpenChange={(open) => {
              if (!open) setRemovingPhotoId(null);
            }}
          >
            <DialogTrigger
              render={
                <button
                  type="button"
                  className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => setRemovingPhotoId(photo.id)}
                />
              }
            >
              <X className="size-3" />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove photo</DialogTitle>
                <DialogDescription>
                  Remove this photo from {jamName}? The original file is not
                  deleted.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => setRemovingPhotoId(null)}
                >
                  Keep
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => removePhotoMutation.mutate(photo.id)}
                  disabled={removePhotoMutation.isPending}
                >
                  Remove
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ))}

      {/* Drop zone */}
      <div
        className={cn(
          "flex min-h-20 items-center justify-center rounded-lg border-2 border-dashed transition-colors",
          isDragOver
            ? "border-primary bg-primary/10"
            : "border-border",
          photos.length === 0 && "col-span-3"
        )}
      >
        <span className="text-xs text-muted-foreground">
          {isDragOver ? "Release to attach" : "Drop photos here"}
        </span>
      </div>
    </div>
  );
}
