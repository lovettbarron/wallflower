---
phase: 6
slug: spatial-explorer-accessibility-distribution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Rust: `cargo test` (inline #[cfg(test)]); Frontend: manual (VoiceOver, visual) |
| **Config file** | Rust: inline; Frontend: none |
| **Quick run command** | `cargo test -p wallflower-core` |
| **Full suite command** | `cargo test --workspace` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test --workspace`
- **After every plan wave:** Full manual accessibility audit of modified components
- **Before `/gsd:verify-work`:** Full suite must be green + VoiceOver walkthrough + signed .dmg test install
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | PLAY-04 | unit | `cargo test -p wallflower-core spatial` | No -- Wave 0 | ⬜ pending |
| 06-01-02 | 01 | 1 | PLAY-04 | manual | Visual verification in app | N/A | ⬜ pending |
| 06-02-01 | 02 | 1 | DES-02 | manual | Tab through entire app | N/A | ⬜ pending |
| 06-02-02 | 02 | 1 | DES-02 | manual | Keyboard test in app | N/A | ⬜ pending |
| 06-02-03 | 02 | 1 | DES-03 | manual | VoiceOver test on macOS | N/A | ⬜ pending |
| 06-02-04 | 02 | 1 | DES-04 | manual | Toggle in System Preferences | N/A | ⬜ pending |
| 06-03-01 | 03 | 2 | INFRA-13 | manual | Toggle in Settings, restart Mac | N/A | ⬜ pending |
| 06-03-02 | 03 | 2 | INFRA-14 | manual | Download and open on clean Mac | N/A | ⬜ pending |
| 06-03-03 | 03 | 2 | DES-04 | unit | Frontend test (if framework added) | No -- Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `crates/wallflower-core/src/db/mod.rs` -- add spatial data query function + test
- [ ] Frontend test framework not installed -- accessibility testing is primarily manual (VoiceOver)
- [ ] GitHub Actions workflow does not exist yet (`.github/workflows/`) -- needs creation

*Existing Rust test infrastructure covers backend requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Spatial map renders with clustered nodes | PLAY-04 | Visual layout verification | Open Explore tab, verify jams cluster by musical similarity |
| Dimension weight change re-clusters nodes | PLAY-04 | Visual animation verification | Adjust sliders, verify node positions update |
| Node click navigates to jam detail | PLAY-04 | Navigation flow verification | Click a node, verify jam detail view opens |
| Tab navigates all interactive elements | DES-02 | Keyboard interaction | Tab through entire app, verify all elements reachable |
| Arrow keys navigate within groups | DES-02 | Keyboard interaction | Use arrows in timeline, waveform, spatial map |
| Screen reader announces all elements | DES-03 | VoiceOver integration | Enable VoiceOver, navigate entire app |
| High contrast mode activates from system | DES-04 | System setting integration | Toggle macOS Increase Contrast, verify app updates |
| Auto-launch enable/disable works | INFRA-13 | System restart required | Toggle in Settings, restart Mac, verify launch |
| Signed .dmg opens without Gatekeeper warning | INFRA-14 | Security framework validation | Download .dmg, open on clean Mac |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
