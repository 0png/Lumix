# Lumix

<p align="center">
  <img src="icon.png" alt="Lumix Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Minecraft Server Launcher for Windows</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#development">Development</a> •
  <a href="#中文說明">中文說明</a>
</p>

---

## Features

- **Multi-Core Support** - Vanilla, Paper, Fabric, Forge
- **Auto Java Detection** - Automatically detects installed Java versions
- **Server Management** - Create, start, stop, delete servers
- **Real-time Console** - View server logs and send commands
- **Server Properties Editor** - Edit server.properties via GUI
- **Multi-language** - English / 繁體中文
- **Dark/Light Theme** - Follows system or manual selection

## Requirements

- **Windows 10** or later
- **Java 8+** (auto-detected)
- **4GB RAM** minimum

## Installation

Download from [GitHub Releases](https://github.com/0png/Lumix/releases):

- `Lumix-Setup-x.x.x.exe` - Installer
- `Lumix-x.x.x-portable.exe` - Portable version

## Usage

### Create Server

1. Click **"+"** button
2. Enter server name
3. Select version and core type
4. Set memory allocation
5. Click **Create**

### Start/Stop Server

- Select server → Click **Start** or **Stop**
- View logs in console panel
- Send commands via input field

### Settings

- Language: English / 繁體中文
- Theme: Light / Dark / System
- Java path configuration
- Default memory settings

## Supported Cores

| Core | Description |
|------|-------------|
| Vanilla | Official Minecraft server |
| Paper | High-performance fork |
| Fabric | Lightweight mod loader |
| Forge | Popular mod platform |

## Development

```bash
# Clone
git clone https://github.com/0png/Lumix.git
cd Lumix

# Install
pnpm install

# Dev
pnpm --filter @lumix/app dev

# Build
pnpm --filter @lumix/app build
```

### Tech Stack

- Electron + Vite
- React + TypeScript
- Tailwind CSS + shadcn/ui

---

# 中文說明

## 功能特色

- **多核心支援** - Vanilla、Paper、Fabric、Forge
- **自動偵測 Java** - 自動找到系統安裝的 Java
- **伺服器管理** - 建立、啟動、停止、刪除伺服器
- **即時控制台** - 查看日誌並發送指令
- **屬性編輯器** - 透過介面編輯 server.properties
- **多語言** - English / 繁體中文
- **深色/淺色主題** - 跟隨系統或手動選擇

## 系統需求

- **Windows 10** 或更新版本
- **Java 8+**（自動偵測）
- **4GB RAM** 最低需求

## 安裝

從 [GitHub Releases](https://github.com/0png/Lumix/releases) 下載：

- `Lumix-Setup-x.x.x.exe` - 安裝版
- `Lumix-x.x.x-portable.exe` - 免安裝版

## 使用方式

### 建立伺服器

1. 點擊 **"+"** 按鈕
2. 輸入伺服器名稱
3. 選擇版本和核心類型
4. 設定記憶體配置
5. 點擊 **建立**

### 啟動/停止伺服器

- 選擇伺服器 → 點擊 **啟動** 或 **停止**
- 在控制台面板查看日誌
- 透過輸入框發送指令

### 設定

- 語言：English / 繁體中文
- 主題：淺色 / 深色 / 跟隨系統
- Java 路徑設定
- 預設記憶體設定

## 支援的核心

| 核心 | 說明 |
|------|------|
| Vanilla | 官方 Minecraft 伺服器 |
| Paper | 高效能分支 |
| Fabric | 輕量模組載入器 |
| Forge | 熱門模組平台 |

---

## License

MIT License

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/0png">0png</a>
</p>
