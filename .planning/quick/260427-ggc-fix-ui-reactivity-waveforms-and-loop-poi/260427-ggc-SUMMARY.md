---
quick_id: 260427-ggc
status: complete
---

# Summary: Fix UI Reactivity After Processing

## Changes

### 1. TauriEventListener — recording-stopped handler
- Destructured `jamId` from event payload
- Added `invalidateQueries` for `["jams"]` (library list refreshes) and `["jam", jamId]` (jam metadata refreshes)

### 2. TauriEventListener — analysis-progress handler
- Added `invalidateQueries` for `["jam", jamId]` (updates peaksGenerated flag) and `["peaks", jamId]` (waveform data re-fetches)
- Added `["jams"]` invalidation on final analysis step completion (list reflects analysis results)

### 3. JamDetail — analysis query
- Removed `staleTime: 30000` to ensure fresh data on every mount (default staleTime=0)

## Root Cause
Cache invalidation was too narrow — only `["jam", jamId, "analysis"]` was invalidated on analysis progress. The peaks query, jam metadata query, and jams list query were never told to refetch after backend processing completed.
