---
phase: 4
slug: ml-analysis-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Rust)** | cargo test (built-in) |
| **Framework (Python)** | pytest |
| **Config file (Rust)** | Cargo.toml (existing) |
| **Config file (Python)** | sidecar/pyproject.toml (Wave 0) |
| **Quick run command (Rust)** | `~/.cargo/bin/cargo test -p wallflower-core --lib` |
| **Quick run command (Python)** | `cd sidecar && uv run pytest tests/ -x` |
| **Full suite command** | `~/.cargo/bin/cargo test --workspace && cd sidecar && uv run pytest tests/` |
| **Estimated runtime** | ~30 seconds (Rust) + ~15 seconds (Python unit) |

---

## Sampling Rate

- **After every task commit:** Run quick command for affected component (Rust or Python)
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | AI-01 | unit (Python) | `cd sidecar && uv run pytest tests/test_tempo.py -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | AI-02 | unit (Python) | `cd sidecar && uv run pytest tests/test_key.py -x` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | AI-03 | unit (Python) | `cd sidecar && uv run pytest tests/test_sections.py -x` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | AI-05 | unit (Python) | `cd sidecar && uv run pytest tests/test_loops.py -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | AI-06 | integration | `~/.cargo/bin/cargo test -p wallflower-app grpc_streaming` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | AI-07 | unit (Python) | `cd sidecar && uv run pytest tests/test_models.py -x` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | AI-08 | unit (Python) | `cd sidecar && uv run pytest tests/test_provider.py -x` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | AI-09 | integration | Manual: start app, verify recording works while models download | N/A | ⬜ pending |
| 04-03-02 | 03 | 3 | META-08 | unit (Rust) | `~/.cargo/bin/cargo test -p wallflower-core filter_search` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `sidecar/pyproject.toml` — Python project setup with uv, all dependencies
- [ ] `sidecar/tests/conftest.py` — shared fixtures (test audio file generation)
- [ ] `sidecar/tests/test_tempo.py` — AI-01 coverage
- [ ] `sidecar/tests/test_key.py` — AI-02 coverage
- [ ] `sidecar/tests/test_sections.py` — AI-03 coverage
- [ ] `sidecar/tests/test_loops.py` — AI-05 coverage
- [ ] `sidecar/tests/test_provider.py` — AI-08 coverage
- [ ] `sidecar/tests/test_models.py` — AI-07 coverage
- [ ] `proto/wallflower_analysis.proto` — gRPC service definition
- [ ] `brew install uv protobuf` — environment dependencies
- [ ] `uv python install 3.13` — compatible Python version
- [ ] `migrations/V4__analysis_tables.sql` — analysis result schema
- [ ] Rust test fixtures for analysis DB operations

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Models download in background without blocking app | AI-09 | Requires full app running with network | Start app fresh, verify recording/browsing works while models download in background |
| Progressive analysis results appear in UI | AI-06 | Requires visual verification of UI updates | Import a jam, observe badges populating progressively on jam card and detail view |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
