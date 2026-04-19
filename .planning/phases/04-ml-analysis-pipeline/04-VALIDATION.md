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
| 04-01-01 | 01 | 1 | AI-08 | unit (Python) | `cd sidecar && uv run pytest tests/test_provider.py -x` | Wave 0 | pending |
| 04-02-01 | 02 | 1 | AI-09 | unit (Rust) | `~/.cargo/bin/cargo test -p wallflower-core --lib` | Wave 0 | pending |
| 04-03-01 | 03 | 2 | AI-01 | unit (Python) | `cd sidecar && uv run pytest tests/test_tempo.py -x` | Wave 0 | pending |
| 04-03-02 | 03 | 2 | AI-02 | unit (Python) | `cd sidecar && uv run pytest tests/test_key.py -x` | Wave 0 | pending |
| 04-03-03 | 03 | 2 | AI-03 | unit (Python) | `cd sidecar && uv run pytest tests/test_sections.py -x` | Wave 0 | pending |
| 04-03-04 | 03 | 2 | AI-05 | unit (Python) | `cd sidecar && uv run pytest tests/test_loops.py -x` | Wave 0 | pending |
| 04-03-05 | 03 | 2 | AI-07 | unit (Python) | `cd sidecar && uv run pytest tests/test_models.py -x` | Wave 0 | pending |
| 04-04-01 | 04 | 2 | AI-06 | compilation | `~/.cargo/bin/cargo check -p wallflower-app` | N/A | pending |
| 04-04-02 | 04 | 2 | AI-06 | unit (Python) | `cd sidecar && uv run pytest tests/ -x` (server tests cover gRPC streaming) | Wave 0 | pending |
| 04-05-01 | 05 | 3 | META-08 | unit (Rust) | `~/.cargo/bin/cargo test -p wallflower-core filter_search` | Wave 0 | pending |
| 04-05-02 | 05 | 3 | META-08 | typecheck | `npx tsc --noEmit` | N/A | pending |
| 04-06-01 | 06 | 3 | AI-06 | typecheck | `npx tsc --noEmit` | N/A | pending |
| 04-06-02 | 06 | 3 | AI-09 | manual | Start app, verify recording works while models download | N/A | pending |

*Status: pending / green / red / flaky*

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

## AI-06 Coverage Note

AI-06 (progressive analysis results via Tauri events) is covered by:
1. **Python server tests (Plan 03):** Verify gRPC streaming works correctly with STARTED/COMPLETED/FAILED/SKIPPED status per step
2. **Rust compilation check (Plan 04):** Verify Tauri event emission code compiles with correct types
3. **Manual verification (Plan 06 checkpoint):** Full end-to-end progressive UI flow

A dedicated Rust integration test for gRPC streaming (`cargo test grpc_streaming`) is not included because it would require a running Python sidecar process during `cargo test`, adding significant complexity. The gRPC contract is tested at both ends (Python server tests + Rust compilation) with manual end-to-end verification.

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
