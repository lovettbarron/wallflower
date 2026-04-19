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

/** Pre-computed waveform peak data for a jam recording. */
export interface PeakData {
  sampleRate: number;
  channels: number;
  duration: number;
  peaks: [number, number][];
}

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
