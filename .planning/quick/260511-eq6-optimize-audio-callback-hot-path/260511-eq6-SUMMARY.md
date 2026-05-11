---
status: complete
quick_id: "260511-eq6"
description: "Optimize audio callback hot path"
date: "2026-05-11"
---

# Summary: Optimize audio callback hot path

## Changes

1. **Pre-allocated channel remap buffer** (`recording/mod.rs`): The `Vec::with_capacity()` that was creating a new heap allocation on every audio callback (~960x/sec) is now allocated once before the closure and reused via `clear()`.

2. **Single RMS computation** (`recording/mod.rs`, `recording/silence.rs`): Added `SilenceDetector::process_with_rms()` method that accepts a pre-computed RMS value. The callback now computes RMS once for level metering and passes it to the silence detector, eliminating a redundant full-buffer iteration per callback.

## Impact

- Removes 1 heap allocation per audio callback (960x/sec at 48kHz/512 samples)
- Removes 1 full buffer iteration per callback (512 samples * sum-of-squares)
- Both optimizations reduce latency in the HAL IO callback, addressing the `ClientHALIODurationExceededBudget` overloads

## Verification

- `cargo build --release -p wallflower-core` — clean
- `cargo build --release -p wallflower-app` — clean  
- `cargo test -p wallflower-core -- recording` — 24/24 pass
