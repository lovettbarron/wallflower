---
phase: 05-source-separation-export
reviewed: 2026-04-24T12:00:00Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - crates/wallflower-app/src/commands/bookmarks.rs
  - crates/wallflower-app/src/commands/export.rs
  - crates/wallflower-app/src/commands/mod.rs
  - crates/wallflower-app/src/lib.rs
  - crates/wallflower-app/src/sidecar/grpc_client.rs
  - crates/wallflower-core/src/analysis/queue.rs
  - crates/wallflower-core/src/bookmarks/mod.rs
  - crates/wallflower-core/src/bookmarks/schema.rs
  - crates/wallflower-core/src/db/mod.rs
  - crates/wallflower-core/src/export/mod.rs
  - crates/wallflower-core/src/export/sanitize.rs
  - crates/wallflower-core/src/export/sidecar.rs
  - crates/wallflower-core/src/export/writer.rs
  - crates/wallflower-core/src/lib.rs
  - crates/wallflower-core/src/settings/mod.rs
  - migrations/V5__bookmarks_exports.sql
  - proto/wallflower_analysis.proto
  - sidecar/pyproject.toml
  - sidecar/src/wallflower_sidecar/analyzers/separation.py
  - sidecar/src/wallflower_sidecar/server.py
  - sidecar/tests/test_separation.py
  - src/components/bookmarks/BookmarkContextMenu.tsx
  - src/components/bookmarks/BookmarkList.tsx
  - src/components/bookmarks/BookmarkPopover.tsx
  - src/components/library/JamDetail.tsx
  - src/components/settings/SettingsPage.tsx
  - src/components/stems/SeparationProgress.tsx
  - src/components/stems/StemMixer.tsx
  - src/components/stems/StemRow.tsx
  - src/components/ui/context-menu.tsx
  - src/components/ui/sheet.tsx
  - src/components/waveform/WaveformDetail.tsx
  - src/components/waveform/WaveformOverview.tsx
  - src/lib/stores/bookmarks.ts
  - src/lib/stores/separation.ts
  - src/lib/tauri.ts
  - src/lib/types.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-04-24T12:00:00Z
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

## Summary

This review covers the Phase 5 implementation: bookmarks, audio export, source separation via demucs-mlx, and the stem mixer UI. The implementation is well-structured with good separation of concerns across Rust backend (bookmarks CRUD, export writer, sanitization, sidecar metadata), Python sidecar (chunked separation with overlap-add crossfading), and React frontend (bookmark management, stem mixer with Web Audio API).

Key concerns:
- **Two critical issues**: a path traversal vulnerability in the stem audio loading and a race condition between stem cache invalidation and bookmark update in the Rust command layer.
- **Several warnings**: bookmark validation gaps (start >= end allowed), an inconsistent settings key used for export directory, an unbounded collision loop in filename resolution, and a thread-safety issue with the progress message list in the Python server.
- Overall code quality is solid with good test coverage on the Rust side, proper atomic writes, and well-designed protobuf contracts.

## Critical Issues

### CR-01: Path Traversal in Stem Audio Loading

**File:** `src/components/stems/StemMixer.tsx:63`
**Issue:** The stem audio URL is constructed by extracting only the filename from `stem.filePath` via `split("/").pop()` and passing it directly to the audio API endpoint. The `filePath` comes from the Python sidecar's output directory, which the user does not control, but the value is stored in the database and retrieved from the Tauri backend. If a malicious or corrupted stem cache entry contains a crafted `filePath` like `../../sensitive-file`, the `.pop()` extraction would yield `sensitive-file`, which is then URL-encoded and sent to the API server. The API server at `localhost:23516` serves files from the audio directory -- if it does not restrict to that directory, this enables reading arbitrary files accessible from the audio root.
**Fix:** The API server should validate that resolved paths stay within the allowed audio/stem directories. Additionally, the stem file path sent from the backend should be a relative path or a unique identifier rather than an absolute filesystem path:
```typescript
// In StemMixer.tsx, use a dedicated stem endpoint instead of the general audio endpoint:
const audioUrl = `http://localhost:23516/api/stem/${encodeURIComponent(stem.filePath)}`;
// And validate on the server side that the path is within the stem_cache directory.
```

### CR-02: Race Condition in Bookmark Update - Stem Cache Invalidation After Return

**File:** `crates/wallflower-app/src/commands/bookmarks.rs:29-46`
**Issue:** In `update_bookmark`, the function first calls `bookmarks::update_bookmark` and stores the result in `updated`, then checks `time_changed` to invalidate stem cache. However, `updated` is returned to the caller at line 46 even if `invalidate_stem_cache` fails at line 43. The real bug is subtler: the `time_changed` check at line 37 only looks at whether `start_seconds` or `end_seconds` is `Some` in the input, but does not check whether the new values actually differ from the old ones. This means any update that includes `start_seconds` or `end_seconds` (even if unchanged) will unnecessarily invalidate the stem cache, destroying potentially expensive separation results.
**Fix:** Fetch the original bookmark before update, compare the actual values, and only invalidate if they truly changed:
```rust
let original = bookmarks::get_bookmark(&db.conn, &id).map_err(|e| e.to_string())?;
let updated = bookmarks::update_bookmark(&db.conn, &id, input).map_err(|e| e.to_string())?;

