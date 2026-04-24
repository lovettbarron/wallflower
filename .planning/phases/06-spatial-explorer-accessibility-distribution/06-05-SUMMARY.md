---
phase: 06-spatial-explorer-accessibility-distribution
plan: 05
subsystem: infra
tags: [tauri, autostart, auto-launch, first-launch, settings, macos]

# Dependency graph
requires:
  - phase: 06-spatial-explorer-accessibility-distribution
    plan: 02
    provides: Three-tab navigation in page.tsx (Library | Explore | Settings)
  - phase: 06-spatial-explorer-accessibility-distribution
    plan: 03
    provides: Accessibility retrofit with heading hierarchy in SettingsPage
provides:
  - Auto-launch on login via Tauri autostart plugin
  - First-launch dialog for auto-launch preference
  - Settings toggle for auto-launch
affects: []

# Tech tracking
tech-stack:
  added: [tauri-plugin-autostart, "@tauri-apps/plugin-autostart"]
  patterns: [MacosLauncher::LaunchAgent, localStorage first-launch tracking]

key-files:
  created: [src/components/settings/AutoLaunchSection.tsx, src/components/settings/FirstLaunchDialog.tsx]
  modified: [crates/wallflower-app/Cargo.toml, crates/wallflower-app/src/lib.rs, crates/wallflower-app/capabilities/default.json, src/components/settings/SettingsPage.tsx, src/lib/tauri.ts, src/app/page.tsx, package.json]

key-decisions:
  - "MacosLauncher::LaunchAgent for autostart (LaunchAgent, not LoginItem)"
  - "localStorage for first-launch dialog shown tracking (simple, no DB migration needed)"
  - "--autostarted CLI flag passed on auto-launch for future differentiation"

patterns-established:
  - "First-launch dialog pattern: check localStorage flag, show dialog once, save preference"
  - "Tauri plugin integration: Rust dependency + JS package + capabilities permissions"

requirements-completed: [INFRA-13]

# Metrics
duration: 6min
completed: 2026-04-24
---

# Phase 06 Plan 05: Auto-Launch on Login Summary

**Auto-launch on login via Tauri autostart plugin with first-launch dialog and settings toggle**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-24T12:10:00Z
- **Completed:** 2026-04-24T12:16:00Z
- **Tasks:** 1
- **Files modified:** 10

## Accomplishments
- Integrated tauri-plugin-autostart with MacosLauncher::LaunchAgent for auto-launch on macOS login
- Created FirstLaunchDialog component that prompts users about auto-launch preference on first app launch
- Created AutoLaunchSection settings toggle using @tauri-apps/plugin-autostart JS API (enable/disable/isEnabled)
- Added autostart permissions to Tauri capabilities (allow-enable, allow-disable, allow-is-enabled)
- Wired auto-launch dialog into page.tsx and toggle into SettingsPage.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Tauri autostart plugin integration and auto-launch UI** - `69af25d` (feat)

## Files Created/Modified
- `src/components/settings/AutoLaunchSection.tsx` - Settings toggle for enable/disable auto-launch with isEnabled state check
- `src/components/settings/FirstLaunchDialog.tsx` - First-launch dialog with "Yes, auto-launch" / "Not now" buttons
- `crates/wallflower-app/Cargo.toml` - Added tauri-plugin-autostart dependency
- `crates/wallflower-app/src/lib.rs` - Registered autostart plugin with MacosLauncher::LaunchAgent
- `crates/wallflower-app/capabilities/default.json` - Added autostart:allow-enable, allow-disable, allow-is-enabled
- `src/components/settings/SettingsPage.tsx` - Added AutoLaunchSection under Startup heading
- `src/lib/tauri.ts` - Added setAutoLaunchDialogShown/getAutoLaunchDialogShown helpers
- `src/app/page.tsx` - Wired FirstLaunchDialog with first-launch check
- `package.json` - Added @tauri-apps/plugin-autostart dependency

## Decisions Made
- Used localStorage for first-launch tracking instead of SQLite settings (simpler, no migration needed)
- Passes --autostarted flag on auto-launch for potential future startup behavior differentiation

## Deviations from Plan

Minor: Plan specified using `invoke("update_settings")` for dialog shown tracking, but implementation uses localStorage instead. Simpler approach, avoids adding a Tauri command for a boolean flag.

## Issues Encountered
- API mismatch in autostart feature flag resolved in follow-up fix commit `fd87cd7`
- Dependency installation required explicit `npm install @tauri-apps/plugin-autostart` resolved in same fix

## Next Phase Readiness
- All Phase 6 plans complete
- No blockers for phase verification

---
*Phase: 06-spatial-explorer-accessibility-distribution*
*Completed: 2026-04-24*

## Self-Check: PASSED
