# Changelog

All notable changes to Lumix will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Full NeoForge server support, including official version discovery, installer-based setup, args-file startup, existing-server import, and NeoForge modpacks
- Purpur server support through the official Purpur v2 API, including version discovery, latest-build downloads, import detection, and dedicated UI branding

### Changed
- Generalized modern Forge startup metadata into a shared loader args-file flow with legacy `forge-config.json` compatibility
- Expanded server creation, import review, core icons, memory recommendations, and Traditional Chinese / English copy for NeoForge and Purpur

## [1.0.0] - 2026-05-17

### Added
- Existing server import flow for bringing an existing Minecraft server folder into Lumix
- First-run onboarding checklist and quick actions after server creation
- Connection info and diagnostics for localhost, LAN, and WAN guidance
- Backup and restore flow with preflight checks and pre-restore backup support

### Changed
- Promoted Lumix release metadata, installer naming, and release documentation to the 1.0.0 formal release line
- Updated release and update setup docs to reflect the actual `0png/Lumix` GitHub release target
- Refined release-facing product messaging around Windows-first support and currently shipped capabilities

### Technical
- Verified the release candidate with `pnpm --filter @lumix/app typecheck`
- Verified the release candidate with `pnpm --filter @lumix/app lint`
- Verified the release candidate with `pnpm --filter @lumix/app test`
- Verified the release candidate with `pnpm --filter @lumix/app build`
- Verified the Windows package with `pnpm --filter @lumix/app build:win`

## [0.1.0-beta] - 2026-01-18

### Added
- **Auto-update system**: Integrated electron-updater for automatic updates from GitHub Releases
  - Auto-check for updates 3 seconds after app startup
  - Manual check for updates button in About page
  - Download progress display with real-time percentage
  - One-click install after download completion
  - Toast notifications for update status
- **Check for updates button**: Added in About page for manual update checking
- Multi-core support (Vanilla, Paper, Fabric, Forge)
- Auto Java detection and version matching
- Server management (create, start, stop, delete)
- Real-time console with command input
- Server properties editor (difficulty, gamemode, max-players, etc.)
- Multi-language support (English / 繁體中文)
- Dark/Light theme support with system follow option
- Quick folder access for server directories

### Fixed
- Fixed "Create Server" button not working
- Fixed Forge installer path handling with spaces

### Changed
- Improved error handling and user feedback
- Enhanced UI/UX with Lumix design language
- Updated About page to display actual version number

### Technical
- Added UpdateService for managing update lifecycle
- Added IPC communication layer for update operations
- Added use-update React hook for update state management
- Added UpdateNotification component for user notifications
- Full TypeScript type safety

## [0.1.0] - 2025-01-17

### Added
- Initial release
- Basic server management functionality
- Electron + React + TypeScript stack
- Tailwind CSS + shadcn/ui components
