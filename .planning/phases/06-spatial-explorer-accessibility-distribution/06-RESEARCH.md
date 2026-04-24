# Phase 6: Spatial Explorer, Accessibility & Distribution - Research

**Researched:** 2026-04-24
**Domain:** Force-directed graph visualization, web accessibility (WCAG/ARIA), macOS code signing/notarization, Tauri plugins
**Confidence:** HIGH

## Summary

Phase 6 has three distinct technical domains: (1) a spatial explorer using react-force-graph-2d with multi-axis dimension blending, (2) an accessibility retrofit adding keyboard navigation, ARIA, and high contrast mode across the entire app, and (3) macOS distribution readiness via Tauri autostart plugin, code signing, notarization, and GitHub Actions CI/CD.

The spatial explorer is the most technically complex part. react-force-graph-2d (v1.29.1) renders to HTML5 Canvas, which is inherently inaccessible to screen readers. The solution requires a hidden DOM overlay pattern -- a visually-hidden set of focusable elements that mirror the canvas nodes, with ARIA live regions announcing the focused node's details. The multi-axis blending uses d3-force's configurable forces via the `d3Force` prop, where each dimension slider weight maps to a custom force function that pulls similar jams together.

The accessibility retrofit is primarily additive -- existing shadcn/radix components already have baseline ARIA. The work involves adding roving tabindex patterns to custom components (Timeline, JamCard list, waveform regions, spatial map), ARIA landmark roles, live regions, skip link, and high contrast CSS via `@media (prefers-contrast: more)`. The distribution pipeline uses Tauri's built-in code signing support with Apple Developer certificates exported to GitHub Secrets, the `tauri-apps/tauri-action` GitHub Action, and the `tauri-plugin-autostart` crate for login item management.

**Primary recommendation:** Build the spatial map with react-force-graph-2d using `nodeCanvasObject` for custom rendering, a parallel hidden DOM for accessibility, and d3 scales for dimension-to-color mapping. Use CSS media queries for high contrast (no JavaScript needed). Use Tauri's official autostart plugin and signing workflow.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Hybrid node representation -- circles by default, expanding to show waveform thumbnail + metadata on hover or click
- **D-02:** Click navigates to jam detail view (same destination as clicking a jam card in the timeline)
- **D-03:** Multi-axis blending for clustering -- sliders control the weight of each dimension (key, tempo, date, instruments, collaborators) on node proximity
- **D-04:** Dedicated "Explore" tab in the top navigation bar (Library | Explore | Settings)
- **D-05:** Node coloring follows the dominant axis -- whichever dimension has the highest weight in the blend drives the color
- **D-06:** Retrofit priority order: Library browse > Jam detail > Playback controls > Spatial explorer > Recording flow > Export/stem mixer > Settings
- **D-07:** Roving tabindex with ARIA for canvas-based elements. Arrow keys move focus. ARIA live regions announce focused element.
- **D-08:** Screen reader announcements are concise -- name and essentials only
- **D-09:** Auto-detect macOS "Increase Contrast" system setting. No in-app toggle.
- **D-10:** In high contrast mode, spatial map nodes switch to outlined with always-visible text labels
- **D-11:** High contrast applies app-wide via Tailwind CSS design token overrides
- **D-12:** Apple Developer account available ($99/year). Full code signing and notarization.
- **D-13:** Auto-launch on login uses first-launch dialog with Yes/No. Subsequently configurable in Settings. Uses macOS SMAppService API.
- **D-14:** GitHub Actions CI/CD pipeline: push to main triggers build > sign > notarize > package .dmg > create GitHub Release.

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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAY-04 | Spatial map/explorer view where jams cluster by musical similarity, temporal proximity, instrumentation, and collaborators | react-force-graph-2d with custom d3-force functions per dimension, nodeCanvasObject for hybrid node rendering, d3 scales for dimension color mapping |
| DES-02 | Full keyboard navigation for all application features | Roving tabindex pattern for custom components, skip link, arrow key handlers, focus management via React refs |
| DES-03 | ARIA labels and screen reader support throughout | Hidden DOM overlay for canvas accessibility, ARIA landmarks, live regions, concise announcements per D-08 |
| DES-04 | High contrast mode and accessible color choices | CSS `@media (prefers-contrast: more)` overrides on CSS custom properties, no JS runtime needed |
| INFRA-13 | Auto-launch on login | tauri-plugin-autostart v2.5.1 with MacosLauncher::LaunchAgent, @tauri-apps/plugin-autostart JS API |
| INFRA-14 | macOS app signed and notarized for distribution | Tauri bundler signing config, Apple Developer certificate in GitHub Secrets, tauri-apps/tauri-action, notarization via Apple ID + app-specific password |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-force-graph-2d | 1.29.1 | Force-directed graph visualization | Canvas-based, handles zoom/pan/drag, 60fps with 500+ nodes. Already specified in CLAUDE.md. |
| d3 | 7.9.0 | Scales, color mapping, force utilities | d3-scale for dimension-to-color mapping, d3-force used internally by react-force-graph |
| d3-scale | 4.0.2 | Standalone scales (if tree-shaking needed) | Linear, ordinal, chromatic scales for tempo/date/key color mapping |
| @tauri-apps/plugin-autostart | 2.5.1 | Frontend API for autostart enable/disable/query | Official Tauri v2 plugin, matches tauri-plugin-autostart Rust crate |
| tauri-plugin-autostart | 2.x | Rust-side autostart plugin | macOS LaunchAgent or SMAppService-based login item management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tauri-apps/tauri-action | v0 | GitHub Actions build/sign/notarize | CI/CD workflow for automated releases |

