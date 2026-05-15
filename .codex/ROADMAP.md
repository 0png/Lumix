# Lumix Roadmap

## Product Direction

Lumix should focus on becoming a dedicated server operations console for Minecraft: Java Edition.

Minecraft Java's new Friends List and peer-to-peer local world invitations reduce the need for tools that only help players casually connect with friends. Lumix should not compete with that path. Instead, Lumix should serve users who need a real server: persistent, configurable, observable, moddable, recoverable, and maintainable.

Core positioning:

> The easiest way to run and maintain a Minecraft Java dedicated server on Windows.

Remote connectivity should remain part of server health, but it should not be the product center. The product center is server management.

## Guiding Principles

- Prioritize dedicated server workflows over casual peer-to-peer play.
- Keep complex server operations understandable for new users without hiding important state.
- Prefer local-first functionality that does not require Lumix-hosted infrastructure.
- Add automation where it is reliable, and diagnostics where full automation is not realistic.
- Keep renderer UI separate from Electron and Node capabilities. New system features should flow through shared IPC contracts, main handlers, preload APIs, then renderer UI.

## Phase 1: Server Operations Foundation

Goal: Make Lumix clearly better than manually managing folders, JAR files, scripts, and console windows.

### 1. Plugin and Mod Installation

- Add drag-and-drop installation for `.jar` files.
- Detect whether a dropped JAR is likely a plugin or mod.
- Route files to the correct folder:
  - Paper/Spigot-compatible cores: `plugins`
  - Fabric/Forge-compatible cores: `mods`
  - Vanilla: show unsupported state
- Show clear install results:
  - installed
  - unsupported server core
  - incompatible file type
  - duplicate file
  - server must restart
- Keep file operations in the main process.

### 2. Server Health Check

- Add a pre-start health check panel.
- Check:
  - server JAR exists
  - Java path exists
  - Java major version matches Minecraft version requirements
  - EULA accepted
  - configured port is valid
  - configured port is not already in use
  - server folder is writable
- Show health results as actionable items, not raw errors.

### 3. Startup Failure Diagnosis

- Parse common startup failure logs.
- Detect:
  - wrong Java version
  - port already in use
  - missing mod dependency
  - incompatible mod/plugin
  - EULA not accepted
  - invalid JVM memory flags
- Surface likely cause and suggested fix in the server detail page.

## Phase 2: Safety and Maintenance

Goal: Make Lumix trustworthy for long-running worlds.

### 1. Backup and Restore

- Add manual backup for each server.
- Add scheduled backup.
- Add backup retention policy:
  - keep last N backups
  - optionally keep daily/weekly snapshots later
- Include:
  - worlds
  - `server.properties`
  - `plugins`
  - `mods`
  - `ops.json`
  - `whitelist.json`
  - `banned-players.json`
  - `banned-ips.json`
- Add restore flow with confirmation and pre-restore backup.

### 2. Server File Management

- Add UI for important server-side files:
  - whitelist
  - operators
  - banned players
  - banned IPs
- Avoid exposing raw JSON editing as the primary workflow.
- Keep raw file access available through "Open Folder" for advanced users.

### 3. Update Safety

- Before updating server core, plugins, or mods, offer a backup.
- Show current version and target version.
- Preserve ability to roll back through backups.

## Phase 3: Mod and Plugin Ecosystem

Goal: Reduce the pain of running modded or plugin-based servers.

### 1. Compatibility Hints

- Detect server core and Minecraft version.
- For installed files, show:
  - file name
  - detected type
  - enabled/disabled state
  - last modified time
  - possible compatibility warning
- Start with best-effort detection from file name and manifest metadata.
- Avoid promising perfect compatibility checks.

### 2. Dependency Awareness

- Parse Fabric/Forge metadata where available.
- Surface missing dependencies before startup when possible.
- For Paper plugins, parse plugin metadata where available.

### 3. Disable Without Deleting

- Allow disabling plugins/mods by moving or renaming files safely.
- Preserve original files.
- Require restart for changes that need restart.

## Phase 4: Remote Access Assistant

Goal: Help users understand connectivity without making remote access the main product promise.

### 1. Connectivity Diagnostics

- Show local address: `localhost:<port>`.
- Show LAN address: `<local-ip>:<port>`.
- Check whether the server process is listening on the configured port.
- Check whether Windows Firewall may block Java or the port.
- Optionally check external reachability.
- Detect likely CGNAT where possible.

### 2. Port Mapping

- Try standard automatic port mapping:
  - UPnP IGD
  - NAT-PMP
  - PCP
- Do not attempt to automate router web admin UIs.
- If automatic mapping fails, explain likely reasons:
  - router does not support it
  - UPnP disabled
  - ISP/router CGNAT
  - firewall issue

### 3. Third-Party Tunnel Integration

- Do not operate a Lumix-hosted relay service.
- Add provider abstraction for third-party tunnel clients.
- Start with manual provider:
  - user pastes tunnel address
  - Lumix displays and copies it
- Potential future providers:
  - playit.gg for public Minecraft-friendly tunnels
  - Tailscale or ZeroTier for private friend groups
  - frp for users with their own VPS

## Phase 5: Polish and Operational UX

Goal: Make Lumix feel like a mature operations tool.

- Add activity history:
  - server created
  - server started/stopped
  - backup created/restored
  - plugin/mod installed
  - health check failed
- Add compact status indicators to the dashboard.
- Add copyable share cards for connection info.
- Improve empty states around first server, first Java detection, first backup.
- Keep UI dense, calm, and desktop-app oriented.

## Near-Term Priority

Recommended implementation order:

1. Server health check.
2. Manual backup and restore.
3. Drag-and-drop plugin/mod installation.
4. Startup failure diagnosis.
5. Scheduled backups.
6. Whitelist and OP management.
7. Remote access diagnostics.
8. Optional third-party tunnel provider integration.

This order builds trust first, then convenience, then remote connectivity.
