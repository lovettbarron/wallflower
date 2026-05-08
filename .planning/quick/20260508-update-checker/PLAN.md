---
slug: update-checker
status: in-progress
created: "2026-05-08"
description: Add unobtrusive update notification that polls GitHub releases 1x/day
---

# Quick Task: Update Checker

## Goal
Add an auto-update notification that monitors https://github.com/lovettbarron/wallflower for new releases with .dmg builds. Show a small alert icon next to the Settings tab — no popup, unobtrusive. Show changelog items when the user engages with it.

## Plan

### P01: Frontend update checker (single plan)

**Files to create:**
1. `src/lib/update-checker.ts` — Core logic: fetch GitHub releases API, compare versions, filter for .dmg assets, cache in localStorage with 24h TTL
2. `src/components/UpdateBadge.tsx` — Small alert icon component with popover showing changelog + download link

**Files to modify:**
1. `src/app/page.tsx` — Add UpdateBadge next to the Settings tab in the nav bar

**Approach:**
- Use GitHub public API (`/repos/lovettbarron/wallflower/releases`) — no auth needed
- Compare semver against current app version from `@tauri-apps/api/app` 
- Store last check time + result in localStorage (24h TTL)
- Only surface releases that have at least one `.dmg` asset
- Small dot/icon indicator next to Settings tab when update available
- Popover on click showing version, changelog body, and download link
