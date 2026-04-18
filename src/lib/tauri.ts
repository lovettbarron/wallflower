import { invoke } from "@tauri-apps/api/core";
import type {
  JamRecord,
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
