"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Separator } from "@/components/ui/separator";
import { MetadataEditor } from "@/components/metadata/MetadataEditor";
import { PhotoGallery } from "@/components/metadata/PhotoGallery";
import { getJamWithMetadata } from "@/lib/tauri";

export function JamDetailClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const queryClient = useQueryClient();

  const {
    data: jam,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["jam", id],
    queryFn: () => getJamWithMetadata(id!),
    enabled: !!id,
  });

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["jam", id] });
  };

  if (!id) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2">
        <p className="text-sm text-destructive">No jam ID provided</p>
        <Link
          href="/"
          className="text-sm text-primary underline underline-offset-4"
        >
          Back to Library
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !jam) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2">
        <p className="text-sm text-destructive">
          {error ? `Error: ${error.message}` : "Jam not found"}
        </p>
        <Link
          href="/"
          className="text-sm text-primary underline underline-offset-4"
        >
          Back to Library
        </Link>
      </div>
    );
  }

  const jamName =
    jam.originalFilename?.replace(/\.[^/.]+$/, "") || jam.filename;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Back nav */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2">
        <Link
          href="/"
          className="inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Library
        </Link>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {/* Title */}
        <h1 className="mb-4 text-lg font-medium text-foreground">{jamName}</h1>

        {/* Waveform overview placeholder (48px) */}
        <div className="mb-2 h-12 rounded-lg bg-secondary" />

        {/* Waveform detail placeholder (200px) */}
        <div className="mb-4 h-[200px] rounded-lg bg-secondary" />

        <Separator className="mb-4" />

        {/* Metadata Editor */}
        <MetadataEditor jam={jam} onUpdate={handleUpdate} />

        {/* Photos */}
        <div className="mt-4 space-y-1.5">
          <span className="text-xs text-muted-foreground">Photos</span>
          <PhotoGallery
            photos={jam.photos}
            jamId={jam.id}
            jamName={jamName}
            onUpdate={handleUpdate}
          />
        </div>
      </div>
    </div>
  );
}