### Already in Project (no new install needed)
- react 19.x, next 16.x, tailwindcss 4.x, zustand 5.x, @tanstack/react-query 5.x
- shadcn/radix primitives (Dialog, Slider, Button, Tabs, Tooltip, Card, Select)
- lucide-react (icons)
- sonner (toasts)
- wavesurfer.js 7.x, @wavesurfer/react 1.x

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-force-graph-2d | Raw d3-force + Canvas | More control but significant boilerplate for React integration, zoom/pan, interaction. Not worth it. |
| Hidden DOM overlay | Canvas fallback content | Fallback content is static; doesn't support interactive focus management or live regions. |
| CSS prefers-contrast | JS matchMedia + context | CSS-only is simpler and has zero runtime cost. JS only needed if components need programmatic contrast awareness (the HighContrastProvider context mentioned in UI spec is for edge cases). |
| tauri-plugin-autostart | Raw SMAppService via Rust | Plugin handles cross-platform concerns, provides JS API. No reason to hand-roll. |

**Installation:**
```bash
npm install react-force-graph-2d d3 @tauri-apps/plugin-autostart
```

```toml
# In crates/wallflower-app/Cargo.toml
[dependencies]
tauri-plugin-autostart = "2"
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    explore/                    # NEW - Spatial explorer
      SpatialCanvas.tsx         # react-force-graph-2d wrapper with custom node rendering
      SpatialAccessibilityOverlay.tsx  # Hidden DOM overlay mirroring canvas nodes
      DimensionPanel.tsx        # Right sidebar with dimension weight sliders
      ColorLegend.tsx           # Active dimension color legend
      useSpatialData.ts         # Hook: fetch jams + analysis, compute graph data
      useDimensionForces.ts     # Hook: configure d3-force per dimension weights
      useNodeColorScale.ts      # Hook: d3 scale for dominant-axis coloring
    accessibility/              # NEW - Shared accessibility utilities
      SkipLink.tsx              # Skip-to-main-content link
      HighContrastProvider.tsx  # React context detecting prefers-contrast: more
      useRovingTabIndex.ts      # Reusable roving tabindex hook
      useFocusManager.ts        # Focus trap and restore utilities
    settings/
      SettingsPage.tsx          # MODIFIED - Add auto-launch toggle section
  lib/
    stores/
      explore.ts                # NEW - Zustand store for dimension weights, selected node
    spatial/
      dimensions.ts             # Dimension weight -> force strength mapping functions
      colorScales.ts            # d3 scale factories for each dimension axis
      nodeRenderer.ts           # Canvas draw functions for circle/expanded node states
  app/
    page.tsx                    # MODIFIED - Add Explore tab, refactor to proper Tabs navigation
```

