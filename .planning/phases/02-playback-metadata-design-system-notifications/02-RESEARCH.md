# Phase 2: Playback, Metadata, Design System & Notifications - Research

**Researched:** 2026-04-19
**Domain:** Audio waveform visualization, metadata CRUD, design system, native notifications, Tauri v2 asset protocol
**Confidence:** HIGH

## Summary

Phase 2 transforms the Phase 1 functional shell into the Wallflower design-driven experience. The core technical challenges are: (1) pre-computing multi-resolution waveform peaks in Rust and serving them to wavesurfer.js, (2) audio playback via Tauri's asset protocol with HTTP range request support for seeking in 120-minute files, (3) SQLite schema expansion for rich metadata (tags, collaborators, instruments, location, notes, photos) with live-save semantics, (4) establishing the dark theme design system with Plus Jakarta Sans typography, and (5) native macOS notifications via tauri-plugin-notification.

The existing codebase has a solid Rust backend with rusqlite 0.39, a Next.js frontend with shadcn components, and Tauri v2 IPC via `invoke`. Phase 1 established the jams table, settings CRUD, and import pipeline. Phase 2 must add metadata tables, a peaks generation pipeline, an audio serving endpoint, and a substantial frontend rebuild with the new design language.

**Primary recommendation:** Build peak generation as a post-import background task in Rust (using symphonia to decode + custom min/max downsampling), serve peaks as JSON via Tauri commands, serve audio via Tauri's `asset://` protocol (which supports range requests on macOS), and expand the SQLite schema with normalized tables for tags/collaborators/instruments/photos.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Design tone leans Mutable Instruments -- warm, playful, rounded corners, organic shapes, generous whitespace, bold accent colors.
- **D-02:** Color palette is dark with warm accents as default (charcoal/near-black background, amber/coral/gold accents). Design tokens support a light theme variant for future use.
- **D-03:** Typography uses a geometric sans-serif (e.g., Inter, Plus Jakarta Sans). Clean, modern, slightly playful.
- **D-04:** Implementation via Tailwind CSS with custom design tokens. No component library dependency -- build components as React + Tailwind.
- **D-05:** Overview + detail navigation model for waveforms. Small overview bar + zoomable detail view.
- **D-06:** Waveform overlays: section markers and key/tempo badges. Overlay content appears progressively as analysis results become available (Phase 4+).
- **D-07:** Persistent bottom transport bar for playback controls.
- **D-08:** Audio playback via Rust backend streaming (HTTP range requests). Frontend uses standard audio element or wavesurfer with backend-served audio.
- **D-09:** Jam cards grouped by date headers (Today, Yesterday, etc.).
- **D-10:** Click card navigates to full jam detail page.
- **D-11:** Top tab bar navigation continues from Phase 1.
- **D-12:** Metadata editing lives below the waveform in jam detail view.
- **D-13:** Tags are free-form with autocomplete from previously used tags.
- **D-14:** Collaborators and instruments use the same tag-style chip pattern with autocomplete.
- **D-15:** Photo/patch attachment via drag-drop + auto-attach from ~/wallflower/patches/.
- **D-16:** All metadata changes live-save immediately.
- **D-17:** Native macOS notifications via Tauri v2 notification API.

