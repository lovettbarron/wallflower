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
