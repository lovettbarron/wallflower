# Phase 6: Spatial Explorer, Accessibility & Distribution - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can browse their jam library through a spatial similarity map where musically similar jams cluster together, with coloring by key, tempo, date, or instrumentation. The entire application is keyboard-navigable and accessible to screen readers with high contrast support. The app is distribution-ready with auto-launch on login and proper macOS code signing and notarization via GitHub Actions CI/CD.

</domain>

<decisions>
## Implementation Decisions

### Spatial Map Interaction
- **D-01:** Hybrid node representation — circles by default, expanding to show waveform thumbnail + metadata on hover or click. Clean at a glance, rich on interaction.
- **D-02:** Click navigates to jam detail view (same destination as clicking a jam card in the timeline). Spatial map is a discovery/browsing tool, detail view is the destination.
- **D-03:** Multi-axis blending for clustering — sliders control the weight of each dimension (key, tempo, date, instruments, collaborators) on node proximity. Musicians can blend dimensions to find "jams in Bb minor around 120bpm" by weighting key and tempo high.
- **D-04:** Dedicated "Explore" tab in the top navigation bar (Library | Explore | Settings). Spatial map is a first-class view, not a toggle within Library.
- **D-05:** Node coloring follows the dominant axis — whichever dimension has the highest weight in the blend drives the color. Key uses circle-of-fifths hue mapping, Tempo uses blue-to-red gradient, Date uses old-to-new gradient. Color legend indicates which axis is driving.

### Accessibility — Keyboard Navigation
- **D-06:** Retrofit priority order: Library browse > Jam detail > Playback controls (transport bar) > Spatial explorer > Recording flow > Export/stem mixer > Settings. Core user journey first.
- **D-07:** Roving tabindex with ARIA for canvas-based elements (waveform regions, spatial map nodes). Arrow keys move focus between interactive elements within the canvas. ARIA live regions announce the focused element.
- **D-08:** Screen reader announcements are concise — name and essentials only (e.g., "Jam: Friday Session, 3 minutes 42 seconds"). Musical details (key, BPM, sections) available via drill-down, not announced by default. Faster to scan large libraries.

### High Contrast Mode
- **D-09:** Auto-detect macOS "Increase Contrast" system setting. App switches to high contrast mode automatically. No in-app toggle needed — follows platform convention.
- **D-10:** In high contrast mode, spatial map nodes switch to outlined (thick borders) with always-visible text labels instead of filled colors. Edges become high-contrast lines. Legibility over visual richness.
- **D-11:** High contrast applies app-wide via Tailwind CSS design token overrides — borders sharper, backgrounds more distinct, text contrast increased. Dark theme remains the base, high contrast modifies it.

### Distribution & Code Signing
- **D-12:** Apple Developer account available (paid $99/year). Full code signing and notarization for Gatekeeper-approved distribution.
- **D-13:** Auto-launch on login uses first-launch dialog: "Would you like Wallflower to start automatically when you log in?" with Yes/No. Subsequently configurable in Settings. Uses macOS SMAppService API.
- **D-14:** GitHub Actions CI/CD pipeline: push to main triggers build > sign > notarize > package .dmg > create GitHub Release. Signing certificates stored in GitHub Secrets. Repeatable, no manual release steps.

### Claude's Discretion
- Force simulation parameters (charge, distance, link strength) for react-force-graph
- Dimension slider UI layout and default weights
- Hover expand animation timing and content
- Specific ARIA role assignments for custom components
- Focus ring styling within the design system
- High contrast color token values (within WCAG AA compliance)
- Tauri autostart plugin configuration details
- GitHub Actions workflow structure and signing keychain setup
- .dmg packaging appearance and layout
- First-launch dialog design within the Mutable Instruments aesthetic

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Architecture
- `CLAUDE.md` — Full technology stack: react-force-graph (2D), d3 7.x, Tailwind CSS 4.x, Tauri v2, zustand 5.x. Architecture notes on Rust backend, frontend delivery, Python sidecar.
- `.planning/PROJECT.md` — Project vision, constraints, target hardware (M4 Mac Mini), licensing (MIT)
- `.planning/REQUIREMENTS.md` — PLAY-04, DES-02, DES-03, DES-04, INFRA-13, INFRA-14 requirements for this phase