### Pattern 1: Hidden DOM Overlay for Canvas Accessibility
**What:** A visually-hidden `<div>` positioned over the canvas, containing focusable `<button>` elements that correspond 1:1 with canvas nodes. The buttons have ARIA labels and are navigable via arrow keys. An ARIA live region announces the focused node.
**When to use:** Any time a Canvas/WebGL element needs screen reader and keyboard accessibility.
**Example:**
```typescript
// Source: WAI-ARIA canvas accessibility pattern
function SpatialAccessibilityOverlay({ nodes, focusedNodeId, onNodeFocus, onNodeActivate }) {
  return (
    <div
      role="application"
      aria-label="Jam library spatial explorer -- use arrow keys to navigate between jams"
      className="absolute inset-0"
      style={{ pointerEvents: 'none' }}
    >
      {/* Screen-reader-only node buttons */}
      <div className="sr-only" role="listbox" aria-label="Jams">
        {nodes.map(node => (
          <button
            key={node.id}
            role="option"
            aria-selected={focusedNodeId === node.id}
            aria-label={`${node.name}, ${node.duration}, ${node.key} at ${node.bpm} BPM`}
            onFocus={() => onNodeFocus(node.id)}
            onKeyDown={(e) => handleArrowNavigation(e, node, nodes)}
            onClick={() => onNodeActivate(node.id)}
            tabIndex={focusedNodeId === node.id ? 0 : -1}
          />
        ))}
      </div>
      {/* Live region for announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {focusedNodeId && getNodeAnnouncement(focusedNodeId, nodes)}
      </div>
    </div>
  );
}
```

### Pattern 2: Multi-Axis Dimension Blending via d3-force
**What:** Each dimension (key, tempo, date, instruments, collaborators) maps to a custom d3-force that attracts nodes with similar values. Slider weights control force strength. The dominant axis (highest weight) drives node color.
**When to use:** Spatial maps where multiple attributes drive clustering.
**Example:**
```typescript
// Custom force function for a single dimension
function createDimensionForce(dimension: string, weight: number, nodes: GraphNode[]) {
  // Normalize dimension values to 0-1 range
  const values = nodes.map(n => getDimensionValue(n, dimension));
  const scale = d3.scaleLinear().domain(d3.extent(values)).range([0, 1]);

  // Return force function: similar values attract, dissimilar repel
  return d3.forceX((node) => {
    // Position based on normalized value * weight
    return scale(getDimensionValue(node, dimension)) * canvasWidth;
  }).strength(weight / 100);
}

// Apply forces via react-force-graph ref
useEffect(() => {
  const fg = graphRef.current;
  if (!fg) return;

  // Replace default forces with dimension-weighted custom forces
  fg.d3Force('key', createKeyForce(weights.key, nodes));
  fg.d3Force('tempo', createTempoForce(weights.tempo, nodes));
  fg.d3Force('date', createDateForce(weights.date, nodes));
  // ... etc
  fg.d3ReheatSimulation(); // restart with new forces
}, [weights, nodes]);
```

### Pattern 3: High Contrast via CSS Custom Property Overrides
**What:** Use `@media (prefers-contrast: more)` to override CSS custom properties defined in `:root`. No JavaScript required.
**When to use:** Any time high contrast mode should follow OS setting.
**Example:**
```css
/* In globals.css */
@media (prefers-contrast: more) {
  :root {
    --border: hsl(220 14% 40%);
    --foreground: hsl(0 0% 100%);
    --muted-foreground: hsl(220 10% 70%);
    --card: hsl(220 16% 8%);
    --background: hsl(220 20% 5%);
    /* Spatial map specific */
    --node-stroke-default: hsl(0 0% 60%);
    --edge-line-opacity: 0.6;
  }
}
```

