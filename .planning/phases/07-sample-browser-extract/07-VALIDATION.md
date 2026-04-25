---
phase: 7
slug: sample-browser-extract
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + cargo test (backend) |
| **Config file** | `frontend/vitest.config.ts` / `Cargo.toml` |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cargo test --workspace && cd frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cargo test --workspace && cd frontend && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PLAY-04 | — | N/A | integration | `cargo test --workspace` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | PLAY-04 | — | N/A | unit | `cd frontend && npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Backend test stubs for cross-jam sample query endpoints
- [ ] Frontend test stubs for sample browser component rendering

*Existing infrastructure covers test framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Waveform preview renders correctly | PLAY-04 | Visual rendering verification | Select a sample in browser, verify waveform appears in preview panel with scrubbing |
| Sort columns respond to click | PLAY-04 | UI interaction | Click each column header, verify sort order changes |
| Export triggers download | PLAY-04 | File system side effect | Click Export Audio, verify file appears in export folder |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