### Claude's Discretion
- Specific notification event list and grouping behavior
- Waveform color scheme and visual treatment within the design system
- Exact spacing/sizing tokens for the design system
- Photo gallery layout within the jam detail view
- Date grouping logic for timeline
- Light theme color mapping (dark ships first)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAY-01 | View waveforms powered by pre-computed multi-resolution peaks | wavesurfer.js 7.12.x supports pre-decoded peaks via load(url, peaks, duration). Peaks generated in Rust using symphonia decoder + custom min/max downsampling. |
| PLAY-02 | Scrub/seek in recordings up to 120min via HTTP Range requests | Tauri asset:// protocol supports Range headers on macOS. convertFileSrc transforms local paths to asset URLs. |
| PLAY-03 | Browse jam library in chronological timeline view | Frontend-only: group jams by date using imported_at/created_at fields from existing schema. |
| PLAY-05 | Playback never interrupted by background processing | Single-user desktop app; peak generation runs in background tokio task. No contention with playback. |
| META-01 | Add free-form tags and notes to jams and sections | New SQLite tables: jam_tags, jam_notes. Live-save via Tauri commands. |
| META-02 | Record collaborator information | New SQLite table: jam_collaborators. Same chip UI pattern as tags. |
| META-03 | Tag instruments used in a jam | New SQLite table: jam_instruments. Same chip UI pattern. |
| META-04 | Record location and time metadata | New columns on jams table: location TEXT, recorded_at TEXT. |
| META-05 | Attach patch notes (text descriptions) | New column on jams table: patch_notes TEXT. |
| META-06 | Drag-and-drop photos into jam metadata | New SQLite table: jam_photos. File storage in app support dir. Tauri onDragDropEvent for file paths. |
| META-07 | Auto-attach photos from ~/wallflower/patches/ | Extend notify watcher to watch patches folder. Auto-link new images to most recent jam. |
| META-09 | All metadata live-saves | Debounced auto-save on blur/1s inactivity for text fields. Immediate save for tag/collaborator/instrument add/remove. |
| DES-01 | Mutable Instruments-inspired design language | shadcn CSS variable override with dark theme tokens. Plus Jakarta Sans via @fontsource. 12px border-radius for cards/chips. |
| DES-05 | Wireframes generated and approved before UI implementation | Phase 2 UI-SPEC already approved with detailed layout contracts. |
| DES-06 | UI accepts photo sketches as design input | Covered by UI-SPEC process already completed. |
| INFRA-11 | Native macOS notifications | tauri-plugin-notification 2.3.3. Register plugin, configure permissions, send from Rust. |

</phase_requirements>

## Standard Stack

### Core (Frontend -- new for Phase 2)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wavesurfer.js | 7.12.6 | Waveform rendering & interaction | De facto standard for browser audio waveform. Supports pre-decoded peaks, zoom, regions. |
| @wavesurfer/react | 1.0.12 | React hooks for wavesurfer | Official React wrapper. useWavesurfer hook handles lifecycle. |
| @fontsource/plus-jakarta-sans | 5.2.8 | Self-hosted font | No external network requests. Weights 400 + 600 per UI-SPEC. |
| zustand | 5.0.12 | Client state (transport, UI) | Already in CLAUDE.md stack. Lightweight, minimal boilerplate. |
| @tanstack/react-query | 5.99.1 | Server state / API data | Already in CLAUDE.md stack. Caching, refetching for metadata CRUD. |
| sonner | 2.0.7 | Toast notifications | Already installed. In-app transient feedback per UI-SPEC. |

### Core (Backend -- new for Phase 2)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tauri-plugin-notification | 2.3.3 | Native macOS notifications | Official Tauri plugin. Simple API: builder().title().body().show(). |
| symphonia | 0.5.x (installed) | Audio decoding for peak generation | Already in wallflower-core Cargo.toml. Decode WAV/FLAC/MP3 to PCM samples. |
| image (Rust crate) | 0.25.x | Photo thumbnail generation | Standard Rust image processing. Generate thumbnails for photo gallery. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-notification | 2.3.3 | JS notification permissions | Request permission from frontend on first launch. |
| @tauri-apps/api | 2.10.1 (installed) | convertFileSrc, Tauri IPC | Asset protocol URLs for audio playback. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tauri asset:// protocol | axum HTTP server | asset:// is simpler, already built into Tauri, supports Range on macOS. axum would add a separate server process. |
| Custom Rust peak generation | bbc/audiowaveform (C++) | External binary dependency. Symphonia is already in the project and decoding is straightforward. Custom peak gen is ~50 lines of Rust. |
| @fontsource static | @fontsource-variable | Variable font is larger file size. We only need 2 weights (400, 600). Static is smaller. |