### Pattern 4: Roving Tabindex for Custom Lists
**What:** Only one item in a group has `tabIndex={0}` (the focused item). All others have `tabIndex={-1}`. Arrow keys move focus within the group. Tab moves out of the group entirely.
**When to use:** JamCard lists, tag chip groups, spatial map nodes.
**Example:**
```typescript
function useRovingTabIndex<T extends HTMLElement>(items: string[], activeId: string) {
  const refs = useRef<Map<string, T>>(new Map());

  const handleKeyDown = useCallback((e: React.KeyboardEvent, currentId: string) => {
    const idx = items.indexOf(currentId);
    let nextIdx = idx;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') nextIdx = Math.min(idx + 1, items.length - 1);
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') nextIdx = Math.max(idx - 1, 0);
    if (e.key === 'Home') nextIdx = 0;
    if (e.key === 'End') nextIdx = items.length - 1;

    if (nextIdx !== idx) {
      e.preventDefault();
      refs.current.get(items[nextIdx])?.focus();
    }
  }, [items]);

  return { refs, handleKeyDown, getTabIndex: (id: string) => id === activeId ? 0 : -1 };
}
```

### Anti-Patterns to Avoid
- **Canvas-only interaction without DOM overlay:** Screen readers cannot access Canvas content. Always provide a parallel DOM structure.
- **Using `tabIndex` > 0:** Breaks natural tab order. Use roving tabindex (0 and -1 only).
- **Aria-label on non-interactive elements:** Only use on elements that can receive focus.
- **Force simulation re-initialization on every render:** Use `d3ReheatSimulation()` to restart with new parameters, don't recreate the graph component.
- **Inline style colors without CSS custom properties:** High contrast mode cannot override inline styles. Always use CSS custom properties for colors.
- **Building a custom force-directed layout:** react-force-graph-2d handles the simulation, rendering, and interaction. Use it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force-directed graph | Custom d3-force + Canvas renderer | react-force-graph-2d | Handles rendering, zoom, pan, drag, node interaction, hit testing. Months of work to replicate. |
| macOS login item | Raw LaunchAgent plist management | tauri-plugin-autostart | Cross-platform, handles plist creation/removal, provides JS API for enable/disable/query. |
| Code signing keychain | Manual codesign/notarytool commands | tauri-apps/tauri-action | Handles keychain creation, certificate import, signing, notarization submission, waiting for Apple response, .dmg packaging. |
| Color scales | Manual color interpolation | d3-scale + d3-scale-chromatic | Handles linear, ordinal, sequential scales with proper color space interpolation. Edge cases around hue wrapping. |
| Roving tabindex | Per-component focus logic | Shared useRovingTabIndex hook | Same pattern needed across JamCard list, tag chips, spatial nodes. One hook, many uses. |
| Skip link | Custom focus management | Standard `<a href="#main-content">` pattern | Well-established pattern, 5 lines of CSS, no JavaScript needed. |

**Key insight:** The spatial explorer is visually complex but architecturally simple -- react-force-graph-2d does the heavy lifting. The real complexity is in the accessibility layer (hidden DOM overlay) and the dimension-to-force mapping (d3 scales + custom forces).

## Common Pitfalls

### Pitfall 1: Force Simulation Never Settling
**What goes wrong:** Nodes keep bouncing and never reach a stable layout, especially when dimension weights change.
**Why it happens:** Default `d3AlphaDecay` (0.0228) is tuned for initial layout, not for re-clustering. Reheating without adjusting alpha causes oscillation.
**How to avoid:** After changing dimension weights, call `d3ReheatSimulation()` with a moderate alpha (0.3-0.5), not 1.0. Set `cooldownTicks` to a reasonable value (200-300) so the simulation stops.
**Warning signs:** Nodes visibly vibrating or drifting after sliders stop moving.

