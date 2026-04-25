/** A jam record as stored in the database. */
export interface JamRecord {
  id: string;
  filename: string;
  originalFilename: string;
  contentHash: string;
  filePath: string;
  format: "wav" | "flac" | "mp3";
  durationSeconds: number | null;
  sampleRate: number | null;
  bitDepth: number | null;
  channels: number | null;
  fileSizeBytes: number;
  importedAt: string;
  createdAt: string | null;
  location: string | null;
  notes: string | null;
  patchNotes: string | null;
  peaksGenerated: boolean;
}

/** Result of an import operation for a single file. */
export interface ImportResult {
  status: "imported" | "duplicate" | "error";
  filename: string;
  jam?: JamRecord;
  error?: string;
}

/** Application settings stored in the database. */
export interface AppSettings {
  watchFolder: string;
  storageDir: string;
  duplicateHandling: "skip" | "copy";
  silenceThresholdDb: number;
  exportRoot: string;
  exportFormat: string;
  exportBitDepth: number;
  separationModel: string;
  separationMemoryLimitGb: number;
}

/** Progress information for an active import operation. */
export interface ImportProgress {
  current: number;
  total: number;
  currentFile: string;
}

/** Information about a connected USB audio recorder device. */
export interface DeviceInfo {
  name: string;
  mountPoint: string;
  files: string[];
}

/** Overall application status. */
export interface AppStatus {
  jamCount: number;
  watcherActive: boolean;
  watchFolder: string;
}

// ── Phase 2: Metadata types ──────────────────────────────

/** A tag associated with a jam. */
export interface JamTag {
  id: string;
  jamId: string;
  tag: string;
  createdAt: string;
}

/** A collaborator associated with a jam. */
export interface JamCollaborator {
  id: string;
  jamId: string;
  name: string;
  createdAt: string;
}

/** An instrument associated with a jam. */
export interface JamInstrument {
  id: string;
  jamId: string;
  name: string;
  createdAt: string;
}

/** A photo associated with a jam. */
export interface JamPhoto {
  id: string;
  jamId: string;
  filename: string;
  filePath: string;
  thumbnailPath: string | null;
  source: "drop" | "patches_folder";
  createdAt: string;
}

/** Extended jam record with all metadata attached. */
export interface JamDetail extends JamRecord {
  tags: JamTag[];
  collaborators: JamCollaborator[];
  instruments: JamInstrument[];
  photos: JamPhoto[];
}

/** Pre-computed waveform peak data for visualization. */
export interface PeakData {
  sampleRate: number;
  channels: number;
  duration: number;
  peaks: [number, number][];
  channelPeaks?: [number, number][][];
}

// ── Phase 3: Recording types ────────────────────────────

/** Current recording status from the backend. */
export interface RecordingStatus {
  state: "idle" | "recording" | "paused" | "device_disconnected" | "error";
  deviceName: string | null;
  isRecording: boolean;
}

/** Result returned when a recording starts successfully. */
export interface RecordingStartResult {
  jamId: string;
  deviceName: string;
}

/** Result returned when a recording stops. */
export interface RecordingStopResult {
  jamId: string;
  filePath: string;
  durationSeconds: number;
}

/** Information about an available audio input device. */
export interface InputDeviceInfo {
  name: string;
  channelCount: number;
  sampleRate: number;
  isDefault: boolean;
}

/** A detected silence region during recording. */
export interface SilenceRegion {
  startSeconds: number;
  endSeconds: number;
}

// -- Phase 4: Analysis types --

