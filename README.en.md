<p align="center">
  <a href="README.md">繁體中文</a> · <a href="README.en.md">English</a>
</p>

<p align="center">
  <img src="packages/app/resources/icon.png" width="96" alt="Lumix icon" />
</p>

<h1 align="center">Lumix</h1>

<p align="center">
  <strong>Move Minecraft server management out of batch files and folders—and into one clean desktop workspace.</strong>
</p>

<p align="center">
  Create, import, run, and back up Minecraft servers on Windows, with Java matching, modpack import, a live console, and connection diagnostics built in.
</p>

<p align="center">
  <a href="https://github.com/0png/Lumix/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/0png/Lumix?display_name=tag&sort=semver" /></a>
  <a href="https://github.com/0png/Lumix/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/0png/Lumix/total?logo=github" /></a>
  <a href="https://github.com/0png/Lumix/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/0png/Lumix/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/github/license/0png/Lumix" /></a>
  <img alt="Windows 10 and 11" src="https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?logo=windows11&logoColor=white" />
</p>

<p align="center">
  <a href="https://github.com/0png/Lumix/releases/latest"><img alt="Download for Windows" src="https://img.shields.io/badge/Download-Windows%20x64-0078D4?style=for-the-badge&logo=windows11&logoColor=white" /></a>
</p>

<p align="center">
  <a href="https://github.com/0png/Lumix/releases/latest">Latest release</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="https://github.com/0png/Lumix/issues">Report an issue</a>
</p>

![Create and start a Minecraft server with Lumix](docs/assets/lumix-demo.gif)

<p align="center"><sub>From server creation and memory settings to a live console in 30 seconds</sub></p>

## Why Lumix?

Lumix is a Windows-first, open-source Minecraft Server Launcher. It does not replace the Minecraft server itself—it turns the work normally scattered across JARs, launch scripts, Java paths, and configuration files into one visual workflow.

| | |
|---|---|
| **Start faster** | Pick a Minecraft version and server core. Lumix downloads the required files and helps match a compatible Java runtime. |
| **One workspace** | Create, import, start, stop, use the console, manage players, edit settings, and open files from one desktop app. |
| **Modded-ready** | Use Fabric, Forge, or NeoForge, and import server modpacks from Modrinth or CurseForge formats. |
| **Safer operations** | Schedule backups, run restore preflight checks, create protective backups, and diagnose local, LAN, and WAN connections. |

## Highlights

- **Multiple server cores** — Vanilla, Paper, Purpur, Fabric, Forge, and NeoForge
- **Existing server import** — Bring an existing server directory under Lumix management
- **Modpack import** — Read Modrinth and CurseForge formats and install their server-side files
- **Java management** — Detect local Java installations and select a runtime compatible with the Minecraft version
- **Live console** — Follow server output, send commands, and clear the console
- **Visual settings** — Configure memory and commonly used `server.properties` options
- **Backup and restore** — Manual or scheduled backups, restore preflight, and pre-restore protection
- **Connection diagnostics** — See localhost, LAN addresses, ports, and guidance for external connections
- **Desktop experience** — English / Traditional Chinese, light / dark / system themes, and automatic updates

## Download and install

1. Open the [latest release](https://github.com/0png/Lumix/releases/latest).
2. Download `Lumix-Setup-<version>.exe`.
3. Run the installer, open Lumix, and create or import your first server.

### Requirements

| Item | Requirement |
|---|---|
| Operating system | Windows 10 / 11 (x64) |
| Memory | 4 GB or more recommended; actual usage depends on your server and modpack |
| Storage | About 500 MB for Lumix, plus space for servers, Java, worlds, and backups |
| Network | Required when downloading server cores, Java, modpacks, version data, and updates |

> [!NOTE]
> Lumix is not currently code-signed, so Windows SmartScreen may show a protection prompt. Only download Lumix from this repository's [GitHub Releases](https://github.com/0png/Lumix/releases), and verify the SHA-256 digest shown in the release asset metadata if needed.

## Three ways to get started

### Create a standard server

Choose a Minecraft version, server core, and memory allocation. Lumix prepares the server files and creates an instance ready to manage.

### Import a modpack

Select a Modrinth or CurseForge modpack. Lumix scans its loader, Minecraft version, and server-side files before showing an import summary.

### Import an existing server

Select an existing server directory, keep its world and configuration, and bring start/stop controls, the console, backups, and settings into Lumix.

## Supported server cores

| Core | Best for |
|---|---|
| Vanilla | The official, unmodified server experience |
| Paper | Performance and the plugin ecosystem |
| Purpur | Deeper customization on top of the Paper ecosystem |
| Fabric | Lightweight, fast-moving modded servers |
| Forge | A mature and widely adopted modding platform |
| NeoForge | Modded servers on modern Minecraft versions |

## Local data and network access

Your server worlds, configuration, and backups stay on your Windows PC. Lumix connects to external services only when downloading server cores, Java, modpacks, player avatars, version metadata, or application updates.

Lumix can show LAN addresses and guide external connection troubleshooting, but it does not modify your router or firewall and does not provide hosted networking.

## Run from source

Requires Node.js 22+ and pnpm 10+.

```bash
git clone https://github.com/0png/Lumix.git
cd Lumix
pnpm install
pnpm --filter @lumix/app dev
```

Common validation and build commands:

```bash
pnpm --filter @lumix/app typecheck
pnpm --filter @lumix/app lint
pnpm --filter @lumix/app test
pnpm --filter @lumix/app build
pnpm --filter @lumix/app build:win
```

Built with Electron, Vite, React, TypeScript, Tailwind CSS, and Radix UI.

## Contributing

- Found a problem? Use the structured [issue forms](https://github.com/0png/Lumix/issues/new/choose)
- Want to contribute? Read the [contributing guide](.github/CONTRIBUTING.md) and [Code of Conduct](.github/CODE_OF_CONDUCT.md)
- Found a vulnerability? Follow the [security policy](.github/SECURITY.md) and report it privately

## Acknowledgements

- [Crafthead](https://crafthead.net/) — Minecraft player avatar rendering
- [OpenScreen](https://github.com/siddharthvaddem/openscreen) — Used to record and produce the Lumix product demo
- The Paper, Purpur, Fabric, Forge, NeoForge, and wider Minecraft open-source communities

## License and disclaimer

Lumix is available under the [MIT License](LICENSE).

Lumix is an independent open-source project. It is not an official Minecraft, Mojang Studios, or Microsoft product, and is not endorsed by or affiliated with those organizations.

<p align="center">
  Made by <a href="https://github.com/0png">0png</a>
</p>
