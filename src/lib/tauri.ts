import { invoke } from "@tauri-apps/api/core";
import type {
  JamRecord,
  JamDetail,
  JamTag,
  JamCollaborator,
  JamInstrument,
  JamPhoto,
  PeakData,
  ImportResult,
  AppSettings,
  AppStatus,
  DeviceInfo,
} from "./types";

// --- Jam operations ---

/** List all jams in the library, ordered by most recently imported. */
export async function listJams(): Promise<JamRecord[]> {
  return invoke("list_jams");
}

/** Get a single jam by its ID. */
export async function getJam(id: string): Promise<JamRecord | null> {
  return invoke("get_jam", { id });
}

/** Get a jam with all metadata (tags, collaborators, instruments, photos). */
export async function getJamWithMetadata(
  id: string,
): Promise<JamDetail | null> {
  return invoke("get_jam_with_metadata", { id });
}

// --- Import operations ---

/** Import one or more files by their absolute paths. */
export async function importFiles(paths: string[]): Promise<ImportResult[]> {
  return invoke("import_files", { paths });
}

/** Import all supported audio files from a directory. */
export async function importDirectory(path: string): Promise<ImportResult[]> {
  return invoke("import_directory", { path });
}

// --- Settings operations ---

/** Get current application settings. */
export async function getSettings(): Promise<AppSettings> {
  return invoke("get_settings");
}

/** Update application settings (partial update supported). */
export async function updateSettings(
  settings: Partial<AppSettings>,
): Promise<AppSettings> {
  return invoke("update_settings", { settings });
}

// --- Status operations ---

/** Get overall application status. */
export async function getStatus(): Promise<AppStatus> {
  return invoke("get_status");
}

// --- Device operations ---

/** Get list of connected USB audio recorder devices. */
export async function getConnectedDevices(): Promise<DeviceInfo[]> {
  return invoke("get_connected_devices");
}

/** Import selected files from a connected device. */
export async function importFromDevice(
  mountPoint: string,
  files: string[],
): Promise<ImportResult[]> {
  return invoke("import_from_device", { mountPoint, files });
}

// --- Tag operations ---

/** Add a tag to a jam. */
export async function addTag(jamId: string, tag: string): Promise<JamTag> {
  return invoke("add_tag", { jamId, tag });
}

/** Remove a tag by its ID. */
export async function removeTag(tagId: string): Promise<void> {
  return invoke("remove_tag", { tagId });
}

/** List all distinct tags across all jams (for autocomplete). */
export async function listAllTags(): Promise<string[]> {
  return invoke("list_all_tags");
}

// --- Collaborator operations ---

/** Add a collaborator to a jam. */
export async function addCollaborator(
  jamId: string,
  name: string,
): Promise<JamCollaborator> {
  return invoke("add_collaborator", { jamId, name });
}

/** Remove a collaborator by its ID. */
export async function removeCollaborator(id: string): Promise<void> {
  return invoke("remove_collaborator", { id });
}

/** List all distinct collaborator names (for autocomplete). */
export async function listAllCollaborators(): Promise<string[]> {
  return invoke("list_all_collaborators");
}

// --- Instrument operations ---

/** Add an instrument to a jam. */
export async function addInstrument(
  jamId: string,
  name: string,
): Promise<JamInstrument> {
  return invoke("add_instrument", { jamId, name });
}

/** Remove an instrument by its ID. */
export async function removeInstrument(id: string): Promise<void> {
  return invoke("remove_instrument", { id });
}

/** List all distinct instrument names (for autocomplete). */
export async function listAllInstruments(): Promise<string[]> {
  return invoke("list_all_instruments");
}

// --- Metadata operations ---

/** Update jam metadata (location, notes, patch_notes). */
export async function updateJamMetadata(
  jamId: string,
  location: string | null,
  notes: string | null,
  patchNotes: string | null,
): Promise<void> {
  return invoke("update_jam_metadata", { jamId, location, notes, patchNotes });
}

// --- Photo operations ---

/** Attach a photo to a jam (copies file to app storage). */
export async function attachPhoto(
  jamId: string,
  filePath: string,
): Promise<JamPhoto> {
  return invoke("attach_photo", { jamId, filePath });
}

/** Remove a photo by its ID. */
export async function removePhoto(id: string): Promise<void> {
  return invoke("remove_photo", { id });
}

// --- Peak operations ---

/** Get peaks for a jam (cached or generates on demand). */
export async function getPeaks(jamId: string): Promise<PeakData> {
  return invoke("get_peaks", { jamId });
}

/** Force regenerate peaks for a jam. */
export async function generatePeaksForJam(jamId: string): Promise<PeakData> {
  return invoke("generate_peaks_for_jam", { jamId });
}

// --- Notification operations ---

/** Send a native macOS notification. */
export async function sendNotification(
  title: string,
  body: string,
): Promise<void> {
  return invoke("send_notification", { title, body });
}
