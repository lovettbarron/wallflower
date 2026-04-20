"use client";

import { useState } from "react";
import { Download, Layers, Pencil, Trash2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { BookmarkRecord } from "@/lib/types";

interface BookmarkContextMenuProps {
  bookmark: BookmarkRecord;
  onExportAudio: () => void;
  onExportStems: () => void;
  onEdit: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export function BookmarkContextMenu({
  bookmark,
  onExportAudio,
  onExportStems,
  onEdit,
  onDelete,
  children,
}: BookmarkContextMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = () => {
    setShowDeleteDialog(false);
    onDelete();
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onExportAudio}>
            <Download className="size-3.5" />
            Export audio
          </ContextMenuItem>
          <ContextMenuItem onClick={onExportStems}>
            <Layers className="size-3.5" />
            Export stems
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit bookmark
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="size-3.5" />
            Delete bookmark
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete {bookmark.name}?</DialogTitle>
            <DialogDescription>
              This will remove the bookmark and any cached stems. Exported files will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              Keep Bookmark
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
