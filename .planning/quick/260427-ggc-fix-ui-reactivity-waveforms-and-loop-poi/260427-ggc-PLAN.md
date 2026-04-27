---
quick_id: 260427-ggc
description: "Fix UI reactivity: waveforms and loop points not updating after processing"
tasks: 2
---

# Quick Plan: Fix UI Reactivity After Processing

## Problem
After recording or when analysis completes in the background:
1. Waveforms don't auto-load (peaks query never re-fetched)
2. Loop points require page refresh (analysis data stale when navigating to jam)
3. New recordings don't appear in library list without refresh

## Root Cause
Missing React Query cache invalidations in TauriEventListener event handlers.

## Task 1: Add missing cache invalidations in TauriEventListener

**Files:** `src/components/tauri-event-listener.tsx`

**Changes:**
- `recording-stopped` handler: destructure `jamId` from payload, invalidate `["jams"]` and `["jam", jamId]`
- `analysis-progress` handler: also invalidate `["peaks", jamId]` and `["jam", jamId]` (for peaksGenerated flag update), invalidate `["jams"]` on final step completion (analysis info shown in list)

**Verify:** Event handlers call invalidateQueries for all affected query keys

## Task 2: Ensure analysis query refetches on mount after background completion

**Files:** `src/components/library/JamDetail.tsx`

**Changes:**
- Remove `staleTime: 30000` from analysis query (default staleTime=0 ensures fresh data on mount)
- This ensures that when user navigates to JamDetail after background analysis completes, the query refetches immediately rather than serving 30-second-old cached empty results

**Verify:** Analysis query has no staleTime override
