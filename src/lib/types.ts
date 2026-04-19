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
