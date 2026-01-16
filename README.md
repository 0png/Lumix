# Lumix

<p align="center">
  <img src="icon.png" alt="Lumix Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Minecraft Server Launcher</strong><br>
  A modern, cross-platform Minecraft server management tool
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#development">Development</a> •
  <a href="#license">License</a>
</p>

---

## Features

- **Multi-Core Support** - Vanilla, Paper, Fabric, Forge
- **Auto Java Detection** - Automatically detects and selects the appropriate Java version
- **Server Lifecycle Management** - Start, stop, restart servers with ease
- **Real-time Console** - View server logs in real-time
- **Server Properties Editor** - Edit server.properties through GUI
- **Multi-language Support** - English and Traditional Chinese
- **Dark/Light Theme** - System theme detection with manual override
- **Cross-platform** - Windows, macOS, Linux

## Screenshots

| Server List | Server Console |
|-------------|----------------|
| Create and manage multiple servers | Real-time log viewing |

## Installation

### Download

Download the latest release from [GitHub Releases](https://github.com/0png/Lumix/releases).

| Platform | Download |
|----------|----------|
| Windows | `Lumix-Setup-x.x.x.exe` |
| macOS | `Lumix-x.x.x.dmg` |
| Linux | `Lumix-x.x.x.AppImage` |

### Requirements

- **Operating System**: Windows 10+, macOS 10.15+, Ubuntu 20.04+
- **Java**: Java 8+ (auto-detected, or manually specify)
- **Memory**: 4GB RAM minimum (8GB+ recommended)
- **Storage**: 500MB for app + space for servers

## Usage

### Creating a Server

1. Click the **"+"** button in the sidebar
2. Enter server name
3. Select Minecraft version
4. Choose server core type (Vanilla, Paper, Fabric, Forge)
5. Configure memory allocation
6. Click **Create**

### Starting a Server

1. Select a server from the list
2. Click the **Start** button
3. View real-time logs in the console

### Server Console

- View real-time server output
- Send commands directly to the server
- Auto-scroll with manual override

### Settings

- **Language**: English / 繁體中文
- **Theme**: Light / Dark / System
- **Java Path**: Auto-detect or manual configuration
- **Default Memory**: Set default RAM allocation

## Supported Server Cores

| Core | Versions | Description |
|------|----------|-------------|
| Vanilla | 1.7+ | Official Minecraft server |
| Paper | 1.8+ | High-performance Spigot fork |
| Fabric | 1.14+ | Lightweight modding platform |
| Forge | 1.7+ | Popular modding platform |

## Development

### Tech Stack

- **Framework**: Electron + Vite
- **Frontend**: React + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Hooks
- **Testing**: Vitest
- **Package Manager**: pnpm

### Project Structure

```
lumix/
├── packages/
│   └── app/                  # Electron application
│       ├── src/
│       │   ├── main/         # Electron main process
│       │   ├── preload/      # Preload scripts
│       │   ├── renderer/     # React frontend
│       │   └── shared/       # Shared types
│       └── tests/            # Test files
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### Getting Started

```bash
# Clone the repository
git clone https://github.com/0png/Lumix.git
cd Lumix

# Install dependencies
pnpm install

# Start development server
pnpm --filter @lumix/app dev

# Build for production
pnpm --filter @lumix/app build
```

### Scripts

```bash
# Development
pnpm --filter @lumix/app dev

# Build
pnpm --filter @lumix/app build

# Run tests
pnpm --filter @lumix/app test

# Lint
pnpm --filter @lumix/app lint
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [PaperMC](https://papermc.io/)
- [FabricMC](https://fabricmc.net/)
- [MinecraftForge](https://minecraftforge.net/)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/0png">0png</a>
</p>
