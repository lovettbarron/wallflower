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

<<<<<<< HEAD
/** A tag attached to a jam. */
=======
/** Pre-computed waveform peak data for a jam recording. */
export interface PeakData {
  sampleRate: number;
  channels: number;
  duration: number;
  peaks: [number, number][];
}

/** A tag associated with a jam. */
>>>>>>> worktree-agent-a82adea1
export interface JamTag {
  id: string;
  jamId: string;
  tag: string;
  createdAt: string;
}

<<<<<<< HEAD
/** A collaborator attached to a jam. */
=======
/** A collaborator associated with a jam. */
>>>>>>> worktree-agent-a82adea1
export interface JamCollaborator {
  id: string;
  jamId: string;
  name: string;
  createdAt: string;
}
<<<<<<< HEAD

/** An instrument/gear entry attached to a jam. */
export interface JamInstrument {
  id: string;
  jamId: string;
  name: string;
  createdAt: string;
}

/** A photo attached to a jam. */
export interface JamPhoto {
  id: string;
  jamId: string;
  filename: string;
  filePath: string;
  thumbnailPath: string | null;
  source: "drop" | "patches_folder";
  createdAt: string;
}

/** Extended jam record with all metadata for detail views. */
export interface JamDetail extends JamRecord {
  location: string | null;
  notes: string | null;
  patchNotes: string | null;
  peaksGenerated: boolean;
  tags: JamTag[];
  collaborators: JamCollaborator[];
  instruments: JamInstrument[];
  photos: JamPhoto[];
}
=======
>>>>>>> worktree-agent-a82adea1