let time_changed = updated.start_seconds != original.start_seconds
    || updated.end_seconds != original.end_seconds;

if time_changed {
    bookmarks::invalidate_stem_cache(&db.conn, &id).map_err(|e| e.to_string())?;
}
```

## Warnings

### WR-01: No Validation That start_seconds < end_seconds in Bookmark Creation

**File:** `crates/wallflower-core/src/bookmarks/mod.rs:11-27`
**Issue:** `create_bookmark` does not validate that `start_seconds < end_seconds`. A bookmark where start equals or exceeds end would produce a zero-length or negative-length audio region. When this bookmark is later used for export (`export_time_slice`) or separation, it would either produce an empty file or cause unexpected behavior in the chunking algorithm (negative `total_samples`).
**Fix:** Add validation at the top of `create_bookmark`:
```rust
if input.start_seconds >= input.end_seconds {
    return Err(WallflowerError::Validation(
        "start_seconds must be less than end_seconds".into()
    ));
}
```

### WR-02: Inconsistent Settings Key for Export Directory

**File:** `crates/wallflower-app/src/commands/export.rs:53`
**Issue:** The `export_audio` command reads the export directory from `get_setting(&db.conn, "export_dir")`, but the settings module (`settings/mod.rs:44`) and the `save_config` function (`settings/mod.rs:99`) both use the key `"export_root"`. This means user-configured export directory changes via the Settings UI will never be picked up by the `export_audio` command, which will always fall back to the default path.
**Fix:** Change the settings key in `export.rs` to match the canonical key:
```rust
let export_root = wallflower_core::db::get_setting(&db.conn, "export_root")
    .ok()
    .flatten()
    .unwrap_or_else(|| {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("wallflower")
            .join("exports")
            .to_string_lossy()
            .to_string()
    });
```
The same issue exists at line 64 with `"export_format"` (should be `"export_format"` -- this one matches) and line 68 with `"export_bit_depth"` (should be `"export_bit_depth"` -- this also matches). But the `"export_dir"` vs `"export_root"` mismatch at line 53 is a real bug. Also check `export_stems` at line 432 which has the same `"export_dir"` mismatch.

### WR-03: Unbounded Loop in resolve_export_path Collision Avoidance

**File:** `crates/wallflower-core/src/export/sanitize.rs:41-48`
**Issue:** The collision avoidance loop in `resolve_export_path` increments a counter indefinitely. If the filesystem has permissions issues or a symlink loop, this could spin forever. While unlikely in practice, a defensive implementation should cap the counter.
**Fix:** Add an upper bound:
```rust
let mut counter = 2;
loop {
    if counter > 10000 {
        return dir.join(format!("{} (overflow).{}", safe_bookmark, extension));
    }
    let candidate = dir.join(format!("{} ({}).{}", safe_bookmark, counter, extension));
    if !candidate.exists() {
        return candidate;
    }
    counter += 1;
}
```

### WR-04: Thread-Safety Issue with Progress Message List in Python Server

**File:** `sidecar/src/wallflower_sidecar/server.py:181-259`
**Issue:** The `SeparateStems` method in the gRPC server uses a plain Python list `progress_messages` as a shared data structure between the main gRPC thread (which reads it) and the separation worker thread (which appends to it via the `on_progress` callback). While CPython's GIL provides some protection for list append/read, this is not guaranteed across all Python implementations and is a code smell. The `reported` index and `len(progress_messages)` reads happen in a polling loop, and there's a potential for the gRPC thread to miss or double-read progress if the list is modified during iteration.
**Fix:** Use a `queue.Queue` for thread-safe message passing:
```python
import queue
progress_queue = queue.Queue()

