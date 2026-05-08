---
slug: update-checker
status: complete
created: "2026-05-08"
completed: "2026-05-08"
description: Add unobtrusive update notification that polls GitHub releases 1x/day
---

# Summary

Added auto-update notification for Wallflower. The feature polls the GitHub releases API for `lovettbarron/wallflower` max once per day, cached in localStorage. Only surfaces releases that have a `.dmg` build asset attached.

## Files Created
- `src/lib/update-checker.ts` — GitHub release polling, semver comparison, 24h cache
- `src/components/UpdateBadge.tsx` — Unobtrusive icon + popover with changelog and download link

## Files Modified
- `next.config.mjs` — Injects app version from `tauri.conf.json` as `NEXT_PUBLIC_APP_VERSION`
- `src/app/page.tsx` — Added `UpdateBadge` in the nav bar action area

## Behavior
- Orange arrow-up icon appears in nav bar when an update is available
- Small dot indicator on the icon
- Popover shows version info, changelog excerpt, and download button
- User can dismiss the notification
- No popup, no modal — completely unobtrusive
