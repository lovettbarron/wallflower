"use client";

import { useState, useEffect, useRef } from "react";
import { X, ImagePlus } from "lucide-react";
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
  const photosRef = useRef(photos);
  photosRef.current = photos;

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
            setIsDragOver(false);
            const paths = event.payload.paths;
            const imageExtensions = [
              ".jpg",
              ".jpeg",
              ".png",
              ".gif",
              ".webp",
              ".heic",
            ];
            const existingPaths = new Set(
              photosRef.current.map((p) => p.filePath),
            );

            let attachedCount = 0;
            for (const path of paths) {
              const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
              if (imageExtensions.includes(ext) && !existingPaths.has(path)) {
                attachPhotoMutation.mutate({ jamId, filePath: path });
                attachedCount++;
              }
            }

            if (attachedCount === 0 && paths.length > 0) {
              toast.error("No supported image files found. Try .jpg, .png, .webp, or .heic.", {
                duration: 4000,
              });
            }
          }
          if (event.payload.type === "over") {
            setIsDragOver(true);
          }
          if (event.payload.type === "leave") {
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
  }, [jamId]);

  // ---- Photo source URL ----
  function getPhotoSrc(photo: JamPhoto): string {
    try {
      const { convertFileSrc } = require("@tauri-apps/api/core");
      return convertFileSrc(photo.thumbnailPath || photo.filePath);
    } catch {
      return photo.thumbnailPath || photo.filePath;
    }
  }

  return (
    <div className="relative">
      {/* Full-section drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#E8863A] bg-[#E8863A]/10 backdrop-blur-sm">
          <ImagePlus className="size-10 text-[#E8863A]" strokeWidth={1.5} />
          <span className="text-sm font-medium text-[#E8863A]">
            Drop to attach photos
          </span>
        </div>
      )}

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

        {/* Static drop zone hint (when not dragging) */}
        <div
          className={cn(
            "flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition-colors",
            "border-border hover:border-[#E8863A]/50 hover:bg-[#E8863A]/5",
            photos.length === 0 && "col-span-3 min-h-28",
          )}
        >
          <ImagePlus className="size-5 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-xs text-muted-foreground">
            Drop photos here
          </span>
        </div>
      </div>
    </div>
  );
}
