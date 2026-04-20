"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkContextMenu } from "@/components/bookmarks/BookmarkContextMenu";
import { BookmarkPopover } from "@/components/bookmarks/BookmarkPopover";
import { useBookmarkStore } from "@/lib/stores/bookmarks";
import type { BookmarkRecord, BookmarkColor } from "@/lib/types";
import { BOOKMARK_COLORS } from "@/lib/types";

interface BookmarkListProps {
  jamId: string;
  onBookmarkClick: (bookmark: BookmarkRecord) => void;
  onExportAudio: (bookmarkId: string) => void;
  onExportStems: (bookmarkId: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function BookmarkList({
  jamId,
  onBookmarkClick,
  onExportAudio,
  onExportStems,
}: BookmarkListProps) {
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const editBookmark = useBookmarkStore((s) => s.editBookmark);
  const removeBookmark = useBookmarkStore((s) => s.removeBookmark);
  const [editingBookmark, setEditingBookmark] = useState<BookmarkRecord | null>(null);

  const handleEditSave = async (name: string, color: BookmarkColor, notes: string) => {
    if (!editingBookmark) return;
    await editBookmark(editingBookmark.id, { name, color, notes });
    setEditingBookmark(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Heading */}
      <div className="flex items-center gap-2">
        <h3 className="text-[20px] font-semibold text-foreground">Bookmarks</h3>
        {bookmarks.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {bookmarks.length}
          </Badge>
        )}
      </div>

      {/* Empty state */}
      {bookmarks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-[28px] font-semibold text-foreground">
            No bookmarks yet
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Drag across the waveform to select a section you want to export.
          </p>
        </div>
      )}

      {/* Bookmark rows */}
      {bookmarks.map((bookmark) => {
        const colorKey = bookmark.color as BookmarkColor;
        const colorInfo = BOOKMARK_COLORS[colorKey] || BOOKMARK_COLORS.coral;

        return (
          <BookmarkContextMenu
            key={bookmark.id}
            bookmark={bookmark}
            onExportAudio={() => onExportAudio(bookmark.id)}
            onExportStems={() => onExportStems(bookmark.id)}
            onEdit={() => setEditingBookmark(bookmark)}
            onDelete={() => removeBookmark(bookmark.id)}
          >
            <div
              className="flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 transition-colors hover:bg-muted/50"
              onClick={() => onBookmarkClick(bookmark)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onBookmarkClick(bookmark);
                }
              }}
            >
              {/* Color dot */}
              <span
                className="flex-shrink-0 rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: colorInfo.solid,
                }}
              />

              {/* Name */}
              <span className="min-w-0 max-w-[200px] truncate text-sm text-foreground">
                {bookmark.name}
              </span>

              {/* Time range */}
              <span className="flex-shrink-0 text-xs text-muted-foreground">
                {formatTime(bookmark.startSeconds)}-{formatTime(bookmark.endSeconds)}
              </span>

              {/* Spacer */}
              <span className="flex-1" />

              {/* Options button */}
              <Button
                variant="ghost"
                size="icon-xs"
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                aria-label={`Bookmark options for ${bookmark.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  // The context menu handles right-click; this button is for accessibility
                }}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </div>
          </BookmarkContextMenu>
        );
      })}

      {/* Edit popover */}
      {editingBookmark && (
        <BookmarkPopover
          open={!!editingBookmark}
          onClose={() => setEditingBookmark(null)}
          onSave={handleEditSave}
          initialName={editingBookmark.name}
          initialColor={editingBookmark.color as BookmarkColor}
          initialNotes={editingBookmark.notes || ""}
          mode="edit"
        />
      )}
    </div>
  );
}