export interface AnalysisStatus {
  jamId: string;
  status: "pending" | "analyzing" | "complete" | "failed";
  currentStep: string | null;
  analysisProfile: string;
  errorMessage: string | null;
  retryCount: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TempoResult {
  jamId: string;
  bpm: number;
  confidence: number;
  manualOverride: boolean;
}

export interface KeyResult {
  jamId: string;
  keyName: string;
  scale: string;
  strength: number;
  manualOverride: boolean;
}

export interface SectionRecord {
  id: string;
  jamId: string;
  startSeconds: number;
  endSeconds: number;
  label: string;
  clusterId: number;
  sortOrder: number;
}

export interface LoopRecord {
  id: string;
  jamId: string;
  startSeconds: number;
  endSeconds: number;
  repeatCount: number;
  evolving: boolean;
  label: string;
  sortOrder: number;
}

export interface AnalysisResults {
  status: AnalysisStatus | null;
  tempo: TempoResult | null;
  key: KeyResult | null;
  sections: SectionRecord[];
  loops: LoopRecord[];
}

/** Filter criteria for searching/filtering jams (D-12 through D-15). */
export interface SearchFilter {
  query?: string;
  keys?: string[];
  tempoMin?: number;
  tempoMax?: number;
  tags?: string[];
  collaborators?: string[];
  instruments?: string[];
  dateFrom?: string;
  dateTo?: string;
  location?: string;
}

/** Available filter option values for populating dropdowns. */
export interface FilterOptions {
  keys: string[];
  tags: string[];
  collaborators: string[];
  instruments: string[];
  tempoMin: number;
  tempoMax: number;
}

// -- Phase 5: Bookmark and Export types --

export interface BookmarkRecord {
  id: string;
  jamId: string;
  name: string;
  startSeconds: number;
  endSeconds: number;
  color: string;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookmarkInput {
  jamId: string;
  name: string;
  startSeconds: number;
  endSeconds: number;
  color: string;
  notes?: string | null;
}

export interface UpdateBookmarkInput {
  name?: string | null;
  startSeconds?: number | null;
  endSeconds?: number | null;
  color?: string | null;
  notes?: string | null;
  sortOrder?: number | null;
}

export interface ExportRecord {
  id: string;
  bookmarkId: string;
  exportType: "audio" | "stems";
  exportPath: string;
  format: string;
  bitDepth: number;
  modelName: string | null;
  metadataPath: string | null;
  createdAt: string;
}

export interface StemInfo {
  stemName: string;
  filePath: string;
  fileSizeBytes: number;
}

export interface SeparationProgressEvent {
  bookmarkId: string;
  status: "separating" | "chunk_complete" | "completed" | "failed" | "cancelled" | "paused";
  currentChunk: number;
  totalChunks: number;
  percentComplete: number;
  estimatedSecondsRemaining: number;
}

export type BookmarkColor = "coral" | "amber" | "lime" | "teal" | "sky" | "violet" | "rose" | "slate";

export const BOOKMARK_COLORS: Record<BookmarkColor, { fill: string; border: string; solid: string }> = {
  coral:  { fill: "hsla(12, 70%, 60%, 0.3)",  border: "hsla(12, 70%, 60%, 0.8)",  solid: "hsl(12, 70%, 60%)" },
  amber:  { fill: "hsla(38, 75%, 55%, 0.3)",  border: "hsla(38, 75%, 55%, 0.8)",  solid: "hsl(38, 75%, 55%)" },
  lime:   { fill: "hsla(85, 55%, 50%, 0.3)",  border: "hsla(85, 55%, 50%, 0.8)",  solid: "hsl(85, 55%, 50%)" },
  teal:   { fill: "hsla(175, 55%, 45%, 0.3)", border: "hsla(175, 55%, 45%, 0.8)", solid: "hsl(175, 55%, 45%)" },
  sky:    { fill: "hsla(200, 65%, 55%, 0.3)", border: "hsla(200, 65%, 55%, 0.8)", solid: "hsl(200, 65%, 55%)" },
  violet: { fill: "hsla(255, 50%, 60%, 0.3)", border: "hsla(255, 50%, 60%, 0.8)", solid: "hsl(255, 50%, 60%)" },
  rose:   { fill: "hsla(330, 55%, 55%, 0.3)", border: "hsla(330, 55%, 55%, 0.8)", solid: "hsl(330, 55%, 55%)" },
  slate:  { fill: "hsla(220, 15%, 45%, 0.3)", border: "hsla(220, 15%, 45%, 0.8)", solid: "hsl(220, 15%, 45%)" },
};

export const STEM_COLORS: Record<string, string> = {
  drums:  "hsl(200, 65%, 55%)",
  bass:   "hsl(30, 70%, 50%)",
  vocals: "hsl(340, 60%, 60%)",
  other:  "hsl(150, 45%, 50%)",
  guitar: "hsl(45, 65%, 55%)",
  piano:  "hsl(270, 45%, 60%)",
};

export interface AnalysisProgressPayload {
  jamId: string;
  step: "tempo" | "key" | "sections" | "loops";
  status: "started" | "completed" | "failed" | "skipped" | "interrupted";
  result?: {
    bpm?: number;
    confidence?: number;
    key?: string;
    scale?: string;
    strength?: number;
    sections?: Array<{
      startSeconds: number;
      endSeconds: number;
      label: string;
      clusterId: number;
    }>;
    loops?: Array<{
      startSeconds: number;
      endSeconds: number;
      repeatCount: number;
      evolving: boolean;
      label: string;
    }>;
  };
}

// -- Phase 7: Sample Browser types --

export type SampleType = 'bookmark' | 'section' | 'loop';

export type SortColumn = 'name' | 'type' | 'source' | 'key' | 'bpm' | 'duration';

/** A unified sample record representing a bookmark, section, or loop from any jam. */
export interface SampleRecord {
  id: string;
  sampleType: SampleType;
  jamId: string;
  name: string;
  startSeconds: number;
  endSeconds: number;
  color: string | null;         // bookmark color, null for sections/loops
  repeatCount: number | null;   // loop repeat count
  evolving: boolean;            // loop evolving flag
  sourceJamName: string;
  jamImportedAt: string;
  keyDisplay: string | null;    // "C minor" or null
  tempoBpm: number | null;
  durationSeconds: number;
  notes: string | null;
}

/** Filter criteria for the sample browser sidebar. */
export interface SampleFilter {
  query?: string;
  types?: SampleType[];
  keys?: string[];
  tempoMin?: number;
  tempoMax?: number;
  durationMin?: number;
  durationMax?: number;
  sourceJamId?: string;
  tags?: string[];
}

/** Available filter option values for the sample browser sidebar dropdowns/sliders. */
export interface SampleFilterOptions {
  keys: string[];
  tags: string[];
  jams: [string, string][];     // [id, original_filename] tuples
  tempoMin: number;
  tempoMax: number;
  durationMin: number;
  durationMax: number;
}
