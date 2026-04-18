# Feature Landscape

**Domain:** Local-first jam session manager with AI audio analysis
**Researched:** 2026-04-18

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Audio file import (WAV, FLAC, AIFF, MP3) | Every audio tool handles standard formats. Zoom F3 outputs WAV 32-bit float. | Low | Use FFmpeg/libsndfile for format conversion. Must handle 32-bit float natively. |
| Waveform visualization with scrubbing | Ableton, Audacity, every sample manager shows waveforms. No waveform = feels broken. | Medium | wavesurfer.js or custom Web Audio canvas. Must handle 2hr+ files without choking -- use downsampled overview + detail view. |
| Playback with transport controls | Play, pause, stop, seek, loop selection. Universal expectation. | Low | Web Audio API. Must work smoothly even during background processing. |
| Metadata tagging (manual) | ADSR, Splice, Loopcloud all tag by instrument, genre, BPM. Users expect to add their own tags. | Low | SQLite backed. Free-form tags + structured fields (instruments, collaborators, location). |
| File organization / library browser | Every sample manager has a browsable library. Flat file list is minimum. | Medium | Chronological timeline view is the baseline. Filter by date, tags, collaborators. |
| Search and filter | Splice, ADSR, Loopcloud all offer search by key, BPM, instrument, genre. | Medium | Full-text search on tags/notes + structured filters on detected attributes. |
| Non-destructive workflow | Never modify originals. ADSR, Ableton all work on copies/references. Musicians will not trust a tool that touches their recordings. | Low | Copy-on-import is already in requirements. Surface this clearly in UX. |
| Export to standard formats | Export selections as WAV/AIFF for DAW import. Every tool does this. | Low | 24-bit WAV default. Respect original sample rate. Embed metadata in filename or sidecar. |
| Tempo/BPM detection | Ableton, Splice, Loopcloud all detect BPM. Expected for any audio tool aimed at musicians. | Medium | aubio or essentia for beat tracking. Challenge: jam sessions have tempo drift, tempo changes. Must handle non-metronomic music gracefully -- show tempo ranges, not single values. |
| Key detection | Splice Bridge syncs by key, Loopcloud filters by key, Ableton 12 detects key. | Medium | essentia or librosa key detection. Same challenge as BPM: jams modulate. Show detected key(s) with timestamps. |
| Crash-safe recording | Any recording tool that loses data on crash is dead. Field recorders like Zoom F3 use write-ahead for this reason. | High | Incremental disk writes, write-ahead log pattern. Already in requirements. This is a trust feature. |
| Auto-save / live-save metadata | Losing tags and notes during a session is unacceptable. | Low | SQLite WAL mode, save on every edit. Already in requirements. |

## Differentiators

