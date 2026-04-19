# Phase 4: ML Analysis Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 04-ml-analysis-pipeline
**Areas discussed:** Analysis results in the UI, Python sidecar lifecycle, Model management UX, Search & filter experience, Analysis queue behavior, Re-analysis & corrections, Loop detection display, Hardware adaptation

---

## Analysis Results in the UI

### Card Badges
| Option | Description | Selected |
|--------|-------------|----------|
| Always show slots | Key and BPM badges always visible, "--" placeholders when pending | :white_check_mark: |
| Show only when ready | Badges appear only after analysis completes | |
| Animated reveal | Badges fade/slide in when results arrive | |

**User's choice:** Always show slots
**Notes:** Recommended option. Prevents layout shift.

### Section Boundaries
| Option | Description | Selected |
|--------|-------------|----------|
| Colored vertical lines with labels | Vertical dividers with short labels, colors by section type | :white_check_mark: |
| Background color bands | Colored background regions spanning the waveform | |
| Markers above the waveform | Dedicated lane above waveform for markers | |

**User's choice:** Colored vertical lines with labels
**Notes:** Consistent with Ableton arrangement markers.

### Analysis Progress
| Option | Description | Selected |
|--------|-------------|----------|
| Subtle status badge + detail panel | "Analyzing..." on card, detailed steps in detail view | :white_check_mark: |
| Global analysis queue view | Dedicated panel for all pending analyses | |
| Toast notifications only | Toast when analysis completes, no persistent indicator | |

**User's choice:** Subtle status badge on card + detail panel

### Detail View Info
| Option | Description | Selected |
|--------|-------------|----------|
| Compact summary row | Single row of chips: Key, BPM, Section count, Loop count | :white_check_mark: |
| Expanded analysis panel | Collapsible section with full details | |
| You decide | Claude chooses | |

**User's choice:** Compact summary row

---

## Python Sidecar Lifecycle

### Sidecar Start
| Option | Description | Selected |
|--------|-------------|----------|
| On first analysis request | Lazy start, app starts faster | :white_check_mark: |
| On app launch | Always running, ready immediately | |
| User-triggered | Manual toggle/button | |

**User's choice:** On first analysis request

### Crash Policy
| Option | Description | Selected |
|--------|-------------|----------|
| Auto-restart + retry failed job | Restart sidecar, re-queue failed analysis, max 3 retries | :white_check_mark: |
| Auto-restart, skip failed job | Restart but skip problematic file | |
| You decide | Claude picks | |

**User's choice:** Auto-restart + retry failed job

### Idle Policy
| Option | Description | Selected |
|--------|-------------|----------|
| Stay alive while app running | Once started, stays up until app quits | :white_check_mark: |
| Shut down after idle timeout | Kill after 5 min idle | |
| You decide | Claude picks | |

**User's choice:** Stay alive while app is running

### Pipeline Execution
| Option | Description | Selected |
|--------|-------------|----------|
| Sequential per jam | tempo -> key -> sections -> loops, one at a time | :white_check_mark: |
| Parallel steps per jam | Run all steps simultaneously | |
| You decide | Claude picks | |

**User's choice:** Sequential per jam

---

## Model Management UX

### Download Experience
| Option | Description | Selected |
|--------|-------------|----------|
| Background download with Settings progress | Download on first request, progress in Settings | :white_check_mark: |
| First-launch setup wizard | Blocking setup screen | |
| Inline status in analysis badge | Progress shown in analysis badge | |

**User's choice:** Background download with progress in Settings

### Model Visibility
| Option | Description | Selected |
|--------|-------------|----------|
| Transparent but hands-off | Settings shows models/versions/disk, no manual control | :white_check_mark: |
| Model picker | Users choose between model variants | |
| Fully hidden | No model info visible | |

**User's choice:** Transparent but hands-off

---

## Search & Filter Experience