### Prior Phase Context
- `.planning/phases/02-playback-metadata-design-system-notifications/02-CONTEXT.md` — Design system (D-01-D-04: dark theme, Mutable Instruments, warm accents), tab bar navigation (D-11: Library | Settings), jam cards (D-09), waveform overlay system (D-06)
- `.planning/phases/04-ml-analysis-pipeline/04-CONTEXT.md` — Analysis results data model (key, tempo, sections, loops), jam card badges (D-01), filter bar (D-12-D-15), hardware adaptation (D-20-D-21)
- `.planning/phases/05-source-separation-export/05-CONTEXT.md` — Bookmark regions on waveform (D-01-D-04), stem mixer panel (D-10-D-11)

### Existing Code
- `crates/wallflower-app/tauri.conf.json` — Tauri bundle config with `com.wallflower.app` identifier (needs signing/notarization config)
- `crates/wallflower-app/Cargo.toml` — Tauri dependencies (need autostart plugin)
- `src/app/page.tsx` — Top-level navigation (extend with Explore tab)
- `src/components/library/` — Timeline view components (retrofit keyboard nav)
- `src/components/waveform/` — WaveformDetail.tsx, WaveformOverview.tsx (retrofit ARIA for regions)
- `src/components/transport/TransportBar.tsx` — Playback controls (retrofit keyboard nav)
- `src/components/ui/` — shadcn/radix primitives with basic ARIA (button, select, tabs, etc.)
- `src/components/settings/SettingsPage.tsx` — Settings page (add auto-launch toggle)

### Technology
- react-force-graph (github.com/vasturiano/react-force-graph) — Force-directed graph visualization, Canvas/WebGL, zoom/pan, node interaction
- d3 7.x — Scales, color mappings for dimension-based coloring
- Tauri v2 autostart plugin — macOS login item via SMAppService
- Tauri v2 bundler — Code signing and notarization support
- GitHub Actions — CI/CD for automated builds and releases

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Tab bar navigation component (Library | Settings) — extend with Explore tab
- JamCard component with key/BPM badges — reuse data model for spatial map node tooltips
- Filter bar with key/tempo/tag selectors (Phase 4) — potentially reuse as dimension weight controls in Explore view
- Design system tokens (dark theme, warm accents, rounded shapes) — base for high contrast overrides
- shadcn/radix UI primitives — already have baseline ARIA support (button, select, tabs, dialog)
- TagChip component — reuse for spatial map legend/labels
- Toast notification system (sonner) — reuse for first-launch dialog follow-up

### Established Patterns
- Tauri IPC commands for frontend-backend communication
- SQLite via rusqlite with WAL mode, PRAGMA user_version migrations
- zustand for client state, @tanstack/react-query for server state
- Dark theme with Mutable Instruments design language
- Atomic file operations for file safety

### Integration Points
- Spatial map needs analysis results (key, tempo, sections, loops) from SQLite — query through existing API
- Spatial map needs jam metadata (tags, collaborators, instruments, date) from SQLite
- New Explore tab integrates into existing top-level navigation
- Keyboard nav retrofits existing components without changing their visual appearance
- High contrast hooks into Tailwind CSS theme/token system
- Auto-launch uses Tauri autostart plugin (new dependency)
- Code signing integrates into Tauri bundler configuration
- GitHub Actions needs Tauri build action + Apple signing secrets

</code_context>

<specifics>
## Specific Ideas

- The spatial map is the signature differentiator of Wallflower — it should feel magical to see your jams cluster by musical similarity, like a visual representation of your creative patterns over time
- Multi-axis blending lets musicians ask questions like "show me everything harmonically similar to last week's session" by weighting key high and date moderate
- Hybrid nodes (circles that expand) keep the map clean at overview level while still giving rich info on hover — important when the library grows to hundreds of jams
- Accessibility is a retrofit, not an afterthought — the core flow prioritization ensures the most-used paths are accessible first
- High contrast respecting macOS system setting means musicians who need it don't have to configure it separately in every app
- First-launch dialog for auto-launch respects that not every musician wants a background process — eurorack/studio musicians might want it always on, but laptop musicians might not
- GitHub Actions CI/CD means releases are one git push away — important for an open source project where contributors should be able to verify builds

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-spatial-explorer-accessibility-distribution*
*Context gathered: 2026-04-20*
