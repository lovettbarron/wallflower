# Phase 6: Spatial Explorer, Accessibility & Distribution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 06-spatial-explorer-accessibility-distribution
**Areas discussed:** Spatial map interaction, Accessibility strategy, High contrast & theming, Distribution & signing

---

## Spatial Map Interaction

### Node Representation

| Option | Description | Selected |
|--------|-------------|----------|
| Mini waveform thumbnails | Each node shows the jam's mini waveform. Visually rich but denser. | |
| Colored circles with label | Simple circles colored by active dimension with jam name on hover. | |
| Hybrid — circles that expand | Circles by default, expanding to show waveform + metadata on hover/click. | ✓ |

**User's choice:** Hybrid — circles that expand
**Notes:** Best of both — clean overview, rich on interaction.

### Node Click Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to jam detail | Click opens full jam detail view, same as timeline card click. | ✓ |
| Inline preview panel | Click opens side panel with summary and playback controls. | |
| Start playback in-place | Single click plays, double-click navigates to detail. | |

**User's choice:** Navigate to jam detail
**Notes:** Spatial map is a discovery tool, detail view is the destination.

### Clustering Control

| Option | Description | Selected |
|--------|-------------|----------|
| Dimension switcher | Toggle buttons for one active dimension at a time. | |
| Multi-axis blending | Sliders for each dimension's weight on proximity. | ✓ |
| Preset views with custom | Named presets plus Advanced option with sliders. | |

**User's choice:** Multi-axis blending
**Notes:** More powerful — lets musicians find "jams in Bb minor around 120bpm."

### Navigation Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New tab: Library \| Explore \| Settings | Spatial map gets dedicated top-level tab. | ✓ |
| Toggle within Library tab | View-mode toggle switches between timeline and spatial. | |
| Split view option | Timeline and spatial side by side. | |

**User's choice:** New tab — Library | Explore | Settings
**Notes:** Spatial map is a first-class view, not secondary to timeline.

### Node Coloring

| Option | Description | Selected |
|--------|-------------|----------|
| Color by dominant axis | Nodes colored by whichever dimension has highest weight. | ✓ |
| User picks color axis separately | Clustering and coloring are independent controls. | |
| You decide | Claude picks best approach. | |

**User's choice:** Color by dominant axis
**Notes:** Intuitive — what drives clustering also drives color.

---

## Accessibility Strategy

### Keyboard Navigation Priority

| Option | Description | Selected |
|--------|-------------|----------|
| Core flow first | Library > Jam Detail > Playback > Spatial > Recording > Export > Settings. | ✓ |
| New + existing together | Build spatial accessibility while retrofitting all views in parallel. | |
| Spatial explorer only, rest deferred | Full KB nav for spatial only, basic tab-order fixes elsewhere. | |

**User's choice:** Core flow first
**Notes:** Matches the most common user journey.

### Canvas Focus Management

| Option | Description | Selected |
|--------|-------------|----------|
| Roving tabindex with ARIA | Arrow keys move focus between interactive regions within canvas. | ✓ |
| Companion list navigation | Accessible list mirrors canvas content; screen reader users navigate list. | |
| You decide | Claude picks based on wavesurfer.js and react-force-graph APIs. | |

**User's choice:** Roving tabindex with ARIA
**Notes:** Standard WAI-ARIA pattern for custom interactive widgets.

### Screen Reader Verbosity

| Option | Description | Selected |
|--------|-------------|----------|
| Full musical context | Announce key, BPM, duration, bookmark count, analysis status. | |
| Name and essentials only | Announce name and duration. Musical details via drill-down. | ✓ |
| Configurable verbosity | Setting for Concise vs Detailed announcements. | |

**User's choice:** Name and essentials only
**Notes:** Faster to scan through many items. Details available on demand.

---

## High Contrast & Theming

### Activation Method

| Option | Description | Selected |
|--------|-------------|----------|
| Respect macOS setting | Auto-detect "Increase Contrast" from macOS System Settings. | ✓ |
| In-app toggle + OS detection | Both in-app toggle and OS detection. | |
| In-app toggle only | Ignores OS setting, app controls own accessibility. | |

**User's choice:** Respect macOS setting
**Notes:** Follows platform convention. No extra in-app config needed.

### Spatial Map in High Contrast

| Option | Description | Selected |
|--------|-------------|----------|
| Outlined nodes with labels | Thick borders, always-visible text labels, high-contrast edges. | ✓ |
| High-contrast color palette | Fewer, more distinct colors while keeping filled nodes. | |
| You decide | Claude picks based on WCAG requirements. | |

**User's choice:** Outlined nodes with labels
**Notes:** Legibility over visual richness in high contrast mode.

---

## Distribution & Signing

### Apple Developer Account

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, paid ($99/year) | Full code signing + notarization. | ✓ |
| No, will set one up | Need to enroll during this phase. | |
| Skip signing for now | Unsigned .dmg, Gatekeeper bypass required. | |

**User's choice:** Yes, paid ($99/year)
**Notes:** Ready for distribution outside the App Store.

### Auto-Launch Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Opt-in via Settings | Toggle in Settings, off by default. | |
| Ask on first launch | First-launch dialog with Yes/No, then configurable in Settings. | ✓ |
| You decide | Claude picks best UX pattern. | |

**User's choice:** Ask on first launch
**Notes:** Proactive but respectful. Not every musician wants a background process.

### Build Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions CI/CD | Automated: push > build > sign > notarize > .dmg > GitHub Release. | ✓ |
| Local build script | Manual shell script for local builds. | |
| Both — local first, CI later | Local script now, CI migration later. | |

**User's choice:** GitHub Actions CI/CD
**Notes:** Repeatable, one git push to release. Important for open source.

---

## Claude's Discretion

- Force simulation parameters for react-force-graph
- Dimension slider UI layout and default weights
- Hover expand animation timing and content
- ARIA role assignments for custom components
- Focus ring styling
- High contrast color token values
- Tauri autostart plugin configuration
- GitHub Actions workflow structure
- .dmg packaging appearance
- First-launch dialog design

## Deferred Ideas

None — discussion stayed within phase scope