### Filter UX
| Option | Description | Selected |
|--------|-------------|----------|
| Filter bar with dropdowns | Horizontal bar with Key, Tempo, Tags, etc. AND logic, chip display | :white_check_mark: |
| Search box with smart parsing | Single field parsing "Bb minor 120bpm drums" | |
| Sidebar filter panel | Collapsible left sidebar with checkboxes/sliders | |

**User's choice:** Filter bar with dropdowns

### Tempo Filter
| Option | Description | Selected |
|--------|-------------|----------|
| Range slider | Dual-handle slider for BPM range | :white_check_mark: |
| Preset tempo buckets | Predefined ranges (Slow, Medium, Fast) | |
| Exact value with tolerance | Type BPM + tolerance | |

**User's choice:** Range slider

### Key Filter
| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown with all keys | Dropdown listing all detected keys, multi-select | :white_check_mark: |
| Circle of fifths picker | Visual circle-of-fifths selector | |
| Compatible keys grouping | Auto-include harmonically compatible keys | |

**User's choice:** Dropdown with all keys

### Text Search
| Option | Description | Selected |
|--------|-------------|----------|
| Yes, for notes and tags | Search box matching notes, tags, collaborators, instruments, filenames | :white_check_mark: |
| No, filters only | Structured filters sufficient | |
| You decide | Claude determines | |

**User's choice:** Yes, for notes and tags

---

## Analysis Queue Behavior

### Queue Ordering
| Option | Description | Selected |
|--------|-------------|----------|
| Currently-viewed jam first | Viewed jam jumps to front, otherwise FIFO | :white_check_mark: |
| Newest first | Most recently imported first | |
| Strict FIFO | First in, first out | |

**User's choice:** Currently-viewed jam first

### Recording Pause Behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Interrupt and re-queue | Stop immediately, re-queue at front, restart from scratch after recording | :white_check_mark: |
| Let current step finish | Allow current step to complete before pausing | |
| You decide | Claude picks | |

**User's choice:** Interrupt and re-queue

---

## Re-analysis & Corrections

### Manual Overrides
| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with AI vs manual indicator | Users can edit key/BPM, UI shows source (AI/manual), manual never overwritten | :white_check_mark: |
| No overrides in v1 | Results read-only | |
| You decide | Claude determines | |

**User's choice:** Yes, with clear AI vs manual indicator

### Re-analysis
| Option | Description | Selected |
|--------|-------------|----------|
| Yes, via button in jam detail | Re-analyze action re-runs full pipeline, respects manual overrides | :white_check_mark: |
| Automatic on model update only | Re-analysis only on model version change | |
| You decide | Claude picks | |

**User's choice:** Yes, via a button in jam detail

---

## Loop Detection Display

| Option | Description | Selected |
|--------|-------------|----------|
| Bracketed regions with repeat count | Like sheet music repeat brackets, shows count and evolution | :white_check_mark: |
| Color-coded matching regions | Same color for similar sections | |
| List view below waveform | Table with timestamps and counts | |

**User's choice:** Bracketed regions with repeat count

---

## Hardware Adaptation

### Low-Power Support
| Option | Description | Selected |
|--------|-------------|----------|
| Graceful degradation | Runs on any hardware, slower on weaker machines, optional lightweight mode | :white_check_mark: |
| Hardware detection with feature gating | Disable/simplify features on weaker hardware | |
| Same pipeline, user manages expectations | No special handling | |

**User's choice:** Graceful degradation
**Notes:** User has both M4 Mac Mini and M1 MacBook Air.

### Analysis Profiles
| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect with manual override | App detects hardware, sets default profile (Full/Standard/Lightweight), user can override in Settings | :white_check_mark: |
| Always full, no tiers | Same pipeline everywhere | |
| You decide | Claude determines | |

**User's choice:** Auto-detect with manual override

---

## Claude's Discretion

- gRPC service definition and protobuf message design
- SSE vs Tauri event channel for streaming analysis results
- Analysis step ordering within sequential pipeline
- Hardware detection method and profile thresholds
- Model download/versioning implementation
- SQLite schema migration design
- Filter bar component implementation
- Loop evolution detection algorithm

## Deferred Ideas

None -- discussion stayed within phase scope
