---
phase: "01"
depth: standard
status: issues_found
files_reviewed: 30
findings:
  critical: 0
  warning: 9
  info: 6
  total: 15
reviewed_at: "2026-04-25"
---

# Phase 01 Code Review

## Summary

Phase 01 establishes the Tauri v2 app shell, SQLite storage layer, Rust API, and React frontend. The foundation is solid: the import pipeline is safe (atomic copy → fsync → rename), SQL queries are parameterised throughout, the migration system handles upgrade paths, and test coverage is good. No critical bugs were found. The warnings below are real issues that could surface in production, primarily around: API server crash-terminating the app, migration state machine bugs under specific upgrade paths, a path-traversal window in device import, deadlock potential in `update_settings`, and an unbounded filename-collision loop.

---

## Findings

### WR-01: API server panic kills entire Tauri process
**File:** `crates/wallflower-app/src/api/mod.rs`:77-82  
**Severity:** warning  
**Description:** `start_api_server` calls `.expect("failed to bind API server")` and `.expect("API server error")` at the top level of the spawned task. If port 23516 is already in use (e.g., the user runs two instances, or another process grabbed the port) the whole Tauri app panics and crashes with no user-visible error. The `axum::serve` `.expect` will also crash the process if the server hits any unrecoverable error mid-run.  
**Recommendation:** Replace both `.expect` calls with error handling. On bind failure, log a warning and either retry on a different port or emit a Tauri event/notification telling the user the API server could not start. The app should remain functional (Tauri IPC commands work without the HTTP server).

---

### WR-02: Migration version tracking uses two independent systems in parallel
**File:** `crates/wallflower-core/src/db/mod.rs`:106-192  
**Severity:** warning  
**Description:** V1 and V2 are tracked via the `schema_version` table. V3, V4, and V5 are tracked via `PRAGMA user_version`. There is no code that sets `user_version` to 2 or 3 when a database upgraded from V1 via the `schema_version` path lands here. Concretely: after running the V1→V2 upgrade branch (lines 141-153), `user_version` is still 0, so `current_version < 3` is true and V3 runs as expected. However if V4's migration file ever sets `user_version = 4` but V3's migration file sets `user_version = 3` (see line 167), a freshly-opened in-memory DB will read `user_version = 0` after running V3, then proceed to V4—reading `user_version` again between each migration. But V4's migration does **not** set `user_version = 4` (the code relies on the migration SQL file to do so, but that is not verified here). If `V4__analysis_tables.sql` lacks `PRAGMA user_version = 4`, V4 will re-run on every startup after V3.  
**Recommendation:** After each `execute_batch(V_N_MIGRATION)` call, unconditionally set `PRAGMA user_version = N` in Rust code, not relying on the SQL migration file. Centralise migration bookkeeping into a single `user_version` sequence; remove the dual-system.

---

### WR-03: Device import path traversal — files relative to mount point are joined without validation
**File:** `crates/wallflower-app/src/commands/import.rs`:75-78  
**Severity:** warning  
**Description:** `import_from_device` takes a `files: Vec<String>` from the frontend and builds paths as `mount.join(f)` for each `f`. If a caller passes a file string containing `../../etc/passwd` or an absolute path, `PathBuf::join` with an absolute component replaces the base entirely and the import pipeline will try to hash/copy arbitrary filesystem paths. In the Tauri threat model the frontend is semi-trusted (rendered in a local WebView), so this is a low-but-non-zero risk, especially if the `dev.files` list returned by the backend is ever replayed from storage or manipulated.  
**Recommendation:** Validate that each joined path starts with the mount point (using `.starts_with(&mount)`) before passing to `import_file`. Reject or log any file that escapes the mount root.

---

### WR-04: `update_settings` holds two mutex guards simultaneously — potential deadlock
**File:** `crates/wallflower-app/src/commands/settings.rs`:49-51  
**Severity:** warning  
**Description:** The function acquires `state.db.lock()` on line 49 and `state.config.lock()` on line 50, holding both guards for the duration of the function. Any other Tauri command that acquires these two locks in the opposite order (`config` first, then `db`) will deadlock. A review of `get_status` (status.rs:17-18) acquires `db` then `config` in the same order, so there is no cross-order deadlock today. But this is a latent hazard as more commands are added and the ordering is not enforced by convention anywhere.  
**Recommendation:** Document a strict lock-acquisition order (e.g., always `db` before `config`). Alternatively, hold only one lock at a time: read config into a local struct, release the config lock, then write to DB.