**Installation:**
```bash
# Frontend
npm install wavesurfer.js @wavesurfer/react @fontsource/plus-jakarta-sans zustand @tanstack/react-query @tauri-apps/plugin-notification

# Backend (add to crates/wallflower-app/Cargo.toml)
cargo add tauri-plugin-notification@2
# Add to crates/wallflower-core/Cargo.toml
cargo add image@0.25
```

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)
```
src/
  app/
    page.tsx                    # Library timeline (updated)
    jam/[id]/page.tsx          # Jam detail view (new)
    layout.tsx                 # Updated with Plus Jakarta Sans, dark theme
  components/
    ui/                        # shadcn components (restyled)
    waveform/
      WaveformOverview.tsx     # Full-recording overview bar
      WaveformDetail.tsx       # Zoomable detail view
    transport/
      TransportBar.tsx         # Persistent bottom playback bar
    library/
      JamCard.tsx              # Timeline card with mini-waveform
      DateGroup.tsx            # Date header grouping
      Timeline.tsx             # Scrollable jam list
    metadata/
      MetadataEditor.tsx       # Composite: tags, collab, instruments, etc.
      TagChip.tsx              # Unified chip component
      PhotoGallery.tsx         # Grid of attached photos
      AutocompletePopover.tsx  # Tag/collaborator autocomplete
  lib/
    tauri.ts                   # Extended with metadata + peaks commands
    types.ts                   # Extended with metadata types
    stores/
      transport.ts             # zustand: playback state
      library.ts               # zustand: current view, selected jam
  styles/
    design-tokens.css          # CSS variables for dark theme

crates/
  wallflower-core/src/
    peaks.rs                   # Multi-resolution peak generation
    photos.rs                  # Photo storage + thumbnail generation
    db/
      schema.rs                # Extended with metadata types
      mod.rs                   # Extended with metadata CRUD
  wallflower-app/src/
    lib.rs                     # Extended with new Tauri commands + notification plugin
migrations/
  V2__metadata_tables.sql      # Tags, collaborators, instruments, photos tables
```

### Pattern 1: Pre-Computed Peak Generation
**What:** When a jam is imported, a background task decodes the audio and generates multi-resolution peaks stored as JSON files alongside the audio.
**When to use:** Every imported jam needs peaks before waveform display.
**Implementation approach:**

```rust
// Peak generation using symphonia
// Decode audio -> collect samples -> downsample to multiple resolutions
// Store as JSON: [[min, max], [min, max], ...] at resolutions: 256, 1024, 4096 samples per pixel
// File: {app_support_dir}/peaks/{jam_id}.json

pub struct PeakData {
    pub sample_rate: u32,
    pub channels: u16,
    pub duration: f64,
    pub peaks: Vec<Vec<[f32; 2]>>,  // [resolution][position] = [min, max]
}
```

wavesurfer.js expects peaks as `number[][]` (one array per channel) with values normalized to [-1, 1]. The Rust backend generates these at import time and serves them via a Tauri command.

### Pattern 2: Audio Playback via Asset Protocol
**What:** Use Tauri's `convertFileSrc()` to create an `asset://` URL for audio files, which the HTML5 Audio element or wavesurfer.js can load with seeking support.
**When to use:** Any audio playback in the frontend.

```typescript
import { convertFileSrc } from '@tauri-apps/api/core';

// Convert local file path to asset URL
const audioUrl = convertFileSrc(jam.filePath);
// wavesurfer loads this URL -- asset:// protocol handles Range headers on macOS
```

**Critical note:** The asset protocol reads the file directly from disk. On macOS (WKWebView), it supports HTTP Range headers, enabling seeking without loading the entire file. This is confirmed by Tauri source code -- when a Range header is present, only the requested byte range is read.