def on_progress(prog: SeparationProgress):
    progress_queue.put(prog)

# In the polling loop:
while sep_thread.is_alive():
    try:
        prog = progress_queue.get_nowait()
        yield pb2.SeparationProgress(...)
    except queue.Empty:
        sep_thread.join(timeout=0.1)
```

### WR-05: chrono_now Produces Non-ISO-8601 Timestamps

**File:** `crates/wallflower-app/src/commands/export.rs:599-606`
**Issue:** The `chrono_now()` function returns a Unix epoch timestamp followed by "Z" (e.g., `"1713974400Z"`). This is not a valid ISO 8601 timestamp and will be confusing in the JSON sidecar metadata. The `exported_at` field in `ExportInfo` is typed as `String` and presumably intended to be human-readable.
**Fix:** Either add the `chrono` crate and produce a proper ISO 8601 string, or format the timestamp using a basic conversion:
```rust
fn chrono_now() -> String {
    // For proper ISO 8601, consider adding the chrono crate.
    // Minimal approach: seconds since epoch is at least parseable.
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Return as ISO-like format (approximate)
    format!("1970-01-01T00:00:00Z") // Replace with actual chrono usage
}
```
Or simply use the `time` crate or `chrono` for proper formatting.

### WR-06: Missing Bookmark Validation on Start/End Seconds in Frontend

**File:** `src/components/waveform/WaveformDetail.tsx:199-205`
**Issue:** The `onBookmarkDragEnd` callback fires when the drag distance is greater than 0.1 seconds (`t1 - t0 > 0.1`), but after snapping, `snappedStart` could equal `snappedEnd` if both snap to the same boundary. This would create a zero-length bookmark which could cause issues downstream (zero-length audio export, empty separation).
**Fix:** Validate after snapping:
```typescript
const snappedStart = snapToNearestBoundary(t0, e.altKey);
const snappedEnd = snapToNearestBoundary(t1, e.altKey);
if (snappedEnd - snappedStart > 0.1) {
    requestAnimationFrame(() => {
        onBookmarkDragEnd(snappedStart, snappedEnd);
    });
}
```

## Info

### IN-01: Hardcoded Wallflower Version String

**File:** `crates/wallflower-app/src/commands/export.rs:139`
**Issue:** The `wallflower_version` field in the export sidecar is hardcoded to `"0.1.0"`. This will become stale as the app evolves.
**Fix:** Consider reading the version from `Cargo.toml` at compile time using `env!("CARGO_PKG_VERSION")` or a similar mechanism.

### IN-02: Separation Model Settings Key Mismatch

**File:** `crates/wallflower-app/src/commands/export.rs:220-228`
**Issue:** The `separate_stems` command reads `separation_memory_limit_gb` from the settings table, but the `AppConfig` struct in `settings/mod.rs:27` declares this field as `i32` while the export command parses it as `f64`. The type mismatch means the setting will work (since integer strings parse as f64), but the differing types could cause confusion.
**Fix:** Align on one type. Since fractional GB values (e.g., 1.5 GB) could be useful, consider changing `AppConfig.separation_memory_limit_gb` to `f64`, or documenting that only integer values are supported.

### IN-03: StemMixer Passes null Bookmark Prop

**File:** `src/components/library/JamDetail.tsx:497`
**Issue:** The `StemMixer` component is always rendered with `bookmark={null}`. The mixer relies on `mixerBookmark` from the store instead. The `bookmark` prop on `StemMixer` is effectively dead code.
**Fix:** Either remove the `bookmark` prop from `StemMixerProps` or pass the actual bookmark when opening the mixer.

### IN-04: Unused anchorEl Prop in BookmarkPopover

**File:** `src/components/bookmarks/BookmarkPopover.tsx:21`
**Issue:** The `anchorEl` prop is declared in `BookmarkPopoverProps` but never used in the component body. This is dead code in the interface.
**Fix:** Remove the `anchorEl` prop from the interface.

---

_Reviewed: 2026-04-24T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