Features that set Wallflower apart. Not expected, but create the unique value proposition.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Spatial map / similarity explorer** | XO by XLN Audio proved spatial clustering works for drums. No one does it for full jam sessions. This is Wallflower's signature UX -- browse by musical relationships (timbre, key, tempo, instrumentation) not file names. | High | Requires feature extraction (MFCCs, chroma, spectral features) -> dimensionality reduction (UMAP/t-SNE) -> 2D/3D scatter. Multiple axes: similarity, time, collaborators, instrumentation. Research: AudioCycle, Music-Cluster projects show this is feasible in browser with WebGL. |
| **Source separation (Demucs)** | Isolate instruments from mixed jam recordings. Go from "2-mic room recording" to "here's just the bass line." RipX DAW charges $200+ for this. Wallflower offers it free, local, integrated. | High | Demucs v4 htdemucs_ft model. ONNX export now available (2025) which simplifies integration. 6-source model (vocals, drums, bass, guitar, piano, other). Processing time: ~1x realtime on M4. Must be async, interruptible. |
| **Automatic section detection** | No existing sample manager segments long-form recordings into sections. Musicians currently scrub manually through 2hr jams. This is the core pain point. | High | Combination of structural segmentation (novelty-based, checkerboard kernel on self-similarity matrix) + energy/onset detection for phrase boundaries. essentia or librosa. Challenge: jam music is less structured than produced music -- algorithms tuned for pop songs may struggle. |
| **Repeated section / loop detection** | Identify when the band locks into a groove vs. noodling. Flag sections where a riff repeats. No consumer tool does this for live recordings. | Very High | Self-similarity matrix analysis, subsequence matching. Research territory -- this works well on produced music but is harder on live jams with variation. Flag as needing deep research. |
| **Bookmark sections for later extraction** | Quick triage: listen, mark interesting moments, come back later to export stems. Combines the "field notes" workflow musicians already do on paper with the audio itself. | Medium | UI for marking time ranges with labels. Store in SQLite. Bookmarks become export candidates. |
| **Export as separated stems** | Export a bookmarked 8-bar section as individual instrument stems ready for DAW import. Combines time-slicing + source separation into one action. | Medium | Depends on source separation being complete. Export = slice audio at bookmark boundaries + run Demucs on slice (or slice pre-separated stems). |
| **Recording priority / processing scheduler** | No sample manager considers that the user might be actively recording. Wallflower pauses all ML processing during recording to protect creative flow and audio I/O stability. | Medium | Task queue with priority levels. Recording = critical, analysis = background, separation = bulk. Pause/resume semantics for ML jobs. |
| **Live metadata during recording** | Tag instruments, collaborators, location, and free-form notes while recording is active. No existing jam tool does this well. | Medium | Separate metadata write path from audio write path. UI must not interfere with audio I/O. Mobile-friendly metadata entry is a future win. |
| **Folder watch with auto-import** | Plug in Zoom F3, recordings appear in Wallflower automatically. No manual import step. Reduces friction to near-zero. | Medium | fsnotify/watchdog pattern. Must handle sync folder safety (Dropbox partial writes). Already in requirements. |
| **Progressive feature availability** | Features light up as ML models download and processing completes. App is usable immediately, gets smarter over time. No tool does this -- they either block on processing or show nothing until done. | Medium | Event-driven UI that subscribes to processing state. Waveform -> tempo/key -> sections -> separation, each appearing as available. |
| **Chord detection with timeline** | Show chord changes over time overlaid on waveform. Musicians can find "that Bb minor section" visually. | Medium | essentia chord detection algorithms. Display as colored regions on timeline. |
| **DAW-ready export folder** | Export to a watched folder that Ableton's browser can see. Not drag-and-drop (v1), but the next best thing. | Low | Convention: ~/wallflower/exports/ structure matching Ableton's expected layout. Include metadata in filenames (key, BPM, bars). |

## Anti-Features

Features to explicitly NOT build. These are tempting but would dilute focus or create maintenance burden.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Cloud sync of audio files | Audio files are huge (2hr stereo 32-bit = ~5GB). Cloud sync is slow, expensive, and fights the local-first philosophy. Splice and BandLab own this space. | Sync the SQLite metadata DB only. Audio stays local. Export self-contained packages for sharing. |
| Real-time collaboration / remote jamming | JamKazam, Lutefish, BandLab own this space with significant network infrastructure. Totally different product category. | Wallflower is for after the jam. Share exports, not live sessions. |
| Built-in DAW / multitrack editor | JAMDECK, GarageBand, BandLab are DAWs. Wallflower is a companion to Ableton, not a replacement. Adding editing creates scope explosion. | Export stems to DAW. Let Ableton/Logic do the editing. |
| Sample marketplace / store | Splice, Loopcloud are marketplaces. Wallflower manages your own recordings. | No store, no accounts, no payments. Open source single-user tool. |
| Beat making / sequencer | XO, JAMDECK, Endlesss are creative tools. Wallflower is an organizational/analytical tool. | Export loops for use in beat-making tools. |
| Mobile app | Different platform, different UX paradigm, massive scope increase. | Web-first local app works on any device with a browser. Optimize for desktop. |
| GPU-required ML models | Limits hardware compatibility. M4 Mac Mini Neural Engine + CPU must suffice. | Use ONNX models optimized for CPU/ANE. Demucs ONNX export is available. Accept slower processing. |
| Real-time source separation during playback | Technically challenging and not the use case. Users want to extract, not live-separate. | Batch separation as background task. Preview separated stems after processing completes. |
| Plugin format (VST/AU) | ADSR and Loopcloud offer this. Massive engineering effort for questionable value when the tool is about long-form sessions, not in-DAW browsing. | Standalone web app with export-to-folder for DAW integration. |
| Automatic genre classification | Low value for personal jam recordings. The musician knows what genre they play. | Let users tag genre manually if they want. |

