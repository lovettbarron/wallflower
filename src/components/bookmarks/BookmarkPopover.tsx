"use client";

import { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { BookmarkColor } from "@/lib/types";
import { BOOKMARK_COLORS } from "@/lib/types";

const ALL_COLORS: BookmarkColor[] = ["coral", "amber", "lime", "teal", "sky", "violet", "rose", "slate"];

interface BookmarkPopoverProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, color: BookmarkColor, notes: string) => void;
  initialName?: string;
  initialColor?: BookmarkColor;
  initialNotes?: string;
  anchorEl?: HTMLElement | null;
  mode: "create" | "edit";
  children?: React.ReactNode;
}

export function BookmarkPopover({
  open,
  onClose,
  onSave,
  initialName = "",
  initialColor = "coral",
  initialNotes = "",
  mode,
  children,
}: BookmarkPopoverProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<BookmarkColor>(initialColor);
  const [notes, setNotes] = useState(initialNotes);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setColor(initialColor);
      setNotes(initialNotes);
      // Auto-focus and select the name input after opening
      setTimeout(() => {
        if (nameRef.current) {
          nameRef.current.focus();
          nameRef.current.select();
        }
      }, 50);
    }
  }, [open, initialName, initialColor, initialNotes]);

  const handleSave = () => {
    onSave(name || "Untitled Bookmark", color, notes);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <PopoverTrigger render={children ? undefined : <button className="hidden" />}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-4"
        style={{ background: "#1D2129" }}
        side="bottom"
        sideOffset={8}
      >
        <div className="flex flex-col gap-3" onKeyDown={handleKeyDown}>
          {/* Name input */}
          <Input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bookmark name"
            className="h-8 text-sm"
          />

          {/* Color palette */}
          <div className="flex items-center gap-2">
            {ALL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="flex-shrink-0 rounded-full transition-all"
                style={{
                  width: 16,
                  height: 16,
                  backgroundColor: BOOKMARK_COLORS[c].solid,
                  boxShadow: color === c ? `0 0 0 2px #1D2129, 0 0 0 4px ${BOOKMARK_COLORS[c].solid}` : "none",
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>

          {/* Notes textarea */}
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes..."
            rows={2}
            className="resize-none text-sm"
          />

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              {mode === "create" ? "Discard" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              style={{ backgroundColor: "#E8863A", color: "white" }}
              className="hover:opacity-90"
            >
              {mode === "create" ? "Save Bookmark" : "Update Bookmark"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