### Pattern 3: Metadata Live-Save with Debounce
**What:** Metadata changes save immediately to SQLite via Tauri commands. Text fields debounce (1 second after last keystroke or on blur). Chip add/remove saves instantly.
**When to use:** All metadata editing in jam detail view.

```typescript
// zustand store for transport state
interface TransportState {
  currentJamId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: (jamId: string) => void;
  pause: () => void;
  seek: (time: number) => void;
}

// react-query mutation for metadata save
const updateNotes = useMutation({
  mutationFn: (args: { jamId: string; notes: string }) =>
    invoke('update_jam_notes', args),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jam', jamId] }),
});
```

### Pattern 4: Tauri Drag-Drop for Photos
**What:** Tauri v2 provides `onDragDropEvent` which gives actual filesystem paths (not browser File objects). Listen for drops in the photo gallery area.
**When to use:** Photo attachment via drag-and-drop (META-06).

```typescript
import { getCurrentWebview } from '@tauri-apps/api/webview';

// Listen for drag-drop events
const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
  if (event.payload.type === 'drop') {
    const paths = event.payload.paths;
    // Filter for image files, then invoke Rust command to copy + store
    for (const path of paths) {
      invoke('attach_photo', { jamId, filePath: path });
    }
  }
});
```

**Known issue:** Tauri v2 may fire duplicate drag-drop events. Deduplicate by tracking event IDs or debouncing.

### Pattern 5: Patches Folder Auto-Attach
**What:** Extend the existing notify file watcher to also watch ~/wallflower/patches/. When a new image file appears, auto-attach it to the most recent (or currently viewed) jam.
**When to use:** META-07 -- eurorack patch photo workflow.

### Anti-Patterns to Avoid
- **Loading full audio into WebView memory:** Use asset:// protocol with Range requests. Never fetch entire 120-min WAV (multi-GB) into JavaScript.
- **Client-side peak generation:** wavesurfer.js can generate peaks from audio, but this requires loading the full file. For 120-min files, this would freeze the UI. Always use pre-computed peaks.
- **Polling for metadata save confirmation:** Use react-query mutations with optimistic updates instead of polling.
- **Building custom audio streaming server:** Tauri's asset protocol already handles this. Don't add an axum server just for audio.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Waveform rendering | Canvas drawing code | wavesurfer.js | Zoom, seek, regions, Canvas/WebGL rendering are complex. wavesurfer is battle-tested. |
| Audio seeking/streaming | Custom Range request handler | Tauri asset:// protocol | Already built into Tauri, tested on macOS. |
| Toast notifications | Custom toast component | sonner (via shadcn) | Already installed, integrates with shadcn styling. |
| Native notifications | Custom macOS notification bridge | tauri-plugin-notification | Official plugin, handles permissions, grouping. |
| Tag autocomplete | Custom dropdown + search | shadcn Popover + filtered list | Popover handles positioning, keyboard nav. Filter logic is simple. |
| Photo thumbnails | Client-side canvas resize | Rust image crate | Better performance, runs once at import, stored for reuse. |

**Key insight:** This phase has many moving parts but few genuinely novel problems. The stack (wavesurfer, shadcn, Tauri plugins) handles the hard parts. The implementation work is integration and CRUD.

## Common Pitfalls

### Pitfall 1: wavesurfer.js Peak Data Format Mismatch
**What goes wrong:** wavesurfer expects peaks as `number[][]` (array per channel, values in [-1, 1]). If the backend generates peaks in a different format or normalization, the waveform renders incorrectly or not at all.
**Why it happens:** Different tools (bbc/audiowaveform, custom code) produce differently normalized data.
**How to avoid:** Normalize peaks to [-1, 1] in Rust. Test with a known WAV file and verify visual output matches the source audio.
**Warning signs:** Waveform appears flat, inverted, or clipped.

