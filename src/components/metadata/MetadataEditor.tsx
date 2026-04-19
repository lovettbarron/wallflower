"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus } from "lucide-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TagChip } from "./TagChip";
import { AutocompletePopover } from "./AutocompletePopover";
import { PhotoGallery } from "./PhotoGallery";
import type { JamDetail } from "@/lib/types";
import {
  addTag,
  removeTag,
  listAllTags,
  addCollaborator,
  removeCollaborator,
  listAllCollaborators,
  addInstrument,
  removeInstrument,
  listAllInstruments,
  updateJamMetadata,
} from "@/lib/tauri";

// ---- Save indicator ----

function SavedIndicator({ visible }: { visible: boolean }) {
  return (
    <span
      className={`text-xs text-muted-foreground transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      Saved
    </span>
  );
}

// ---- Debounced text field ----

function useDebouncedSave(
  jamId: string,
  field: "location" | "notes" | "patchNotes",
  initialValue: string,
  onSaved: () => void
) {
  const [value, setValue] = useState(initialValue);
  const [showSaved, setShowSaved] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync with prop changes (e.g., after query invalidation)
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const save = useCallback(
    async (val: string) => {
      try {
        await updateJamMetadata(
          jamId,
          field === "location" ? val : null,
          field === "notes" ? val : null,
          field === "patchNotes" ? val : null
        );
        setShowSaved(true);
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = setTimeout(() => setShowSaved(false), 2000);
        onSaved();
      } catch (err) {
        toast.error("Could not save changes. Check your connection and try again.");
      }
    },
    [jamId, field, onSaved]
  );

  const onChange = useCallback(
    (val: string) => {
      setValue(val);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => save(val), 1000);
    },
    [save]
  );

  const onBlur = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    save(value);
  }, [save, value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  return { value, onChange, onBlur, showSaved };
}

// ---- Chip section (tags / collaborators / gear) ----

interface ChipSectionProps {
  label: string;
  items: { id: string; label: string }[];
  variant: "tag" | "collaborator" | "instrument";
  placeholder: string;
  suggestionsQueryKey: string;
  fetchSuggestions: () => Promise<string[]>;
  onAdd: (value: string) => void;
  onRemove: (id: string) => void;
}

function ChipSection({
  label,
  items,
  variant,
  placeholder,
  suggestionsQueryKey,
  fetchSuggestions,
  onAdd,
  onRemove,
}: ChipSectionProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data: suggestions = [] } = useQuery({
    queryKey: [suggestionsQueryKey],
    queryFn: fetchSuggestions,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-1">
        {items.map((item) => (
          <TagChip
            key={item.id}
            label={item.label}
            variant={variant}
            onRemove={() => onRemove(item.id)}
          />
        ))}
        <AutocompletePopover
          suggestions={suggestions}
          onSelect={onAdd}
          onClose={() => setPopoverOpen(false)}
          placeholder={placeholder}
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          triggerClassName="inline-flex h-6 items-center justify-center rounded-xl border border-primary px-2 text-primary hover:bg-accent/50 transition-colors"
          triggerContent={<Plus className="size-3" />}
        />
      </div>
    </div>
  );
}

// ---- Main MetadataEditor ----

export interface MetadataEditorProps {
  jam: JamDetail;
  onUpdate: () => void;
}

export function MetadataEditor({ jam, onUpdate }: MetadataEditorProps) {
  const queryClient = useQueryClient();

  const invalidateJam = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["jam", jam.id] });
    onUpdate();
  }, [queryClient, jam.id, onUpdate]);

  // ---- Tag mutations ----
  const addTagMutation = useMutation({
    mutationFn: (tag: string) => addTag(jam.id, tag),
    onSuccess: () => {
      invalidateJam();
      queryClient.invalidateQueries({ queryKey: ["allTags"] });
    },
    onError: () => toast.error("Could not save changes. Check your connection and try again."),
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) => removeTag(tagId),
    onSuccess: invalidateJam,
    onError: () => toast.error("Could not save changes. Check your connection and try again."),
  });

  // ---- Collaborator mutations ----
  const addCollaboratorMutation = useMutation({
    mutationFn: (name: string) => addCollaborator(jam.id, name),
    onSuccess: () => {
      invalidateJam();
      queryClient.invalidateQueries({ queryKey: ["allCollaborators"] });
    },
    onError: () => toast.error("Could not save changes. Check your connection and try again."),
  });

  const removeCollaboratorMutation = useMutation({
    mutationFn: (id: string) => removeCollaborator(id),
    onSuccess: invalidateJam,
    onError: () => toast.error("Could not save changes. Check your connection and try again."),
  });

  // ---- Instrument mutations ----
  const addInstrumentMutation = useMutation({
    mutationFn: (name: string) => addInstrument(jam.id, name),
    onSuccess: () => {
      invalidateJam();
      queryClient.invalidateQueries({ queryKey: ["allInstruments"] });
    },
    onError: () => toast.error("Could not save changes. Check your connection and try again."),
  });

  const removeInstrumentMutation = useMutation({
    mutationFn: (id: string) => removeInstrument(id),
    onSuccess: invalidateJam,
    onError: () => toast.error("Could not save changes. Check your connection and try again."),
  });

  // ---- Debounced text fields ----
  const location = useDebouncedSave(
    jam.id,
    "location",
    jam.location ?? "",
    invalidateJam
  );
  const notes = useDebouncedSave(
    jam.id,
    "notes",
    jam.notes ?? "",
    invalidateJam
  );
  const patchNotes = useDebouncedSave(
    jam.id,
    "patchNotes",
    jam.patchNotes ?? "",
    invalidateJam
  );

  // ---- Format date ----
  const recordedDate = jam.createdAt
    ? new Date(jam.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : jam.importedAt
      ? new Date(jam.importedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "Unknown";

  return (
    <div className="space-y-4">
      {/* Tags */}
      <ChipSection
        label="Tags"
        items={jam.tags.map((t) => ({ id: t.id, label: t.tag }))}
        variant="tag"
        placeholder="Add a tag..."
        suggestionsQueryKey="allTags"
        fetchSuggestions={listAllTags}
        onAdd={(val) => addTagMutation.mutate(val)}
        onRemove={(id) => removeTagMutation.mutate(id)}
      />

      {/* Collaborators */}
      <ChipSection
        label="Collaborators"
        items={jam.collaborators.map((c) => ({ id: c.id, label: c.name }))}
        variant="collaborator"
        placeholder="Add a collaborator..."
        suggestionsQueryKey="allCollaborators"
        fetchSuggestions={listAllCollaborators}
        onAdd={(val) => addCollaboratorMutation.mutate(val)}
        onRemove={(id) => removeCollaboratorMutation.mutate(id)}
      />

      {/* Gear */}
      <ChipSection
        label="Gear"
        items={jam.instruments.map((i) => ({ id: i.id, label: i.name }))}
        variant="instrument"
        placeholder="Add gear..."
        suggestionsQueryKey="allInstruments"
        fetchSuggestions={listAllInstruments}
        onAdd={(val) => addInstrumentMutation.mutate(val)}
        onRemove={(id) => removeInstrumentMutation.mutate(id)}
      />

      {/* Location */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Location</span>
          <SavedIndicator visible={location.showSaved} />
        </div>
        <Input
          value={location.value}
          onChange={(e) => location.onChange(e.target.value)}
          onBlur={location.onBlur}
          placeholder="Where was this recorded?"
          className="bg-secondary"
        />
      </div>

      {/* Recorded date */}
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Recorded</span>
        <p className="text-sm text-foreground">{recordedDate}</p>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Notes</span>
          <SavedIndicator visible={notes.showSaved} />
        </div>
        <Textarea
          value={notes.value}
          onChange={(e) => notes.onChange(e.target.value)}
          onBlur={notes.onBlur}
          placeholder="Session notes..."
          rows={4}
          className="bg-secondary"
        />
      </div>

      {/* Patch Notes */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Patch Notes</span>
          <SavedIndicator visible={patchNotes.showSaved} />
        </div>
        <Textarea
          value={patchNotes.value}
          onChange={(e) => patchNotes.onChange(e.target.value)}
          onBlur={patchNotes.onBlur}
          placeholder="Describe your patch settings, signal chain, synth presets..."
          rows={4}
          className="bg-secondary"
        />
      </div>

      {/* Photos */}
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Photos</span>
        <PhotoGallery
          photos={jam.photos}
          jamId={jam.id}
          jamName={jam.originalFilename || jam.filename}
          onUpdate={invalidateJam}
        />
      </div>
    </div>
  );
}