---

### WR-05: `unique_filename` loop is unbounded — infinite loop risk
**File:** `crates/wallflower-core/src/import/mod.rs`:239-250  
**Severity:** warning  
**Description:** The collision-resolution loop increments `counter` as a `u32` but never terminates if all `stem-N.ext` filenames from 1 to `u32::MAX` already exist. In practice this would only occur in pathological conditions (millions of files with the same stem), but it will lock the import thread forever with no timeout or bound.  
**Recommendation:** Add an upper bound (e.g., 9999 or `u32::MAX`) and return an error if exceeded, rather than looping forever.

---

### WR-06: `start_api_server` port is hardcoded — conflicts if multiple instances run
**File:** `crates/wallflower-app/src/api/mod.rs`:76 and `crates/wallflower-app/src/lib.rs`:329  
**Severity:** warning  
**Description:** Port 23516 is hardcoded with no fallback or configuration. If a second instance of the app is launched, the second API server bind fails (see WR-01) and crashes. The port is not exposed through settings.  
**Recommendation:** Bind to port 0 (OS-assigned) and communicate the actual port to the frontend, or make the port user-configurable. At minimum, gracefully handle bind failure (see WR-01).

---

### WR-07: `search_jams` LIKE-based text search does not escape LIKE metacharacters
**File:** `crates/wallflower-core/src/db/mod.rs`:1038-1048  
**Severity:** warning  
**Description:** The free-text search constructs a `LIKE` pattern via `format!("%{}%", trimmed)` without escaping `%` or `_` metacharacters in the user's query. A search for "100%" would match every record; a search for "file_name" would match "fileName" or "fileXname". This is a correctness issue rather than a security issue (values are still parameterised), but produces unexpected results for users.  
**Recommendation:** Escape `%`, `_`, and `\` in `trimmed` before embedding in the LIKE pattern, and add `ESCAPE '\'` to the LIKE clause. E.g. `like_pattern = format!("%{}%", trimmed.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_"))`.

---

### WR-08: `start_patches_watcher` opens a fresh DB connection per photo event, ignoring AppState DB
**File:** `crates/wallflower-app/src/lib.rs`:124-132  
**Severity:** warning  
**Description:** The patches watcher opens a brand-new `Database::open(&db_path)` on every photo file event. This is inconsistent with the rest of the app which uses the single `AppState.db` connection with WAL mode. Opening multiple simultaneous connections to the same SQLite file in WAL mode is safe for reads, but writes from the watcher thread and writes from Tauri command handlers could serialise poorly. More importantly, the watcher thread holds its own connection with no visibility into in-flight transactions from the app.  
**Recommendation:** Either pass the `AppState` db mutex into the watcher (requires `Arc` wrapping) and acquire the lock before querying, or use the existing HTTP API to perform the lookup instead of opening a second connection.

---

### WR-09: `tauri.conf.json` — CSP is null (disabled)
**File:** `crates/wallflower-app/tauri.conf.json`:33  
**Severity:** warning  
**Description:** `"csp": null` disables Content Security Policy entirely. Although this is a local app where the WebView serves trusted Next.js output, a null CSP provides no defence-in-depth against script injection via user-supplied data rendered in the UI (e.g., jam names, notes, or filenames with embedded HTML). Tauri v2 strongly recommends having a CSP even for local-only apps.  
**Recommendation:** Add a CSP that at minimum restricts `default-src` to `'self'` and `tauri://localhost`. Example: `"csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: data:;"`. The `unsafe-inline` for styles is needed for Tailwind CSS.

---