### Pitfall 2: Asset Protocol Scope Not Configured
**What goes wrong:** `convertFileSrc()` returns a URL but the WebView returns 403/404 because the file path isn't in the asset protocol scope.
**Why it happens:** Tauri v2 requires explicit asset protocol scope configuration in tauri.conf.json.
**How to avoid:** Configure asset protocol scope to include the audio storage directory and app support directory.
```json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": ["$APPDATA/**", "$HOME/wallflower/**"]
      }
    }
  }
}
```
**Warning signs:** Audio won't play, browser console shows 403 errors on asset:// URLs.

### Pitfall 3: Drag-Drop Event Duplication
**What goes wrong:** Photos are attached twice because Tauri fires duplicate onDragDropEvent events.
**Why it happens:** Known Tauri v2 bug (issue #14134).
**How to avoid:** Deduplicate by file path -- check if the photo is already attached before inserting.
**Warning signs:** Duplicate entries in photo gallery after a single drop.

### Pitfall 4: SQLite Migration Ordering
**What goes wrong:** V2 migration fails because it conflicts with V1 schema or the migration check doesn't detect V2 needs to run.
**Why it happens:** Phase 1 uses a simple "does jams table exist?" check for migrations. This won't detect V2 migrations.
**How to avoid:** Add a schema_version table or a migrations tracking table. Check version number, not just table existence.
**Warning signs:** New metadata columns missing, app crashes on metadata save.

### Pitfall 5: Peak Generation Blocking Import
**What goes wrong:** Import feels slow because peak generation happens synchronously during import.
**Why it happens:** Peak generation for a 120-min file can take several seconds.
**How to avoid:** Generate peaks asynchronously after import. Show a loading skeleton for waveforms until peaks are ready. Track peak generation status in the database.
**Warning signs:** Import dialog hangs for long files.

### Pitfall 6: Plus Jakarta Sans Not Loading in Tauri WebView
**What goes wrong:** Font doesn't load because next/font/google makes network requests, blocked in local Tauri app.
**Why it happens:** Current layout.tsx uses `next/font/google` (Geist font). This requires internet access.
**How to avoid:** Replace with `@fontsource/plus-jakarta-sans` which bundles font files locally. Import CSS in layout.tsx.
**Warning signs:** Fallback system font renders instead of Plus Jakarta Sans.

### Pitfall 7: Waveform Memory for 120-Minute Files
**What goes wrong:** Overview waveform tries to render millions of data points, causing jank.
**Why it happens:** Not using multi-resolution peaks. Sending high-resolution peaks to the overview bar.
**How to avoid:** Generate peaks at multiple resolutions (e.g., 256, 1024, 4096 samples/pixel). Overview uses lowest resolution (~few thousand points). Detail view uses higher resolution based on zoom level.
**Warning signs:** Overview waveform takes >1s to render, scrolling is janky.

## Code Examples

### Peak Generation (Rust)
```rust
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// Generate multi-resolution peaks for a given audio file.
/// Returns peaks normalized to [-1.0, 1.0] at the specified resolution.
pub fn generate_peaks(
    audio_path: &Path,
    samples_per_pixel: usize,
) -> Result<Vec<[f32; 2]>> {
    let file = std::fs::File::open(audio_path)?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    
    let probed = symphonia::default::get_probe()
        .format(&Hint::new(), mss, &FormatOptions::default(),
                &MetadataOptions::default())?;
    
    let mut format = probed.format;
    let track = format.default_track().unwrap();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())?;
    
    let mut peaks = Vec::new();
    let mut sample_buf = None;
    let mut chunk_min = f32::MAX;
    let mut chunk_max = f32::MIN;
    let mut chunk_count = 0usize;
    
    while let Ok(packet) = format.next_packet() {
        let decoded = decoder.decode(&packet)?;
        let buf = sample_buf.get_or_insert_with(|| {
            SampleBuffer::<f32>::new(decoded.capacity() as u64, *decoded.spec())
        });
        buf.copy_interleaved_ref(decoded);
        
        for &sample in buf.samples() {
            chunk_min = chunk_min.min(sample);
            chunk_max = chunk_max.max(sample);
            chunk_count += 1;
            
            if chunk_count >= samples_per_pixel {
                peaks.push([chunk_min, chunk_max]);
                chunk_min = f32::MAX;
                chunk_max = f32::MIN;
                chunk_count = 0;
            }
        }
    }
    
    // Flush remaining samples
    if chunk_count > 0 {
        peaks.push([chunk_min, chunk_max]);
    }
    
    Ok(peaks)
}
```

### wavesurfer.js with Pre-Computed Peaks (React)
```typescript
import { useWavesurfer } from '@wavesurfer/react';
import { useRef, useMemo, useCallback } from 'react';

interface WaveformDetailProps {
  audioUrl: string;
  peaks: number[][];
  duration: number;
  onSeek: (time: number) => void;
}

export function WaveformDetail({ audioUrl, peaks, duration, onSeek }: WaveformDetailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const wavesurfer = useWavesurfer({
    container: containerRef,
    url: audioUrl,
    peaks: peaks,
    duration: duration,
    waveColor: '#E8863A',      // accent
    progressColor: '#B55E20',   // waveform-played
    cursorColor: '#E8863A',     // accent
    cursorWidth: 2,
    height: 200,
    normalize: true,
    minPxPerSec: 1,             // enables horizontal scroll on zoom
  });
  
  return <div ref={containerRef} />;
}
```

### Tauri Notification (Rust)
```rust
use tauri_plugin_notification::NotificationExt;

// In Tauri command or event handler:
fn notify_import_complete(app: &tauri::AppHandle, filename: &str) {
    let _ = app.notification()
        .builder()
        .title("Import Complete")
        .body(format!("{} added to your library", filename))
        .show();
}
```

### SQLite V2 Migration
```sql
-- V2__metadata_tables.sql

-- Migration tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO schema_version (version) VALUES (2);

-- Add metadata columns to jams
ALTER TABLE jams ADD COLUMN location TEXT;
ALTER TABLE jams ADD COLUMN notes TEXT;
ALTER TABLE jams ADD COLUMN patch_notes TEXT;
ALTER TABLE jams ADD COLUMN peaks_generated INTEGER NOT NULL DEFAULT 0;

-- Tags (free-form, many-to-many)
CREATE TABLE jam_tags (
    id TEXT PRIMARY KEY NOT NULL,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_jam_tags_jam_id ON jam_tags(jam_id);
CREATE INDEX idx_jam_tags_tag ON jam_tags(tag);

-- Collaborators
CREATE TABLE jam_collaborators (
    id TEXT PRIMARY KEY NOT NULL,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_jam_collaborators_jam_id ON jam_collaborators(jam_id);

-- Instruments (called "Gear" in UI)
CREATE TABLE jam_instruments (
    id TEXT PRIMARY KEY NOT NULL,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_jam_instruments_jam_id ON jam_instruments(jam_id);

-- Photos
CREATE TABLE jam_photos (
    id TEXT PRIMARY KEY NOT NULL,
    jam_id TEXT NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    source TEXT NOT NULL CHECK(source IN ('drop', 'patches_folder')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_jam_photos_jam_id ON jam_photos(jam_id);
```

### Design Token CSS Variables
```css
/* Override shadcn CSS variables for Wallflower dark theme */
:root {
  --background: 220 16% 10%;        /* #151921 */
  --foreground: 220 10% 90%;        /* #E2E4E8 */
  --card: 220 14% 14%;              /* #1D2129 */
  --card-foreground: 220 10% 90%;
  --primary: 28 90% 58%;            /* #E8863A */
  --primary-foreground: 0 0% 100%;
  --secondary: 220 14% 14%;         /* #1D2129 */
  --secondary-foreground: 220 10% 90%;
  --muted: 220 14% 18%;             /* #272C36 */
  --muted-foreground: 220 10% 50%;  /* #747A88 */
  --accent: 28 90% 58%;             /* #E8863A */
  --accent-foreground: 0 0% 100%;
  --destructive: 0 72% 51%;         /* #D93636 */
  --destructive-foreground: 0 0% 100%;
  --border: 220 14% 22%;            /* #323844 */
  --input: 220 14% 22%;
  --ring: 28 90% 58%;               /* #E8863A */
  --radius: 0.5rem;                 /* 8px default, cards use rounded-xl (12px) */
  
  /* Custom Wallflower tokens */
  --waveform-primary: 28 90% 58%;
  --waveform-played: 28 70% 42%;
  --waveform-background: 220 14% 14%;
  --surface-elevated: 220 14% 18%;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| wavesurfer v6 peaks format | wavesurfer v7 peaks as `load(url, peaks, duration)` | 2023 (v7 release) | Simpler API, no separate fetch needed |
| Tauri v1 notification bridge | tauri-plugin-notification v2 | 2024 (Tauri v2) | Official plugin, permission management built in |
| next/font/google | @fontsource (local) | N/A | Required for offline-first Tauri apps |
| Custom HTTP server for audio | Tauri asset:// protocol | Tauri v2 | Built-in Range request support on macOS |

## Open Questions

1. **Peak generation performance for 120-minute files**
   - What we know: symphonia can decode audio. Peak generation is O(n) over samples.
   - What's unclear: Exact time for a 120-min 48kHz stereo WAV (~2GB). Estimate: 5-15 seconds on M4.
   - Recommendation: Generate asynchronously, show loading skeleton. Benchmark with a real file in implementation.

2. **wavesurfer.js zoom behavior with pre-computed peaks**
   - What we know: `minPxPerSec` controls zoom. Scroll enables when zoomed in.
   - What's unclear: Whether wavesurfer interpolates between resolution levels automatically or if we need to swap peak arrays on zoom.
   - Recommendation: Start with a single high-enough resolution (e.g., 1024 samples/pixel gives ~7000 points for a 120-min file at 48kHz). If rendering is slow, implement multi-resolution switching.

3. **Tauri asset protocol CSP configuration**
   - What we know: CSP must include `asset:` and `http://asset.localhost`. Current tauri.conf.json has `"csp": null`.
   - What's unclear: Whether `null` CSP (permissive) is sufficient or if explicit asset protocol enablement is needed.
   - Recommendation: Test with `null` CSP first. If blocked, add explicit asset protocol configuration.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Tauri v2 | App shell | Likely (in Cargo.toml) | 2.x | -- |
| Node.js | Frontend build | Assumed | -- | -- |
| Rust toolchain | Backend | Assumed | -- | -- |
| macOS notification permissions | INFRA-11 | Requires user grant | -- | In-app toasts only |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** macOS notification permission -- user may deny. Fallback to in-app toasts only.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (Rust) | cargo test (built-in, existing tests in wallflower-core) |
| Framework (Frontend) | Not yet configured -- Wave 0 gap |
| Config file (Rust) | Standard Cargo.toml test config |
| Config file (Frontend) | None -- needs vitest or jest setup |
| Quick run command | `cargo test -p wallflower-core` |
| Full suite command | `cargo test --workspace` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAY-01 | Peak generation produces valid peak data | unit (Rust) | `cargo test -p wallflower-core peaks` | No -- Wave 0 |
| PLAY-02 | Audio file accessible via asset protocol | integration (manual) | Manual: verify seeking works in WebView | N/A |
| PLAY-03 | Jams grouped by date in timeline | unit (frontend) | `npx vitest run --filter timeline` | No -- Wave 0 |
| PLAY-05 | Playback not blocked by background tasks | integration (manual) | Manual: import while playing | N/A |
| META-01 | Tag CRUD operations | unit (Rust) | `cargo test -p wallflower-core tags` | No -- Wave 0 |
| META-02 | Collaborator CRUD operations | unit (Rust) | `cargo test -p wallflower-core collaborators` | No -- Wave 0 |
| META-03 | Instrument CRUD operations | unit (Rust) | `cargo test -p wallflower-core instruments` | No -- Wave 0 |
| META-04 | Location/time metadata save | unit (Rust) | `cargo test -p wallflower-core metadata` | No -- Wave 0 |
| META-05 | Patch notes save | unit (Rust) | `cargo test -p wallflower-core metadata` | No -- Wave 0 |
| META-06 | Photo attach and storage | unit (Rust) | `cargo test -p wallflower-core photos` | No -- Wave 0 |
| META-07 | Patches folder watcher | integration (Rust) | `cargo test -p wallflower-core patches_watcher` | No -- Wave 0 |
| META-09 | Live-save (no explicit save) | integration (frontend) | Manual: verify auto-save timing | N/A |
| DES-01 | Design language applied | visual (manual) | Manual: visual review against UI-SPEC | N/A |
| DES-05 | Wireframes approved | process | Already done (02-UI-SPEC.md exists) | N/A |
| DES-06 | Photo sketches accepted | process | Already done | N/A |
| INFRA-11 | Native notification appears | integration (manual) | Manual: trigger import, check notification center | N/A |

### Sampling Rate
- **Per task commit:** `cargo test -p wallflower-core`
- **Per wave merge:** `cargo test --workspace`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `crates/wallflower-core/src/peaks.rs` tests -- peak generation unit tests
- [ ] `crates/wallflower-core/src/db/mod.rs` -- metadata CRUD tests (tags, collaborators, instruments, photos)
- [ ] `crates/wallflower-core/src/photos.rs` tests -- photo storage + thumbnail tests
- [ ] Frontend test framework setup: `npm install -D vitest @testing-library/react @testing-library/jest-dom`
- [ ] Migration tracking system (schema_version table or equivalent)

## Sources

### Primary (HIGH confidence)
- wavesurfer.js official docs: https://wavesurfer.xyz/docs/ -- peaks loading, options API
- wavesurfer.js FAQ: https://wavesurfer.xyz/faq/ -- pre-computed peaks guidance
- Tauri v2 notification plugin: https://v2.tauri.app/plugin/notification/ -- plugin registration, Rust API, permissions
- Tauri v2 core API: https://v2.tauri.app/reference/javascript/api/namespacecore/ -- convertFileSrc documentation
- @fontsource Plus Jakarta Sans: https://fontsource.org/fonts/plus-jakarta-sans/install -- installation, Next.js guide
- npm registry -- verified package versions (wavesurfer.js 7.12.6, @wavesurfer/react 1.0.12, etc.)

### Secondary (MEDIUM confidence)
- Tauri asset protocol range request support: https://github.com/tauri-apps/tauri/issues/12019 -- confirmed Range header handling in asset protocol
- Tauri drag-drop events: https://github.com/QuietJoon/Tauri_Drag_and_Drop_Minimum_Example -- onDragDropEvent usage pattern
- Tauri drag-drop duplication bug: https://github.com/tauri-apps/tauri/issues/14134 -- known issue, needs deduplication

### Tertiary (LOW confidence)
- Multi-resolution peak generation approach: Custom recommendation based on symphonia API and wavesurfer peak format requirements. Not based on a specific library implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified on npm/crates.io with current versions
- Architecture: HIGH -- patterns follow established Tauri v2 + wavesurfer.js conventions
- Pitfalls: HIGH -- based on documented issues and official docs
- Peak generation: MEDIUM -- custom implementation, approach is sound but untested at 120-min scale

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days -- stable ecosystem, no breaking changes expected)
