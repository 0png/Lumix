# Changelog

All notable changes to Lumix will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- 164 test cases passing (unit tests + property-based tests)
- Full TypeScript type safety

## [0.1.0] - 2025-01-17

### Added
- Initial release
- Basic server management functionality
- Electron + React + TypeScript stack
- Tailwind CSS + shadcn/ui components