### Pitfall 2: Canvas Accessibility Overlay Desync
**What goes wrong:** Hidden DOM buttons don't match canvas node positions. Arrow key "nearest neighbor" navigation points to wrong nodes.
**Why it happens:** Force simulation moves nodes continuously. DOM overlay uses stale positions.
**How to avoid:** Update the overlay node list from the same data source as the canvas. For spatial arrow key navigation, compute nearest neighbor in the dimension space (not pixel space) at keydown time, using current node positions from the force simulation.
**Warning signs:** Screen reader announces wrong jam when arrow keys are pressed.

### Pitfall 3: notarytool Timeout in CI
**What goes wrong:** GitHub Actions job hangs or times out waiting for Apple's notarization response.
**Why it happens:** Apple's notarization service can take 5-15 minutes. Default GitHub Actions step timeout may be too short.
**How to avoid:** Use `tauri-apps/tauri-action` which handles the notarization wait loop. Set step timeout to 30 minutes. The action polls Apple's notarization status.
**Warning signs:** CI workflow timing out at the signing/notarization step.

### Pitfall 4: prefers-contrast Not Firing in WKWebView
**What goes wrong:** The `@media (prefers-contrast: more)` CSS query doesn't respond to macOS "Increase Contrast" setting.
**Why it happens:** WKWebView may not propagate all system accessibility settings to CSS media queries in older macOS versions.
**How to avoid:** Test on macOS Sonoma (14.0+) and Sequoia (15.0+). If WKWebView doesn't propagate, fall back to JavaScript `window.matchMedia('(prefers-contrast: more)')` and apply a CSS class to `<html>`. The HighContrastProvider context handles this fallback.
**Warning signs:** Toggling "Increase Contrast" in System Preferences has no visible effect in the app.

### Pitfall 5: Autostart Plugin LaunchAgent Not Working
**What goes wrong:** `MacosLauncher::LaunchAgent` creates the plist but macOS doesn't actually launch the app on login.
**Why it happens:** Known issue with tauri-plugin-autostart on newer macOS versions. The LaunchAgent plist is created but macOS may not recognize it without proper bundle configuration.
**How to avoid:** Test with actual macOS login/logout cycle, not just `isEnabled()` API call. If LaunchAgent doesn't work reliably, consider using `SMAppService` directly via a custom Rust implementation as a fallback.
**Warning signs:** `isEnabled()` returns true but app doesn't start on login.

### Pitfall 6: Focus Trap Breaks Transport Bar Space Key
**What goes wrong:** Space bar stops toggling play/pause when focus is inside the spatial map or a dialog.
**Why it happens:** The existing global Space keydown handler in TransportBar.tsx may be blocked by focus traps or consumed by other key handlers.
**How to avoid:** Keep the global Space handler at the window level (it already is). Ensure spatial map arrow key handlers call `e.preventDefault()` only for arrow keys, not Space. Dialog focus traps from radix/shadcn already handle Escape but pass through Space to the dialog's own buttons.
**Warning signs:** Space bar does nothing when spatial map has focus.

## Code Examples

### Spatial Canvas with Custom Node Rendering
```typescript
// Source: react-force-graph-2d API docs (github.com/vasturiano/react-force-graph)
import ForceGraph2D from 'react-force-graph-2d';

function SpatialCanvas({ graphData, weights, onNodeClick, onNodeHover }) {
  const fgRef = useRef();

  // Custom node renderer
  const paintNode = useCallback((node, ctx, globalScale) => {
    const isExpanded = node.id === hoveredNodeId || node.id === selectedNodeId;
    const radius = isExpanded ? 48 / globalScale : 12 / globalScale;
    const color = getNodeColor(node, dominantDimension, colorScale);

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

    if (highContrast) {
      // Outlined mode for high contrast
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 / globalScale;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#3D4556';
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();
    }

    // Always show labels in high contrast; only on hover/select otherwise
    if (highContrast || isExpanded) {
      ctx.fillStyle = '#fff';
      ctx.font = `${12 / globalScale}px 'Plus Jakarta Sans'`;
      ctx.textAlign = 'center';
      ctx.fillText(node.name.slice(0, 16), node.x, node.y + radius + 14 / globalScale);
    }
  }, [hoveredNodeId, selectedNodeId, dominantDimension, colorScale, highContrast]);

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={graphData}
      nodeCanvasObject={paintNode}
      nodeCanvasObjectMode={() => 'replace'}
      onNodeClick={onNodeClick}
      onNodeHover={onNodeHover}
      onBackgroundClick={() => setSelectedNodeId(null)}
      cooldownTicks={300}
      d3AlphaDecay={0.02}
      backgroundColor="#151921"
    />
  );
}
```