### IN-01: `unsafe impl Send/Sync for SendableRecordingEngine` — safety comment is incomplete
**File:** `crates/wallflower-app/src/lib.rs`:20-31  
**Severity:** info  
**Description:** The `unsafe impl` comment says cpal::Stream is wrapped in `Arc<Mutex<Option<Stream>>>` inside RecordingEngine. This claim needs to be verifiable at the call site. If a future refactor changes the interior structure of `RecordingEngine`, the unsafe impls become unsound without any compiler warning. The comment references `AppState.recording_engine`'s Mutex but this only prevents concurrent access from two Tauri commands — it does not prevent the recording event bridge thread (which holds `RecordingEngine` references indirectly via the event channel) from racing.  
**Recommendation:** Add a doc comment pointing to the specific fields in `RecordingEngine` that make the impl sound, and add a `// TODO: audit when RecordingEngine changes` note. Consider whether `recording_engine` can be wrapped in `Arc<Mutex<>>` with a conditional compile check instead.

---

### IN-02: `get_status` calls `list_jams` to get a count — loads entire result set
**File:** `crates/wallflower-app/src/commands/status.rs`:20  
**Severity:** info  
**Description:** `get_status` loads all `JamRecord` rows from the database just to call `.len()` on them. For a large library this is wasteful: it deserialises every row and allocates a Vec of records, then discards all data except the count.  
**Recommendation:** Replace with `SELECT COUNT(*) FROM jams` to get the count in a single integer query.

---

### IN-03: Migration system has no rollback or transactional wrapping per migration
**File:** `crates/wallflower-core/src/db/mod.rs`:106-192  
**Severity:** info  
**Description:** Each `execute_batch(MIGRATION_VN)` call is not wrapped in a transaction. If a migration partially succeeds before a crash, the DB can be left in an inconsistent half-migrated state. SQLite `execute_batch` does not automatically wrap statements in a transaction.  
**Recommendation:** Wrap each migration in an explicit `BEGIN`/`COMMIT` transaction: `conn.execute_batch("BEGIN; <migration sql> COMMIT;")?`. Most migration frameworks do this by default.

---

### IN-04: `import_from_device` passes absolute device paths to `import_file` — `files` contains full paths from backend
**File:** `crates/wallflower-app/src/commands/import.rs`:75-78  
**Severity:** info  
**Description:** The `files` parameter description suggests it should contain relative paths (filenames), but the backend's `DeviceInfo.files` is populated in `device/mod.rs` with `path.to_string_lossy().to_string()` — which are absolute paths. This means `mount.join(f)` with an absolute `f` will resolve to just `f` (PathBuf join semantics), silently bypassing the `mount_point` prefix entirely. The import still works because the absolute path from `DeviceInfo.files` is correct, but the `mount.join(f)` logic is misleading and functionally equivalent to `PathBuf::from(f)`. If the frontend ever filters or constructs file strings differently, the mount join would produce wrong paths.  
**Recommendation:** Either document clearly that `files` are expected to be absolute paths (in which case `mount.join(f)` should be replaced with just `PathBuf::from(f)`), or enforce that `DeviceInfo.files` contains relative paths and the join is meaningful.

---

### IN-05: `device-import-dialog.tsx` — Zoom YYMMDD year parsing assumes 2000s
**File:** `src/components/device-import-dialog.tsx`:103  
**Severity:** info  
**Description:** The date grouping in `groupFilesByMonth` parses year as `2000 + parseInt(match[1], 10)`. Recordings made after 1 January 2100 will show years like 2100 correctly, but recordings from before 2000 (e.g., archival field recordings re-named in YYMMDD format with year "99") would show as 2099. This is a cosmetic issue only.  
**Recommendation:** No action required for current use case. Document the assumption if the dialog is reused for archival imports.

---

### IN-06: `unique_filename` uses filesystem existence checks without locking — TOCTOU race
**File:** `crates/wallflower-core/src/import/mod.rs`:224-250  
**Severity:** info  
**Description:** `unique_filename` checks `dir.join(name).exists()` and then creates the file non-atomically. Two concurrent imports of files with the same stem could both see the same candidate as available and then both try to create `stem-1.ext`, with one overwriting the other. The subsequent `NamedTempFile::persist` call provides atomic rename semantics for the actual copy, so the race window is narrow, but the uniqueness guarantee is not ironclad under parallel `import_files` calls.  
**Recommendation:** For Phase 1, this is acceptable (SQLite UNIQUE on `content_hash` prevents duplicate DB entries, and the atomic rename means at most one file survives). Add a code comment noting the TOCTOU window and the mitigating factors.
