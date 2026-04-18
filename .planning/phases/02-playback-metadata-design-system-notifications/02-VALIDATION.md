---
phase: 2
slug: playback-metadata-design-system-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Rust)** | cargo test (built-in, existing tests in wallflower-core) |
| **Framework (Frontend)** | vitest (Wave 0 installs) |
| **Config file (Rust)** | Standard Cargo.toml test config |
| **Config file (Frontend)** | vitest.config.ts (Wave 0 creates) |
| **Quick run command** | `cargo test -p wallflower-core` |
| **Full suite command** | `cargo test --workspace && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test -p wallflower-core`
- **After every plan wave:** Run `cargo test --workspace && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | PLAY-01 | unit | `cargo test -p wallflower-core peaks` | No | ⬜ pending |
| 02-01-02 | 01 | 0 | META-01..07 | unit | `cargo test -p wallflower-core metadata` | No | ⬜ pending |
| 02-01-03 | 01 | 0 | META-06 | unit | `cargo test -p wallflower-core photos` | No | ⬜ pending |
| 02-01-04 | 01 | 0 | PLAY-03 | unit | `npx vitest run --filter timeline` | No | ⬜ pending |
| 02-02-01 | 02 | 1 | PLAY-02 | manual | Manual: verify seeking in WebView | N/A | ⬜ pending |
| 02-02-02 | 02 | 1 | PLAY-05 | manual | Manual: import while playing | N/A | ⬜ pending |
| 02-03-01 | 03 | 1 | META-09 | manual | Manual: verify auto-save timing | N/A | ⬜ pending |
| 02-03-02 | 03 | 1 | DES-01 | visual | Manual: visual review against UI-SPEC | N/A | ⬜ pending |
| 02-04-01 | 04 | 2 | INFRA-11 | manual | Manual: trigger import, check notification | N/A | ⬜ pending |
| 02-04-02 | 04 | 2 | META-07 | integration | `cargo test -p wallflower-core patches_watcher` | No | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `crates/wallflower-core/src/peaks.rs` — peak generation unit tests (PLAY-01)
- [ ] `crates/wallflower-core/src/db/mod.rs` — metadata CRUD tests: tags, collaborators, instruments, photos (META-01..07)
- [ ] `crates/wallflower-core/src/photos.rs` — photo storage + thumbnail tests (META-06)
- [ ] Frontend test framework: `npm install -D vitest @testing-library/react @testing-library/jest-dom`
- [ ] `vitest.config.ts` — frontend test configuration
- [ ] Migration tracking system (schema_version table or equivalent)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audio seeking in 120-min file | PLAY-02 | Requires WKWebView + asset protocol | Import 120-min WAV, scrub to middle, verify playback starts at seek position |
| Playback during background import | PLAY-05 | Requires concurrent Tauri state | Start playback, import new file, verify no interruption |
| Live-save timing | META-09 | UI debounce behavior | Edit notes, wait 1s, refresh page, verify notes persisted |
| Design language matches UI-SPEC | DES-01 | Visual comparison | Compare rendered app against UI-SPEC colors, spacing, typography |
| Native macOS notification | INFRA-11 | Requires macOS notification permission | Import a file, verify notification appears in Notification Center |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
