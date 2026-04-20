---
phase: 5
slug: source-separation-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Rust)** | cargo test (built-in) |
| **Framework (Python)** | pytest 8.x |
| **Framework (Frontend)** | Manual testing (no frontend test framework yet) |
| **Quick run command** | `cargo test -p wallflower-core` |
| **Full suite command** | `cargo test --workspace && cd sidecar && uv run pytest tests/` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test -p wallflower-core`
- **After every plan wave:** Run `cargo test --workspace && cd sidecar && uv run pytest tests/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | EXP-01 | unit | `cargo test -p wallflower-core bookmark` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | EXP-02 | unit | `cargo test -p wallflower-core export` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | EXP-04 | unit | `cargo test -p wallflower-core export::folder` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | EXP-05 | unit | `cargo test -p wallflower-core export::sidecar` | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | EXP-06 | unit | `cargo test -p wallflower-core audio::downsample` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 2 | AI-04 | integration | `cd sidecar && uv run pytest tests/test_separation.py -x` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | AI-10 | integration | `cd sidecar && uv run pytest tests/test_separation.py::test_chunked_memory -x` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 3 | EXP-03 | integration | Manual (requires demucs model) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `crates/wallflower-core/src/bookmarks/` module with tests — bookmark CRUD (EXP-01)
- [ ] `crates/wallflower-core/src/export/` module with tests — export writer, folder structure, sidecar generation (EXP-02, EXP-04, EXP-05)
- [ ] `sidecar/tests/test_separation.py` — SeparationAnalyzer unit tests with mock demucs, chunking logic (AI-04, AI-10)
- [ ] `migrations/V5__bookmarks_exports.sql` — schema migration

*Existing infrastructure covers EXP-06 (downsample tests already exist).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stem export produces correct stem files | EXP-03 | Requires demucs model download (~1.5GB) | 1. Import a short audio file, 2. Create bookmark, 3. Click "Export stems", 4. Verify 4 stem WAV files in export folder |
| Bookmark snap-assist to section boundaries | EXP-01 (D-02) | Visual behavior on waveform | 1. Open jam with analysis, 2. Drag bookmark edge near section boundary, 3. Verify edge snaps, 4. Hold Option key, verify no snap |
| Stem mixer synchronized playback | EXP-03 (D-10) | Audio synchronization | 1. Separate a bookmark, 2. Open mixer, 3. Play all stems, 4. Solo individual stems, 5. Verify no drift or phase issues |
| Recording pauses separation | AI-10 (D-14) | Requires real audio I/O | 1. Start stem export, 2. Start recording during separation, 3. Verify separation pauses, 4. Stop recording, 5. Verify separation resumes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