### Dimension Weight to d3 Color Scale
```typescript
// Source: d3 7.x API docs
import * as d3 from 'd3';

// Circle-of-fifths hue mapping for Key dimension
function createKeyColorScale(): d3.ScaleOrdinal<string, string> {
  const keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
  const hues = keys.map((_, i) => `hsl(${(i * 30) % 360}, 70%, 55%)`);
  return d3.scaleOrdinal<string, string>().domain(keys).range(hues);
}

// Tempo gradient: blue (slow) to red (fast)
function createTempoColorScale(): d3.ScaleLinear<string, string> {
  return d3.scaleLinear<string>()
    .domain([40, 120, 200])
    .range(['hsl(220, 60%, 50%)', 'hsl(30, 70%, 55%)', 'hsl(0, 80%, 55%)']);
}

// Date gradient: faded grey-blue (old) to accent amber (new)
function createDateColorScale(minDate: Date, maxDate: Date): d3.ScaleTime<string, string> {
  return d3.scaleTime<string>()
    .domain([minDate, maxDate])
    .range(['hsl(220, 10%, 35%)', 'hsl(28, 90%, 58%)']);
}
```

### Tauri Autostart Integration
```typescript
// Source: v2.tauri.app/plugin/autostart/
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

async function handleAutoLaunchToggle(enabled: boolean) {
  if (enabled) {
    await enable();
  } else {
    await disable();
  }
}

// Check on first launch for dialog
async function checkFirstLaunch(): Promise<boolean> {
  // Read from settings whether first-launch dialog has been shown
  const settings = await getSettings();
  return !settings.autoLaunchDialogShown;
}
```

### GitHub Actions Signing Workflow (macOS)
```yaml
# Source: v2.tauri.app/distribute/sign/macos/ + dev.to/tomtomdu73
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin

      - name: Install dependencies
        run: npm ci

      - name: Import Apple Developer Certificate
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
        run: |
          echo $APPLE_CERTIFICATE | base64 --decode > certificate.p12
          security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
          security set-keychain-settings -t 3600 -u build.keychain
          security import certificate.p12 -k build.keychain \
            -P "$APPLE_CERTIFICATE_PASSWORD" \
            -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: \
            -s -k "$KEYCHAIN_PASSWORD" build.keychain

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Wallflower v__VERSION__'
          releaseBody: 'See the changelog for details.'
          releaseDraft: true
          args: --target aarch64-apple-darwin
```

## Data Flow for Spatial Explorer

The spatial map needs data that already exists in the backend:

1. **Jam list:** `GET /api/jams` returns `JamRecord[]` with `id`, `filename`, `durationSeconds`, `importedAt`, `createdAt`
2. **Analysis per jam:** `GET /api/jams/:id/analysis` returns `AnalysisResults` with `tempo` (bpm), `key` (keyName, scale), `sections`, `loops`
3. **Metadata per jam:** Tags, collaborators, instruments available via existing API endpoints
4. **Filter options:** `GET /api/jams/filter-options` returns distinct keys, tags, collaborators, instruments, tempo range

**New API needed:** A single endpoint `GET /api/jams/spatial` that returns all jams with their analysis results, tags, collaborators, and instruments in one response. This avoids N+1 queries (one per jam for analysis). The frontend transforms this into react-force-graph's `{ nodes: [...], links: [...] }` format.

**Graph data computation (frontend):**
- Nodes: one per jam with analysis metadata attached
- Links: optional -- similarity edges between jams. Could be computed client-side from dimension proximity, or omitted entirely (force simulation can cluster without explicit links by using custom position forces).

