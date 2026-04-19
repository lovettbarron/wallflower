---
phase: 3
slug: recording-engine-system-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cargo test (Rust) / vitest (frontend) |
| **Config file** | Cargo.toml / vitest.config.ts |
| **Quick run command** | `cargo test -p wallflower-core --lib && npx vitest run --reporter=verbose` |
| **Full suite command** | `cargo test --workspace && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test -p wallflower-core --lib && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cargo test --workspace && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | REC-01 | unit | `cargo test -p wallflower-core recording` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | REC-02 | unit | `cargo test -p wallflower-core wav_writer` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | REC-03 | unit | `cargo test -p wallflower-core device` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | REC-04 | unit | `cargo test -p wallflower-core dropout` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | REC-05 | unit | `cargo test -p wallflower-core recovery` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | REC-06 | integration | `cargo test -p wallflower-core scheduler` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 2 | REC-07, REC-08 | unit | `cargo test -p wallflower-core priority` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | REC-09 | unit | `npx vitest run src/components/recording` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | INFRA-10 | integration | `cargo test -p wallflower-app tray` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 2 | INFRA-12 | integration | `cargo test -p wallflower-app shortcut` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `crates/wallflower-core/src/recording/tests/` — test stubs for recording engine (REC-01 through REC-08)
- [ ] `src/components/recording/__tests__/` — test stubs for recording UI (REC-09)
- [ ] `crates/wallflower-app/tests/` — integration test stubs for tray and shortcuts (INFRA-10, INFRA-12)

*Existing test infrastructure from Phase 1/2 covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audio capture from real hardware | REC-01 | Requires physical audio interface | Connect Zoom F3 via USB, start recording, verify WAV file contains audio |
| USB disconnect/reconnect | REC-04 | Requires physical cable manipulation | Unplug USB interface during recording, verify session stays open, replug, verify recording resumes |
| System tray icon updates | INFRA-10 | Requires macOS GUI interaction | Start recording, verify tray icon changes to recording state, verify menu shows elapsed time |
| Global hotkey when unfocused | INFRA-12 | Requires macOS focus switching | Switch to another app, press Cmd+Shift+R, verify recording starts in Wallflower |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