## Feature Dependencies

```
Recording engine (crash-safe audio I/O)
  |
  +--> Folder watch / auto-import
  |      |
  |      +--> Waveform visualization
  |             |
  |             +--> Playback + transport
  |             |
  |             +--> Manual bookmarking
  |
  +--> Live metadata editing (during recording)

Audio analysis pipeline (tempo, key, chords)
  |
  +--> Section detection
  |      |
  |      +--> Repeated section / loop detection
  |
  +--> Search/filter by musical attributes
  |
  +--> Spatial map (requires feature embeddings)

Source separation (Demucs)
  |
  +--> Stem export (time-slice + separation)
  |
  +--> Spatial map clustering by instrumentation

Metadata system (SQLite)
  |
  +--> Manual tagging
  |
  +--> Search/filter
  |
  +--> Bookmarking
  |
  +--> Export with metadata

Processing scheduler
  |
  +--> Recording priority (pause ML during recording)
  |
  +--> Progressive feature availability (UI lights up as processing completes)
```

## MVP Recommendation

Prioritize in this order:

1. **Recording engine with crash safety** -- The trust foundation. If recording is unreliable, nothing else matters.
2. **File import + folder watch** -- Get audio into the system with minimal friction. Support Zoom F3 32-bit float WAV natively.
3. **Waveform visualization + playback** -- Users need to see and hear their jams immediately, even before analysis.
4. **Manual metadata + tagging** -- Let users organize from day one. Don't gate organization behind ML processing.
5. **Bookmarking sections** -- Quick triage of long recordings. Mark interesting moments for later.
6. **Basic audio analysis (tempo, key)** -- First ML feature. Show detected BPM and key. Even imperfect detection is useful.
7. **Export bookmarked sections** -- Close the loop: find interesting moment -> export for DAW.

Defer to post-MVP:
- **Source separation**: High complexity, long processing times. Ship it when the core workflow is solid.
- **Section detection**: Algorithmically challenging on jam recordings. Needs research iteration.
- **Spatial map**: The signature differentiator, but requires feature extraction pipeline to be mature. Ship when there's enough library content to make clustering meaningful.
- **Repeated section detection**: Research-grade difficulty. Defer until section detection works.
- **Chord detection**: Nice to have, not blocking any workflow.

## Sources

- [Splice features and AI tools](https://splice.com/)
- [XO by XLN Audio - spatial sample clustering](https://www.xlnaudio.com/products/xo)
- [ADSR Sample Manager](https://www.adsrsounds.com/product/software/adsr-sample-manager/)
- [Loopcloud features](https://www.loopcloud.com/cloud/features)
- [Sonic Visualiser and VAMP plugins](https://www.sonicvisualiser.org/)
- [Demucs source separation](https://github.com/facebookresearch/demucs)
- [Demucs ONNX export (2025)](https://mixxx.org/news/2025-10-27-gsoc2025-demucs-to-onnx-dhunstack/)
- [JAMDECK music sketching](https://www.jamdeck.net/)
- [Endlesss multiplayer music](https://www.siliconrepublic.com/start-ups/endlesss-remote-music-production-app)
- [Ableton Live 12 browser](https://www.ableton.com/en/live-manual/12/working-with-the-browser/)
- [AudioCycle similarity visualization](https://www.researchgate.net/publication/221262545_AudioCycle_A_similarity-based_visualization_of_musical_libraries)
- [Music-Cluster browser app](https://github.com/XiaoTianFan/Music-Cluster)
- [Essentia MIR library](https://essentia.upf.edu/)
- [librosa audio analysis](https://www.researchgate.net/publication/328777063_librosa_Audio_and_Music_Signal_Analysis_in_Python)
- [RipX DAW stem separation](https://www.audiocipher.com/post/ripx-daw)