**Recommendation:** Skip explicit links. Use only positional forces (d3.forceX + d3.forceY per dimension). This simplifies the data model and avoids O(n^2) link computation. Nodes cluster naturally when similar jams are attracted to similar positions.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Canvas with fallback text | Hidden DOM overlay + ARIA | WCAG 2.2 (2023) | Canvas apps can be fully accessible with parallel DOM |
| aria-live="assertive" | aria-live="polite" for most cases | ARIA 1.2 | Polite doesn't interrupt; assertive should be rare |
| Manual codesign + notarytool | tauri-apps/tauri-action | 2024 | Single action handles full sign+notarize+package flow |
| LaunchAgent plist | SMAppService (macOS 13+) | 2022 | Better OS integration, shows in Login Items settings |

**Deprecated/outdated:**
- Tauri v1 signing (different configuration format, different action)
- `altool` for notarization (replaced by `notarytool` in Xcode 14+)
- `xcrun altool --notarize-app` (use `xcrun notarytool submit`)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build | Check at execution | -- | -- |
| Rust toolchain | Tauri build | Check at execution | -- | -- |
| Apple Developer cert | INFRA-14 | Per D-12: Yes | -- | Ad-hoc signing (users must allow in Privacy) |
| GitHub Actions | INFRA-14 | Yes (GitHub repo) | -- | Manual local signing |
| macOS 13+ | SMAppService | Target platform | -- | LaunchAgent fallback |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Rust: `cargo test` (inline #[cfg(test)]); Frontend: none currently installed |
| Config file | Rust: inline; Frontend: none |
| Quick run command | `cargo test -p wallflower-core` |
| Full suite command | `cargo test --workspace` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAY-04 | Spatial map renders with clustered nodes | manual | Visual verification in app | N/A |
| PLAY-04 | Dimension weight change re-clusters nodes | manual | Visual verification in app | N/A |
| PLAY-04 | Node click navigates to jam detail | manual | Click through in app | N/A |
| DES-02 | Tab key navigates all interactive elements | manual | Tab through entire app | N/A |
| DES-02 | Arrow keys navigate within component groups | manual | Keyboard test in app | N/A |
| DES-03 | Screen reader announces all elements | manual | VoiceOver test on macOS | N/A |
| DES-04 | High contrast mode activates from system setting | manual | Toggle in System Preferences | N/A |
| INFRA-13 | Auto-launch enable/disable works | manual | Toggle in Settings, restart Mac | N/A |
| INFRA-14 | Signed .dmg opens without Gatekeeper warning | manual | Download and open on clean Mac | N/A |
| PLAY-04 | Spatial data API returns all jams with analysis | unit | `cargo test -p wallflower-core spatial` | No -- Wave 0 |
| DES-04 | High contrast CSS variables override correctly | unit | Frontend test (if framework added) | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cargo test --workspace` (Rust only, ~30s)
- **Per wave merge:** Full manual accessibility audit of modified components
- **Phase gate:** VoiceOver walkthrough of entire app + signed .dmg test install

### Wave 0 Gaps
- [ ] `crates/wallflower-core/src/db/mod.rs` -- add spatial data query function + test
- [ ] Frontend test framework not installed -- accessibility testing is primarily manual (VoiceOver)
- [ ] GitHub Actions workflow does not exist yet (`/.github/workflows/`) -- needs creation

## Project Constraints (from CLAUDE.md)

- **Tech stack:** Tauri v2 native macOS app, Rust backend, React/Next.js frontend (static export), Python sidecar
- **Database:** SQLite via rusqlite, WAL mode, PRAGMA user_version migrations
- **State management:** zustand for client state, @tanstack/react-query for server state
- **Styling:** Tailwind CSS 4.x with shadcn/radix primitives
- **Navigation:** Current page.tsx uses conditional rendering (not proper tabs). Phase 6 must refactor to tab-based navigation.
- **Existing ARIA:** shadcn/radix components have baseline ARIA. Buttons already have aria-labels. Transport bar has some keyboard handling (Space for play/pause).
- **Tauri config:** `com.wallflower.app` identifier already set. Capabilities in `capabilities/default.json` need autostart permissions added.
- **No .github/workflows:** CI/CD must be created from scratch.
- **Testing:** CLAUDE.md says "Full test coverage across all components" but no frontend test framework is installed. Accessibility testing will be primarily manual (VoiceOver).
- **Licensing:** MIT -- all new dependencies must be compatible (react-force-graph-2d is MIT, d3 is ISC, tauri-plugin-autostart is MIT/Apache-2.0).

## Sources

### Primary (HIGH confidence)
- [react-force-graph-2d API](https://github.com/vasturiano/react-force-graph) - Full API reference, nodeCanvasObject, d3Force, interaction callbacks
- [Tauri v2 Autostart Plugin](https://v2.tauri.app/plugin/autostart/) - Installation, Rust init, JS API, permissions
- [Tauri v2 macOS Code Signing](https://v2.tauri.app/distribute/sign/macos/) - Certificate setup, env vars, CI/CD configuration
- [MDN prefers-contrast](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast) - CSS media query specification and browser support
- npm registry - react-force-graph-2d 1.29.1, d3 7.9.0, d3-scale 4.0.2, @tauri-apps/plugin-autostart 2.5.1

### Secondary (MEDIUM confidence)
- [Ship Tauri v2 App: GitHub Actions](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-github-actions-and-release-automation-part-22-2ef7) - Complete workflow structure, Feb 2026
- [Ship Tauri v2 App: Code Signing](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-code-signing-for-macos-and-windows-part-12-3o9n) - Certificate export, signing identity
- [Shipping Production macOS App with Tauri 2.0](https://dev.to/0xmassi/shipping-a-production-macos-app-with-tauri-20-code-signing-notarization-and-homebrew-mc3) - Real-world production experience
- [Rust App Start on Login macOS](https://www.gethopp.app/blog/rust-app-start-on-login) - SMAppService vs LaunchAgent comparison
- [Using Increased Contrast Mode CSS](https://www.tempertemper.net/blog/using-the-increased-contrast-mode-css-media-query) - macOS Increase Contrast detection

### Tertiary (LOW confidence)
- [tauri-plugin-autostart GitHub issue #634](https://github.com/tauri-apps/plugins-workspace/issues/634) - LaunchAgent reliability issues on macOS (needs validation during implementation)

## Open Questions

1. **WKWebView prefers-contrast support**
   - What we know: Standard browsers support it. Tauri uses WKWebView.
   - What's unclear: Whether WKWebView in Tauri propagates macOS "Increase Contrast" to CSS media queries.
   - Recommendation: Test early in implementation. If not supported, use HighContrastProvider with JS matchMedia fallback.

2. **Spatial data API performance at scale**
   - What we know: Current `list_jams` + per-jam analysis queries would be N+1.
   - What's unclear: At what library size (100? 500? 1000 jams?) does this become a problem.
   - Recommendation: Build the `GET /api/jams/spatial` batch endpoint from the start. Single query joining jams + analysis + metadata.

3. **LaunchAgent vs SMAppService reliability**
   - What we know: tauri-plugin-autostart uses LaunchAgent by default. Some users report it doesn't actually work on newer macOS.
   - What's unclear: Whether this is fixed in the current plugin version.
   - Recommendation: Use LaunchAgent initially (it's what the plugin supports). Test on macOS Sequoia. If broken, investigate `smappservice-rs` as alternative.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-force-graph-2d and d3 are well-established, versions verified via npm
- Architecture: HIGH - Hidden DOM overlay is a proven canvas accessibility pattern, force simulation customization is documented
- Accessibility: MEDIUM - prefers-contrast in WKWebView needs validation; roving tabindex patterns are well-established
- Distribution: HIGH - Tauri signing docs are comprehensive, multiple production examples available
- Autostart: MEDIUM - Known issues with LaunchAgent on newer macOS, needs runtime testing
- Pitfalls: HIGH - Based on documented issues and common patterns

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stable ecosystem, 30-day validity)
