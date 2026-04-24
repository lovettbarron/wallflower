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
  RecordingStartResult,
  RecordingStopResult,
  RecordingStatus,
  InputDeviceInfo,
  AnalysisResults,
  SearchFilter,
  FilterOptions,
  BookmarkRecord,
  CreateBookmarkInput,
  UpdateBookmarkInput,
  StemInfo,
  SpatialJam,
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

/** Update jam metadata (title, location, notes, patch_notes). */
export async function updateJamMetadata(
  jamId: string,
  originalFilename: string | null,
  location: string | null,
  notes: string | null,
  patchNotes: string | null,
): Promise<void> {
  return invoke("update_jam_metadata", { jamId, originalFilename, location, notes, patchNotes });
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

// --- Recording operations ---

/** Start a new recording session. */
export async function startRecording(): Promise<RecordingStartResult> {
  return invoke("start_recording");
}

/** Stop the current recording session. */
export async function stopRecording(): Promise<RecordingStopResult> {
  return invoke("stop_recording");
}

/** Get the current recording status. */
export async function getRecordingStatus(): Promise<RecordingStatus> {
  return invoke("get_recording_status");
}

/** List available audio input devices. */
export async function listAudioDevices(): Promise<InputDeviceInfo[]> {
  return invoke("list_audio_devices");
}

/** Get current recording input level (RMS in dB). */
export async function getRecordingLevel(): Promise<{ rmsDb: number }> {
  return invoke("get_recording_level");
}

// --- Analysis operations (Phase 4) ---

/** Trigger analysis for a specific jam. Progress streams via Tauri events. */
export async function analyzeJam(jamId: string): Promise<void> {
  return invoke("analyze_jam", { jamId });
}

/** Queue analysis for all unanalyzed jams. */
export async function queuePendingAnalysis(): Promise<number> {
  return invoke("queue_pending_analysis");
}

/** Prioritize analysis for the currently-viewed jam. */
export async function prioritizeAnalysis(jamId: string): Promise<void> {
  return invoke("prioritize_analysis", { jamId });
}

/** Re-analyze a jam (clears previous results except manual overrides). */
export async function reanalyzeJam(jamId: string): Promise<void> {
  return invoke("reanalyze_jam", { jamId });
}

/** Manually override tempo for a jam. */
export async function setManualTempo(
  jamId: string,
  bpm: number,
): Promise<void> {
  return invoke("set_manual_tempo", { jamId, bpm });
}

/** Manually override key for a jam. */
export async function setManualKey(
  jamId: string,
  keyName: string,
  scale: string,
): Promise<void> {
  return invoke("set_manual_key", { jamId, keyName, scale });
}

/** Clear manual tempo override for a jam. */
export async function clearManualTempo(jamId: string): Promise<void> {
  return invoke("clear_manual_tempo", { jamId });
}

/** Clear manual key override for a jam. */
export async function clearManualKey(jamId: string): Promise<void> {
  return invoke("clear_manual_key", { jamId });
}

/** Search/filter jams with the given criteria. */
export async function searchJams(filter: SearchFilter): Promise<JamRecord[]> {
  return invoke("search_jams", { filter });
}

/** Get available filter options (distinct keys, tags, etc.). */
export async function getFilterOptions(): Promise<FilterOptions> {
  return invoke("get_filter_options");
}

/** Get analysis results for a jam. */
export async function getAnalysisResults(
  jamId: string,
): Promise<AnalysisResults> {
  return invoke("get_analysis_results", { jamId });
}

// --- Bookmark & Export operations (Phase 5) ---

export async function createBookmark(input: CreateBookmarkInput): Promise<BookmarkRecord> {
  return invoke("create_bookmark", { input });
}

export async function getBookmarks(jamId: string): Promise<BookmarkRecord[]> {
  return invoke("get_bookmarks", { jamId });
}

export async function updateBookmark(id: string, input: UpdateBookmarkInput): Promise<BookmarkRecord> {
  return invoke("update_bookmark", { id, input });
}

export async function deleteBookmark(id: string): Promise<void> {
  return invoke("delete_bookmark", { id });
}

export async function exportAudio(bookmarkId: string): Promise<string> {
  return invoke("export_audio", { bookmarkId });
}

export async function separateStems(bookmarkId: string): Promise<StemInfo[]> {
  return invoke("separate_stems", { bookmarkId });
}

export async function exportStems(bookmarkId: string, stemNames: string[]): Promise<string> {
  return invoke("export_stems", { bookmarkId, stemNames });
}

export async function cancelSeparation(): Promise<void> {
  return invoke("cancel_separation");
}

export async function revealInFinder(path: string): Promise<void> {
  return invoke("reveal_in_finder", { path });
}

// --- Spatial explorer operations (Phase 6) ---

/** Get all jams with analysis and metadata for the spatial explorer. */
export async function getSpatialJams(): Promise<SpatialJam[]> {
  return invoke("get_spatial_jams");
}

// --- Auto-launch dialog state ---

/** Mark the auto-launch first-launch dialog as shown. */
export async function setAutoLaunchDialogShown(): Promise<void> {
  await invoke("update_settings", {
    settings: { autoLaunchDialogShown: true },
  }).catch(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("wallflower_auto_launch_dialog_shown", "true");
    }
  });
}

/** Check if the auto-launch first-launch dialog has been shown. */
export async function getAutoLaunchDialogShown(): Promise<boolean> {
  try {
    const settings = await getSettings();
    if ("autoLaunchDialogShown" in settings) {
      return !!(settings as Record<string, unknown>).autoLaunchDialogShown;
    }
  } catch {
    // Fall through to localStorage
  }
  if (typeof window !== "undefined") {
    return localStorage.getItem("wallflower_auto_launch_dialog_shown") === "true";
  }
  return false;
}
