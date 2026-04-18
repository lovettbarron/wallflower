---
phase: 1
slug: tauri-app-shell-storage-api-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cargo test (Rust) + vitest (React/Next.js) |
| **Config file** | Cargo.toml (workspace) / vitest.config.ts |
| **Quick run command** | `cargo test --workspace -- --quiet` |
| **Full suite command** | `cargo test --workspace && cd src-next && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test --workspace -- --quiet`
- **After every plan wave:** Run `cargo test --workspace && cd src-next && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | INFRA-01 | build | `cargo build --workspace` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | INFRA-09 | build | `cargo tauri build --debug` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | STOR-01 | unit | `cargo test --package wallflower-core db_` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | STOR-02 | unit | `cargo test --package wallflower-core import_` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | STOR-03 | unit | `cargo test --package wallflower-core metadata_` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | STOR-04 | unit | `cargo test --package wallflower-core search_` | ❌ W0 | ⬜ pending |
| 01-02-05 | 02 | 2 | STOR-05 | unit | `cargo test --package wallflower-core watch_` | ❌ W0 | ⬜ pending |
| 01-02-06 | 02 | 2 | STOR-06 | unit | `cargo test --package wallflower-core device_` | ❌ W0 | ⬜ pending |
| 01-02-07 | 02 | 2 | STOR-07 | unit | `cargo test --package wallflower-core safe_write_` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | INFRA-02 | integration | `cargo test --package wallflower-app api_` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | INFRA-03 | integration | `cargo test --package wallflower-cli` | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 3 | INFRA-04 | unit | `cargo test --package wallflower-core config_` | ❌ W0 | ⬜ pending |
| 01-03-04 | 03 | 3 | INFRA-05 | unit | `cargo test --package wallflower-core error_` | ❌ W0 | ⬜ pending |
| 01-03-05 | 03 | 3 | INFRA-06 | build | `cargo test --workspace` | ❌ W0 | ⬜ pending |
| 01-03-06 | 03 | 3 | INFRA-07 | unit | `cargo test --package wallflower-core log_` | ❌ W0 | ⬜ pending |
| 01-03-07 | 03 | 3 | INFRA-08 | unit | `cargo test --package wallflower-core health_` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `Cargo.toml` — workspace with wallflower-core, wallflower-app, wallflower-cli members
- [ ] `src-tauri/Cargo.toml` — Tauri app crate setup
- [ ] `src-next/vitest.config.ts` — frontend test config
- [ ] `src-next/package.json` — vitest dependency
- [ ] Rust toolchain installed via rustup

*Wave 0 scaffolds the workspace and test infrastructure before any feature work.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App launches from dock | INFRA-09 | Requires macOS GUI interaction | Build with `cargo tauri build`, open .app from /Applications or target/ |
| Zoom F3 USB detection | STOR-06 | Requires physical device | Connect Zoom F3 via USB, verify import prompt appears |
| File watcher ~/wallflower | STOR-05 | Requires FS interaction timing | Drop a WAV into ~/wallflower, verify it appears in library within 5s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
