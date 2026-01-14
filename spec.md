# Lumix 技術文檔

> **Minecraft 伺服器啟動器 - 技術參考手冊**

---

## 📑 目錄

- [架構概覽](#架構概覽)
- [專案結構](#專案結構)
- [Core 核心套件](#core-核心套件)
- [CLI 命令列套件](#cli-命令列套件)
- [GUI 圖形介面套件](#gui-圖形介面套件)
- [開發環境設定](#開發環境設定)
- [建置與部署](#建置與部署)
- [測試策略](#測試策略)
- [API 參考](#api-參考)
- [貢獻指南](#貢獻指南)

---

## 架構概覽

### 系統架構圖

```
┌─────────────────────────────────────────────────┐
│                   使用者層                       │
├──────────────────────┬──────────────────────────┤
│    GUI (Electron)    │    CLI (Commander)       │
├──────────────────────┴──────────────────────────┤
│              IPC / API Gateway                  │
├─────────────────────────────────────────────────┤
│                Core 核心套件                     │
│  ┌──────────┬──────────┬──────────┬──────────┐ │
│  │ Server   │  Java    │  File    │  Process │ │
│  │ Manager  │ Manager  │ Manager  │ Manager  │ │
│  └──────────┴──────────┴──────────┴──────────┘ │
├─────────────────────────────────────────────────┤
│              底層服務 (Node.js)                  │
│  • 檔案系統 • 網路請求 • 子進程 • 壓縮解壓       │
└─────────────────────────────────────────────────┘
```

### 設計原則

1. **關注點分離**：UI 與業務邏輯完全解耦
2. **模組化設計**：每個功能獨立封裝，可單獨測試
3. **跨平台相容**：抽象化平台差異，統一 API
4. **安全優先**：所有檔案操作與進程管理都經過驗證
5. **可擴展性**：易於添加新的伺服器核心與功能

### 技術棧總覽

| 層級 | 技術 | 用途 |
|------|------|------|
| 核心邏輯 | TypeScript + Node.js 20+ | 伺服器管理、Java 管理 |
| GUI | Electron + Vite + React | 桌面應用程式 |
| 前端樣式 | Tailwind CSS | UI 設計 |
| CLI | Commander + Inquirer | 命令列介面 |
| 狀態管理 | Zustand | 前端狀態 |
| 建置工具 | pnpm workspace | Monorepo 管理 |
| 測試框架 | Vitest | 單元測試 |
| 程式碼品質 | ESLint + Prettier | 代碼規範 |

---

## 專案結構

### Monorepo 結構

```
lumix/
├── packages/
│   ├── core/                 # 核心業務邏輯
│   │   ├── src/
│   │   │   ├── managers/     # 各種管理器
│   │   │   │   ├── ServerManager.ts
│   │   │   │   ├── JavaManager.ts
│   │   │   │   ├── FileManager.ts
│   │   │   │   └── ProcessManager.ts
│   │   │   ├── downloaders/  # 下載器
│   │   │   │   ├── VanillaDownloader.ts
│   │   │   │   ├── PaperDownloader.ts
│   │   │   │   ├── FabricDownloader.ts
│   │   │   │   └── ForgeDownloader.ts
│   │   │   ├── types/        # TypeScript 型別定義
│   │   │   ├── utils/        # 工具函數
│   │   │   └── index.ts      # 主要匯出
│   │   ├── tests/            # 單元測試
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                  # CLI 套件
│   │   ├── src/
│   │   │   ├── commands/     # CLI 命令
│   │   │   │   ├── create.ts
│   │   │   │   ├── start.ts
│   │   │   │   ├── stop.ts
│   │   │   │   └── list.ts
│   │   │   ├── utils/
│   │   │   └── index.ts
│   │   ├── bin/
│   │   │   └── lumix.js      # CLI 入口
│   │   └── package.json
│   │
│   └── app/                  # Electron GUI
│       ├── src/
│       │   ├── main/         # Electron 主進程
│       │   │   ├── index.ts
│       │   │   ├── ipc.ts    # IPC 處理
│       │   │   └── menu.ts
│       │   ├── preload/      # Preload 腳本
│       │   │   └── index.ts
│       │   └── renderer/     # React 前端
│       │       ├── components/
│       │       ├── pages/
│       │       ├── hooks/
│       │       ├── store/    # Zustand store
│       │       ├── App.tsx
│       │       └── main.tsx
│       ├── electron.vite.config.ts
│       └── package.json
│
├── pnpm-workspace.yaml       # pnpm workspace 配置
├── package.json              # 根 package.json
├── tsconfig.base.json        # 共用 TypeScript 配置
├── .eslintrc.js              # ESLint 配置
├── .prettierrc               # Prettier 配置
└── README.md
```

### 檔案說明

#### Core Package 重要檔案

- **ServerManager.ts**：統一的伺服器管理介面
- **JavaManager.ts**：Java 版本檢測與自動安裝
- **FileManager.ts**：檔案系統操作封裝
- **ProcessManager.ts**：子進程生命週期管理
- **Downloaders**：各種伺服器核心的下載邏輯

#### CLI Package 重要檔案

- **commands/**：各個 CLI 命令的實作
- **bin/lumix.js**：CLI 可執行檔入口

#### App Package 重要檔案

- **main/index.ts**：Electron 主進程入口
- **main/ipc.ts**：IPC 通訊處理
- **renderer/**：React 前端應用

---

## Core 核心套件

### ServerManager

統一管理所有伺服器實例的核心類別。

#### 主要功能

```typescript
class ServerManager {
  // 創建新伺服器
  async createServer(config: ServerConfig): Promise<Server>
  
  // 啟動伺服器
  async startServer(serverId: string): Promise<void>
  
  // 停止伺服器
  async stopServer(serverId: string): Promise<void>
  
  // 獲取伺服器列表
  listServers(): Server[]
  
  // 獲取伺服器狀態
  getServerStatus(serverId: string): ServerStatus
  
  // 刪除伺服器
  async deleteServer(serverId: string): Promise<void>
}
```

#### 型別定義

```typescript
interface ServerConfig {
  name: string                    // 伺服器名稱
  version: string                 // Minecraft 版本
  type: ServerType                // 伺服器類型
  port: number                    // 伺服器端口
  memory: {
    min: string                   // 最小記憶體 (例如: "1G")
    max: string                   // 最大記憶體 (例如: "2G")
  }
  jvmArgs?: string[]              // 額外的 JVM 參數
  autoRestart?: boolean           // 自動重啟
}

type ServerType = 'vanilla' | 'paper' | 'fabric' | 'forge'

interface Server {
  id: string
  config: ServerConfig
  path: string                    // 伺服器檔案路徑
  status: ServerStatus
  createdAt: Date
  lastStarted?: Date
}

type ServerStatus = 
  | 'stopped' 
  | 'starting' 
  | 'running' 
  | 'stopping' 
  | 'crashed'
```

#### 使用範例

```typescript
import { ServerManager } from '@lumix/core'

const manager = new ServerManager({
  serversDir: '/path/to/servers'
})

// 創建新伺服器
const server = await manager.createServer({
  name: 'My Server',
  version: '1.20.4',
  type: 'vanilla',
  port: 25565,
  memory: { min: '1G', max: '2G' }
})

// 啟動伺服器
await manager.startServer(server.id)

// 監聽日誌
manager.on('log', (serverId, log) => {
  console.log(`[${serverId}] ${log}`)
})

// 停止伺服器
await manager.stopServer(server.id)
```

### JavaManager

管理 Java 環境的檢測、下載與安裝。

#### 主要功能

```typescript
class JavaManager {
  // 檢測系統 Java
  async detectJava(): Promise<JavaInstallation[]>
  
  // 檢查版本相容性
  isCompatible(javaVersion: string, mcVersion: string): boolean
  
  // 下載並安裝 Java
  async installJava(version: number): Promise<string>
  
  // 獲取最佳 Java 路徑
  async getBestJava(mcVersion: string): Promise<string>
}
```

#### 型別定義

```typescript
interface JavaInstallation {
  version: string                 // 例如: "17.0.9"
  path: string                    // Java 執行檔路徑
  vendor: string                  // 例如: "Oracle", "Adoptium"
  architecture: string            // 例如: "x64", "arm64"
}
```

#### Java 版本對應表

| Minecraft 版本 | 需求 Java 版本 |
|----------------|----------------|
| 1.7.x - 1.16.x | Java 8+ |
| 1.17.x - 1.17.1 | Java 16+ |
| 1.18.x - 1.20.4 | Java 17+ |
| 1.20.5+ | Java 21+ |

#### 使用範例

```typescript
import { JavaManager } from '@lumix/core'

const javaManager = new JavaManager()

// 檢測系統 Java
const installations = await javaManager.detectJava()
console.log('找到的 Java:', installations)

// 獲取適用於特定 MC 版本的 Java
const javaPath = await javaManager.getBestJava('1.20.4')

// 若無適合的 Java，自動下載
if (!javaPath) {
  const newPath = await javaManager.installJava(17)
  console.log('已安裝 Java 至:', newPath)
}
```

### FileManager

封裝所有檔案系統操作，確保跨平台相容性。

#### 主要功能

```typescript
class FileManager {
  // 創建伺服器目錄結構
  async createServerDirectory(serverPath: string): Promise<void>
  
  // 複製檔案
  async copyFile(src: string, dest: string): Promise<void>
  
  // 生成 eula.txt
  async generateEula(serverPath: string): Promise<void>
  
  // 生成 server.properties
  async generateServerProperties(
    serverPath: string, 
    config: ServerPropertiesConfig
  ): Promise<void>
  
  // 備份伺服器
  async backupServer(serverPath: string, backupPath: string): Promise<void>
}
```

#### 標準伺服器目錄結構

```
server-name/
├── server.jar              # 伺服器核心檔案
├── eula.txt                # EULA 協議
├── server.properties       # 伺服器配置
├── logs/                   # 日誌目錄
│   └── latest.log
├── world/                  # 主世界
├── world_nether/           # 地獄
├── world_the_end/          # 終界
├── plugins/                # 插件目錄 (Paper/Spigot)
├── mods/                   # 模組目錄 (Forge/Fabric)
└── config/                 # 配置目錄
```

### ProcessManager

管理 Java 子進程的生命週期。

#### 主要功能

```typescript
class ProcessManager {
  // 啟動進程
  async start(config: ProcessConfig): Promise<ChildProcess>
  
  // 停止進程
  async stop(pid: number, force?: boolean): Promise<void>
  
  // 發送命令
  sendCommand(pid: number, command: string): void
  
  // 監聽輸出
  on(event: 'stdout' | 'stderr' | 'exit', callback: Function): void
}
```

#### 型別定義

```typescript
interface ProcessConfig {
  javaPath: string
  jarPath: string
  workingDir: string
  memory: { min: string; max: string }
  jvmArgs: string[]
  args: string[]
}
```

#### 使用範例

```typescript
import { ProcessManager } from '@lumix/core'

const processManager = new ProcessManager()

// 啟動伺服器進程
const process = await processManager.start({
  javaPath: '/usr/bin/java',
  jarPath: '/path/to/server.jar',
  workingDir: '/path/to/server',
  memory: { min: '1G', max: '2G' },
  jvmArgs: ['-XX:+UseG1GC'],
  args: ['nogui']
})

// 監聽輸出
processManager.on('stdout', (data) => {
  console.log('伺服器輸出:', data)
})

// 發送命令
processManager.sendCommand(process.pid, 'say Hello!')

// 停止進程
await processManager.stop(process.pid)
```

### Downloaders

各種伺服器核心的下載器實作。

#### VanillaDownloader

```typescript
class VanillaDownloader {
  // 獲取可用版本列表
  async getVersions(): Promise<string[]>
  
  // 下載伺服器
  async download(version: string, dest: string): Promise<void>
  
  // 獲取版本資訊
  async getVersionInfo(version: string): Promise<VersionInfo>
}
```

#### PaperDownloader

```typescript
class PaperDownloader {
  // 獲取 Paper 版本
  async getVersions(): Promise<string[]>
  
  // 獲取特定版本的建置列表
  async getBuilds(version: string): Promise<number[]>
  
  // 下載指定建置
  async downloadBuild(
    version: string, 
    build: number, 
    dest: string
  ): Promise<void>
}
```

#### FabricDownloader

```typescript
class FabricDownloader {
  // 獲取 Fabric Loader 版本
  async getLoaderVersions(): Promise<string[]>
  
  // 下載 Fabric 伺服器
  async download(
    mcVersion: string,
    loaderVersion: string,
    dest: string
  ): Promise<void>
}
```

#### ForgeDownloader

```typescript
class ForgeDownloader {
  // 獲取 Forge 版本
  async getVersions(mcVersion: string): Promise<string[]>
  
  // 下載並安裝 Forge
  async download(
    mcVersion: string,
    forgeVersion: string,
    dest: string
  ): Promise<void>
}
```

#### 下載器使用範例

```typescript
import { VanillaDownloader } from '@lumix/core'

const downloader = new VanillaDownloader()

// 獲取所有版本
const versions = await downloader.getVersions()
console.log('可用版本:', versions)

// 下載伺服器
await downloader.download('1.20.4', '/path/to/server/server.jar')

// 顯示下載進度
downloader.on('progress', (percent, downloaded, total) => {
  console.log(`下載進度: ${percent}% (${downloaded}/${total} bytes)`)
})
```

---

## CLI 命令列套件

### 命令結構

CLI 使用 Commander.js 建構，所有命令共用 Core API。

### 可用命令

#### `lumix create`

創建新的伺服器實例。

```bash
lumix create [name]

選項:
  -v, --version <version>     Minecraft 版本 (必填)
  -t, --type <type>           伺服器類型 [vanilla|paper|fabric|forge]
  -p, --port <port>           伺服器端口 (預設: 25565)
  -m, --memory <size>         最大記憶體 (例如: 2G, 4G)
  --min-memory <size>         最小記憶體
  --no-eula                   不自動同意 EULA
```

**範例:**

```bash
# 互動式創建
lumix create

# 快速創建 Vanilla 伺服器
lumix create my-server -v 1.20.4 -t vanilla -m 2G

# 創建 Paper 伺服器
lumix create paper-server -v 1.20.4 -t paper -m 4G -p 25566
```

#### `lumix start`

啟動伺服器。

```bash
lumix start <server-name>

選項:
  -d, --detach                背景執行
  -l, --log-level <level>     日誌等級 [debug|info|warn|error]
```

**範例:**

```bash
# 啟動並顯示日誌
lumix start my-server

# 背景執行
lumix start my-server -d
```

#### `lumix stop`

停止伺服器。

```bash
lumix stop <server-name>

選項:
  -f, --force                 強制停止
  -t, --timeout <seconds>     等待超時時間 (預設: 30)
```

**範例:**

```bash
# 正常停止
lumix stop my-server

# 強制停止
lumix stop my-server --force
```

#### `lumix list`

列出所有伺服器。

```bash
lumix list

選項:
  -s, --status <status>       篩選狀態 [running|stopped|all]
  -j, --json                  JSON 格式輸出
```

**範例:**

```bash
# 列出所有伺服器
lumix list

# 只顯示運行中的伺服器
lumix list -s running

# JSON 輸出
lumix list --json
```

#### `lumix status`

查看伺服器狀態。

```bash
lumix status <server-name>
```

#### `lumix delete`

刪除伺服器。

```bash
lumix delete <server-name>

選項:
  -y, --yes                   跳過確認
  --keep-files                保留伺服器檔案
```

#### `lumix logs`

查看伺服器日誌。

```bash
lumix logs <server-name>

選項:
  -f, --follow                即時跟隨
  -n, --lines <number>        顯示行數 (預設: 50)
```

### CLI 開發指南

#### 新增命令

1. 在 `packages/cli/src/commands/` 建立新檔案
2. 實作命令邏輯
3. 在 `index.ts` 註冊命令

```typescript
// packages/cli/src/commands/backup.ts
import { Command } from 'commander'
import { ServerManager } from '@lumix/core'

export function backupCommand(program: Command) {
  program
    .command('backup <server-name>')
    .description('備份伺服器')
    .option('-o, --output <path>', '備份輸出路徑')
    .action(async (serverName, options) => {
      const manager = new ServerManager()
      await manager.backupServer(serverName, options.output)
      console.log('備份完成!')
    })
}
```

---

## GUI 圖形介面套件

### Electron 架構

#### 主進程 (Main Process)

負責應用程式生命週期、視窗管理、IPC 通訊。

```typescript
// packages/app/src/main/index.ts
import { app, BrowserWindow } from 'electron'
import { setupIPC } from './ipc'

let mainWindow: BrowserWindow | null = null

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  setupIPC(mainWindow)
  
  mainWindow.loadURL('http://localhost:5173') // 開發模式
})
```

#### IPC 通訊

```typescript
// packages/app/src/main/ipc.ts
import { ipcMain } from 'electron'
import { ServerManager } from '@lumix/core'

const serverManager = new ServerManager()

export function setupIPC(mainWindow: BrowserWindow) {
  // 創建伺服器
  ipcMain.handle('server:create', async (event, config) => {
    return await serverManager.createServer(config)
  })
  
  // 啟動伺服器
  ipcMain.handle('server:start', async (event, serverId) => {
    await serverManager.startServer(serverId)
  })
  
  // 停止伺服器
  ipcMain.handle('server:stop', async (event, serverId) => {
    await serverManager.stopServer(serverId)
  })
  
  // 獲取伺服器列表
  ipcMain.handle('server:list', async () => {
    return serverManager.listServers()
  })
  
  // 日誌事件
  serverManager.on('log', (serverId, log) => {
    mainWindow.webContents.send('server:log', { serverId, log })
  })
}
```

#### Preload 腳本

```typescript
// packages/app/src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('lumixAPI', {
  // 伺服器管理
  createServer: (config) => ipcRenderer.invoke('server:create', config),
  startServer: (serverId) => ipcRenderer.invoke('server:start', serverId),
  stopServer: (serverId) => ipcRenderer.invoke('server:stop', serverId),
  listServers: () => ipcRenderer.invoke('server:list'),
  
  // 事件監聽
  onLog: (callback) => {
    ipcRenderer.on('server:log', (event, data) => callback(data))
  }
})
```

### React 前端

#### 狀態管理 (Zustand)

```typescript
// packages/app/src/renderer/store/serverStore.ts
import create from 'zustand'

interface ServerStore {
  servers: Server[]
  selectedServerId: string | null
  
  fetchServers: () => Promise<void>
  selectServer: (id: string) => void
  createServer: (config: ServerConfig) => Promise<void>
  startServer: (id: string) => Promise<void>
  stopServer: (id: string) => Promise<void>
}

export const useServerStore = create<ServerStore>((set, get) => ({
  servers: [],
  selectedServerId: null,
  
  fetchServers: async () => {
    const servers = await window.lumixAPI.listServers()
    set({ servers })
  },
  
  selectServer: (id) => {
    set({ selectedServerId: id })
  },
  
  createServer: async (config) => {
    const server = await window.lumixAPI.createServer(config)
    set((state) => ({ 
      servers: [...state.servers, server] 
    }))
  },
  
  startServer: async (id) => {
    await window.lumixAPI.startServer(id)
    await get().fetchServers()
  },
  
  stopServer: async (id) => {
    await window.lumixAPI.stopServer(id)
    await get().fetchServers()
  }
}))
```

#### 主要元件

**ServerList 元件**

```typescript
// packages/app/src/renderer/components/ServerList.tsx
import { useServerStore } from '../store/serverStore'

export function ServerList() {
  const { servers, selectedServerId, selectServer } = useServerStore()
  
  return (
    <div className="flex flex-col gap-2">
      {servers.map((server) => (
        <div
          key={server.id}
          onClick={() => selectServer(server.id)}
          className={`
            p-4 rounded-lg cursor-pointer transition
            ${selectedServerId === server.id 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 hover:bg-gray-200'
            }
          `}
        >
          <h3 className="font-bold">{server.config.name}</h3>
          <p className="text-sm opacity-75">
            {server.config.version} · {server.config.type}
          </p>
          <span className={`
            inline-block px-2 py-1 rounded text-xs mt-2
            ${server.status === 'running' ? 'bg-green-500' : 'bg-gray-500'}
          `}>
            {server.status}
          </span>
        </div>
      ))}
    </div>
  )
}
```

**CreateServerModal 元件**

```typescript
// packages/app/src/renderer/components/CreateServerModal.tsx
import { useState } from 'react'
import { useServerStore } from '../store/serverStore'

export function CreateServerModal({ isOpen, onClose }) {
  const [name, setName] = useState('')
  const [version, setVersion] = useState('1.20.4')
  const [type, setType] = useState<ServerType>('vanilla')
  const [memory, setMemory] = useState('2G')
  
  const { createServer } = useServerStore()
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    await createServer({
      name,
      version,
      type,
      port: 25565,
      memory: { min: '1G', max: memory }
    })
    onClose()
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-2xl font-bold mb-4">創建新伺服器</h2>
        
        <div className="space-y-4">
          <input
            type="text"
            placeholder="伺服器名稱"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
          
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="1.20.4">1.20.4</option>
            <option value="1.20.2">1.20.2</option>
            <option value="1.19.4">1.19.4</option>
          </select>
          
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ServerType)}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="vanilla">Vanilla</option>
            <option value="paper">Paper</option>
            <option value="fabric">Fabric</option>
            <option value="forge">Forge</option>
          </select>
          
          <input
            type="text"
            placeholder="記憶體 (例如: 2G)"
            value={memory}
            onChange={(e) => setMemory(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        
        <div className="flex gap-2 mt-6">
          <button
            type="submit"
            className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
          >
            創建
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  )
}
```

**LogConsole 元件**

```typescript
// packages/app/src/renderer/components/LogConsole.tsx
import { useEffect, useState, useRef } from 'react'
import { useServerStore } from '../store/serverStore'

export function LogConsole() {
  const { selectedServerId } = useServerStore()
  const [logs, setLogs] = useState<string[]>([])
  const consoleRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    // 監聽日誌事件
    const unsubscribe = window.lumixAPI.onLog(({ serverId, log }) => {
      if (serverId === selectedServerId) {
        setLogs((prev) => [...prev, log])
      }
    })
    
    return unsubscribe
  }, [selectedServerId])
  
  // 自動滾動到底部
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logs])
  
  return (
    <div className="bg-black text-green-400 p-4 rounded-lg h-96 overflow-y-auto font-mono text-sm">
      <div ref={consoleRef}>
        {logs.map((log, index) => (
          <div key={index} className="mb-1">
            {log}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 開發環境設定

### 前置需求

```bash
# Node.js 20+
node --version  # v20.x.x

# pnpm
npm install -g pnpm
pnpm --version  # 8.x.x

# Git
git --version
```

### 克隆專案

```bash
git clone https://github.com/your-org/lumix.git
cd lumix
```

### 安裝依賴

```bash
# 安裝所有 workspace 依賴
pnpm install
```

### 開發模式

#### 啟動 GUI 開發環境

```bash
# 開發模式（熱重載）
pnpm --filter @lumix/app dev

# 或從根目錄
pnpm dev:app
```

#### 開發 CLI

```bash
# Link CLI 到全域
pnpm --filter @lumix/cli link

# 測試 CLI 命令
lumix --help

# 或直接執行
pnpm --filter @lumix/cli start create
```

#### 開發 Core

```bash
# 執行測試
pnpm --filter @lumix/core test

# 監聽模式
pnpm --filter @lumix/core test:watch

# 建置
pnpm --filter @lumix/core build
```

### 專案腳本

根目錄 `package.json` 定義的腳本：

```json
{
  "scripts": {
    "dev:app": "pnpm --filter @lumix/app dev",
    "dev:cli": "pnpm --filter @lumix/cli dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "type-check": "tsc --noEmit"
  }
}
```

### 環境變數

創建 `.env` 檔案：

```bash
# 開發模式
NODE_ENV=development

# 伺服器存放目錄
LUMIX_SERVERS_DIR=/path/to/servers

# Java 安裝目錄
LUMIX_JAVA_DIR=/path/to/java

# 日誌等級
LOG_LEVEL=debug

# API 端點（未來遠端管理使用）
API_ENDPOINT=http://localhost:3000
```

---

## 建置與部署

### 建置所有套件

```bash
# 建置所有 packages
pnpm build

# 僅建置 Core
pnpm --filter @lumix/core build

# 僅建置 CLI
pnpm --filter @lumix/cli build

# 僅建置 App
pnpm --filter @lumix/app build
```

### 打包 Electron 應用程式

```bash
# 打包目前平台
pnpm --filter @lumix/app build:electron

# 打包 Windows
pnpm --filter @lumix/app build:win

# 打包 macOS
pnpm --filter @lumix/app build:mac

# 打包 Linux
pnpm --filter @lumix/app build:linux

# 打包所有平台
pnpm --filter @lumix/app build:all
```

### Electron Builder 配置

```javascript
// packages/app/electron-builder.config.js
module.exports = {
  appId: 'com.lumix.app',
  productName: 'Lumix',
  directories: {
    output: 'dist',
    buildResources: 'build'
  },
  files: [
    'out/**/*',
    'package.json'
  ],
  win: {
    target: ['nsis', 'portable'],
    icon: 'build/icon.ico'
  },
  mac: {
    target: ['dmg', 'zip'],
    icon: 'build/icon.icns',
    category: 'public.app-category.utilities'
  },
  linux: {
    target: ['AppImage', 'deb', 'rpm'],
    icon: 'build/icon.png',
    category: 'Utility'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  }
}
```

### 發布 CLI 到 npm

```bash
# 登入 npm
npm login

# 發布（從 CLI 目錄）
cd packages/cli
npm version patch  # 或 minor, major
npm publish

# 或使用 pnpm
pnpm --filter @lumix/cli publish
```

### 自動化發布（GitHub Actions）

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build
        run: pnpm build
      
      - name: Build Electron app
        run: pnpm --filter @lumix/app build:electron
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: lumix-${{ matrix.os }}
          path: packages/app/dist/*
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: packages/app/dist/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 測試策略

### 單元測試

使用 Vitest 進行單元測試。

#### Core Package 測試範例

```typescript
// packages/core/tests/ServerManager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ServerManager } from '../src/managers/ServerManager'
import fs from 'fs-extra'
import path from 'path'

describe('ServerManager', () => {
  let manager: ServerManager
  let testDir: string
  
  beforeEach(async () => {
    testDir = path.join(__dirname, 'temp-servers')
    await fs.ensureDir(testDir)
    manager = new ServerManager({ serversDir: testDir })
  })
  
  afterEach(async () => {
    await fs.remove(testDir)
  })
  
  it('should create a new server', async () => {
    const server = await manager.createServer({
      name: 'Test Server',
      version: '1.20.4',
      type: 'vanilla',
      port: 25565,
      memory: { min: '1G', max: '2G' }
    })
    
    expect(server).toBeDefined()
    expect(server.config.name).toBe('Test Server')
    expect(server.status).toBe('stopped')
  })
  
  it('should list all servers', async () => {
    await manager.createServer({
      name: 'Server 1',
      version: '1.20.4',
      type: 'vanilla',
      port: 25565,
      memory: { min: '1G', max: '2G' }
    })
    
    await manager.createServer({
      name: 'Server 2',
      version: '1.19.4',
      type: 'paper',
      port: 25566,
      memory: { min: '1G', max: '2G' }
    })
    
    const servers = manager.listServers()
    expect(servers).toHaveLength(2)
  })
  
  it('should start and stop a server', async () => {
    const server = await manager.createServer({
      name: 'Test Server',
      version: '1.20.4',
      type: 'vanilla',
      port: 25565,
      memory: { min: '1G', max: '2G' }
    })
    
    await manager.startServer(server.id)
    expect(manager.getServerStatus(server.id)).toBe('running')
    
    await manager.stopServer(server.id)
    expect(manager.getServerStatus(server.id)).toBe('stopped')
  }, 30000) // 30 秒超時
})
```

#### JavaManager 測試

```typescript
// packages/core/tests/JavaManager.test.ts
import { describe, it, expect } from 'vitest'
import { JavaManager } from '../src/managers/JavaManager'

describe('JavaManager', () => {
  let javaManager: JavaManager
  
  beforeEach(() => {
    javaManager = new JavaManager()
  })
  
  it('should detect system Java installations', async () => {
    const installations = await javaManager.detectJava()
    expect(Array.isArray(installations)).toBe(true)
  })
  
  it('should check version compatibility', () => {
    expect(javaManager.isCompatible('17.0.9', '1.20.4')).toBe(true)
    expect(javaManager.isCompatible('8.0.392', '1.20.4')).toBe(false)
    expect(javaManager.isCompatible('21.0.1', '1.20.5')).toBe(true)
  })
  
  it('should get best Java for MC version', async () => {
    const javaPath = await javaManager.getBestJava('1.20.4')
    expect(typeof javaPath).toBe('string')
  })
})
```

### 整合測試

```typescript
// packages/core/tests/integration/server-lifecycle.test.ts
import { describe, it, expect } from 'vitest'
import { ServerManager } from '../../src/managers/ServerManager'
import { JavaManager } from '../../src/managers/JavaManager'

describe('Server Lifecycle Integration', () => {
  it('should create, start, and stop a server end-to-end', async () => {
    const serverManager = new ServerManager()
    const javaManager = new JavaManager()
    
    // 確保有適合的 Java
    const javaPath = await javaManager.getBestJava('1.20.4')
    expect(javaPath).toBeDefined()
    
    // 創建伺服器
    const server = await serverManager.createServer({
      name: 'Integration Test Server',
      version: '1.20.4',
      type: 'vanilla',
      port: 25565,
      memory: { min: '1G', max: '2G' }
    })
    
    // 啟動伺服器
    await serverManager.startServer(server.id)
    
    // 等待伺服器完全啟動
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    expect(serverManager.getServerStatus(server.id)).toBe('running')
    
    // 停止伺服器
    await serverManager.stopServer(server.id)
    expect(serverManager.getServerStatus(server.id)).toBe('stopped')
    
    // 清理
    await serverManager.deleteServer(server.id)
  }, 60000) // 60 秒超時
})
```

### E2E 測試（Electron）

使用 Playwright 進行 E2E 測試。

```typescript
// packages/app/tests/e2e/create-server.spec.ts
import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'

test('should create a new server through GUI', async () => {
  const app = await electron.launch({
    args: ['packages/app/out/main/index.js']
  })
  
  const window = await app.firstWindow()
  
  // 點擊創建伺服器按鈕
  await window.click('button:has-text("新增伺服器")')
  
  // 填寫表單
  await window.fill('input[placeholder="伺服器名稱"]', 'E2E Test Server')
  await window.selectOption('select[name="version"]', '1.20.4')
  await window.selectOption('select[name="type"]', 'vanilla')
  await window.fill('input[placeholder="記憶體"]', '2G')
  
  // 提交
  await window.click('button:has-text("創建")')
  
  // 驗證伺服器出現在列表中
  await expect(window.locator('text=E2E Test Server')).toBeVisible()
  
  await app.close()
})
```

### 測試覆蓋率

```bash
# 執行測試並生成覆蓋率報告
pnpm test -- --coverage

# 查看覆蓋率報告
open coverage/index.html
```

### 測試配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    },
    testTimeout: 30000
  }
})
```

---

## API 參考

### Core API 完整參考

#### ServerManager API

```typescript
class ServerManager extends EventEmitter {
  constructor(options: ServerManagerOptions)
  
  // 伺服器 CRUD
  createServer(config: ServerConfig): Promise<Server>
  getServer(serverId: string): Server | undefined
  listServers(filter?: ServerFilter): Server[]
  deleteServer(serverId: string, options?: DeleteOptions): Promise<void>
  
  // 伺服器控制
  startServer(serverId: string): Promise<void>
  stopServer(serverId: string, force?: boolean): Promise<void>
  restartServer(serverId: string): Promise<void>
  
  // 伺服器狀態
  getServerStatus(serverId: string): ServerStatus
  isServerRunning(serverId: string): boolean
  
  // 伺服器配置
  updateServerConfig(serverId: string, config: Partial<ServerConfig>): Promise<void>
  getServerProperties(serverId: string): Promise<ServerProperties>
  updateServerProperties(serverId: string, props: Partial<ServerProperties>): Promise<void>
  
  // 命令執行
  executeCommand(serverId: string, command: string): Promise<void>
  
  // 備份與還原
  backupServer(serverId: string, backupPath?: string): Promise<string>
  restoreServer(serverId: string, backupPath: string): Promise<void>
  
  // 事件
  on(event: 'log', listener: (serverId: string, log: string) => void): this
  on(event: 'status-change', listener: (serverId: string, status: ServerStatus) => void): this
  on(event: 'error', listener: (serverId: string, error: Error) => void): this
}

interface ServerManagerOptions {
  serversDir: string          // 伺服器存放目錄
  javaDir?: string            // Java 安裝目錄
  autoBackup?: boolean        // 自動備份
  backupInterval?: number     // 備份間隔（毫秒）
}

interface ServerFilter {
  status?: ServerStatus
  type?: ServerType
  version?: string
}

interface DeleteOptions {
  keepFiles?: boolean         // 保留檔案
  keepBackups?: boolean       // 保留備份
}
```

#### JavaManager API

```typescript
class JavaManager {
  constructor(options?: JavaManagerOptions)
  
  // Java 檢測
  detectJava(): Promise<JavaInstallation[]>
  findJava(version: number): Promise<JavaInstallation | null>
  getBestJava(mcVersion: string): Promise<string>
  
  // Java 安裝
  installJava(version: number, options?: InstallOptions): Promise<string>
  uninstallJava(path: string): Promise<void>
  
  // 版本相容性
  isCompatible(javaVersion: string, mcVersion: string): boolean
  getRequiredJavaVersion(mcVersion: string): number
  
  // Java 資訊
  getJavaVersion(javaPath: string): Promise<string>
  getJavaInfo(javaPath: string): Promise<JavaInfo>
}

interface JavaManagerOptions {
  installDir?: string         // 安裝目錄
  preferredVendor?: string    // 偏好的供應商
}

interface InstallOptions {
  vendor?: 'adoptium' | 'zulu' | 'oracle'
  architecture?: 'x64' | 'arm64'
  onProgress?: (percent: number) => void
}

interface JavaInfo {
  version: string
  vendor: string
  architecture: string
  home: string
  runtime: string
}
```

#### FileManager API

```typescript
class FileManager {
  constructor(baseDir: string)
  
  // 目錄操作
  createServerDirectory(serverPath: string): Promise<void>
  ensureDirectory(path: string): Promise<void>
  removeDirectory(path: string, options?: RemoveOptions): Promise<void>
  
  // 檔案操作
  copyFile(src: string, dest: string): Promise<void>
  moveFile(src: string, dest: string): Promise<void>
  readFile(path: string, encoding?: string): Promise<string | Buffer>
  writeFile(path: string, content: string | Buffer): Promise<void>
  
  // 伺服器檔案
  generateEula(serverPath: string): Promise<void>
  generateServerProperties(serverPath: string, config: ServerPropertiesConfig): Promise<void>
  readServerProperties(serverPath: string): Promise<ServerProperties>
  updateServerProperties(serverPath: string, props: Partial<ServerProperties>): Promise<void>
  
  // 壓縮與解壓縮
  zipDirectory(source: string, destination: string): Promise<void>
  unzipFile(source: string, destination: string): Promise<void>
  
  // 備份
  createBackup(serverPath: string, backupPath: string): Promise<void>
  restoreBackup(backupPath: string, serverPath: string): Promise<void>
  listBackups(serverPath: string): Promise<BackupInfo[]>
}

interface RemoveOptions {
  force?: boolean
  recursive?: boolean
}

interface BackupInfo {
  path: string
  createdAt: Date
  size: number
}
```

#### ProcessManager API

```typescript
class ProcessManager extends EventEmitter {
  // 進程管理
  start(config: ProcessConfig): Promise<ChildProcess>
  stop(pid: number, options?: StopOptions): Promise<void>
  restart(pid: number): Promise<void>
  
  // 命令執行
  sendCommand(pid: number, command: string): void
  
  // 進程資訊
  isRunning(pid: number): boolean
  getProcess(pid: number): ChildProcess | undefined
  getProcessInfo(pid: number): Promise<ProcessInfo>
  
  // 事件
  on(event: 'stdout', listener: (pid: number, data: string) => void): this
  on(event: 'stderr', listener: (pid: number, data: string) => void): this
  on(event: 'exit', listener: (pid: number, code: number) => void): this
}

interface StopOptions {
  force?: boolean             // 強制停止
  timeout?: number            // 超時時間（毫秒）
  signal?: NodeJS.Signals     // 信號
}

interface ProcessInfo {
  pid: number
  memory: number              // 記憶體使用（bytes）
  cpu: number                 // CPU 使用率（%）
  uptime: number              // 運行時間（秒）
}
```

### 型別定義參考

```typescript
// Server 相關型別
type ServerType = 'vanilla' | 'paper' | 'fabric' | 'forge'

type ServerStatus = 
  | 'stopped'      // 已停止
  | 'starting'     // 啟動中
  | 'running'      // 運行中
  | 'stopping'     // 停止中
  | 'crashed'      // 崩潰

interface Server {
  id: string
  config: ServerConfig
  path: string
  status: ServerStatus
  createdAt: Date
  lastStarted?: Date
  lastStopped?: Date
  pid?: number
}

interface ServerConfig {
  name: string
  version: string
  type: ServerType
  port: number
  memory: MemoryConfig
  jvmArgs?: string[]
  autoRestart?: boolean
  backupEnabled?: boolean
}

interface MemoryConfig {
  min: string                 // 例如: "1G", "512M"
  max: string                 // 例如: "2G", "4G"
}

// server.properties 型別
interface ServerProperties {
  'server-port': number
  'max-players': number
  'level-name': string
  'gamemode': 'survival' | 'creative' | 'adventure' | 'spectator'
  'difficulty': 'peaceful' | 'easy' | 'normal' | 'hard'
  'hardcore': boolean
  'pvp': boolean
  'online-mode': boolean
  'white-list': boolean
  'motd': string
  'max-world-size': number
  'view-distance': number
  'simulation-distance': number
  [key: string]: any
}

// Java 相關型別
interface JavaInstallation {
  version: string             // 例如: "17.0.9"
  majorVersion: number        // 例如: 17
  path: string                // Java 執行檔路徑
  vendor: string              // 例如: "Adoptium", "Oracle"
  architecture: string        // 例如: "x64", "arm64"
  home: string                // JAVA_HOME 路徑
}

// 進程相關型別
interface ProcessConfig {
  javaPath: string
  jarPath: string
  workingDir: string
  memory: MemoryConfig
  jvmArgs: string[]
  args: string[]
  env?: Record<string, string>
}
```

---

## 故障排除

### 常見問題

#### 1. 無法啟動伺服器

**症狀**：點擊啟動按鈕後，伺服器狀態一直是 "starting"

**可能原因與解決方法**：

```bash
# 檢查 Java 是否正確安裝
java -version

# 檢查伺服器 JAR 檔案是否存在
ls -la /path/to/server/server.jar

# 檢查記憶體設定是否合理
# 確保系統有足夠的可用記憶體

# 查看詳細錯誤日誌
lumix logs <server-name> --follow
```

#### 2. Java 版本不相容

**症狀**：伺服器啟動失敗，日誌顯示 "Unsupported class file major version"

**解決方法**：

```typescript
// 使用 JavaManager 檢查相容性
const javaManager = new JavaManager()
const requiredVersion = javaManager.getRequiredJavaVersion('1.20.4')
console.log(`需要 Java ${requiredVersion}`)

// 自動安裝正確版本
await javaManager.installJava(requiredVersion)
```

#### 3. 端口已被占用

**症狀**：伺服器無法啟動，日誌顯示 "Address already in use"

**解決方法**：

```bash
# Windows
netstat -ano | findstr :25565
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :25565
kill -9 <PID>

# 或在 Lumix 中更改端口
lumix config <server-name> --port 25566
```

#### 4. EULA 未同意

**症狀**：伺服器啟動後立即停止，日誌提示需要同意 EULA

**解決方法**：

Lumix 應該自動處理，但如果失敗：

```bash
# 手動編輯 eula.txt
cd /path/to/server
echo "eula=true" > eula.txt
```

#### 5. 記憶體不足

**症狀**：伺服器崩潰，日誌顯示 "OutOfMemoryError"

**解決方法**：

```typescript
// 增加記憶體配置
await serverManager.updateServerConfig(serverId, {
  memory: {
    min: '2G',
    max: '4G'  // 增加到 4GB
  }
})
```

### 日誌位置

```bash
# 應用程式日誌
~/.lumix/logs/app.log

# 伺服器日誌
~/.lumix/servers/<server-name>/logs/latest.log

# Electron 日誌（僅 GUI）
~/.lumix/logs/electron.log
```

### 偵錯模式

```bash
# 啟用 DEBUG 模式
export DEBUG=lumix:*
lumix start <server-name>

# 或在 GUI 中啟用
設定 > 開發者選項 > 啟用偵錯日誌
```

---

## 貢獻指南

### 貢獻流程

1. **Fork 專案**
```bash
git clone https://github.com/your-username/lumix.git
cd lumix
```

2. **創建功能分支**
```bash
git checkout -b feature/your-feature-name
```

3. **進行開發**
```bash
# 安裝依賴
pnpm install

# 開發
pnpm dev

# 測試
pnpm test
```

4. **提交變更**
```bash
git add .
git commit -m "feat: add your feature description"
```

5. **推送並創建 Pull Request**
```bash
git push origin feature/your-feature-name
```

### Commit 規範

使用 Conventional Commits 格式：

```bash
feat: 新功能
fix: 錯誤修復
docs: 文檔更新
style: 代碼格式調整
refactor: 重構
test: 測試相關
chore: 建置或工具變更
```

範例：
```bash
feat(core): add Fabric server support
fix(gui): resolve server list update issue
docs: update API reference
```

### 代碼風格

專案使用 ESLint + Prettier：

```bash
# 檢查代碼風格
pnpm lint

# 自動修復
pnpm lint --fix

# 格式化代碼
pnpm format
```

### Pull Request 檢查清單

- [ ] 代碼通過所有測試
- [ ] 新功能包含單元測試
- [ ] 更新相關文檔
- [ ] Commit 訊息符合規範
- [ ] 代碼風格符合專案標準
- [ ] 無 TypeScript 錯誤

### 新增伺服器核心支援

如需添加新的伺服器核心（例如 Purpur）：

1. 創建 Downloader
```typescript
// packages/core/src/downloaders/PurpurDownloader.ts
export class PurpurDownloader {
  async getVersions(): Promise<string[]> {
    // 實作
  }
  
  async download(version: string, dest: string): Promise<void> {
    // 實作
  }
}
```

2. 更新型別定義
```typescript
// packages/core/src/types/index.ts
type ServerType = 'vanilla' | 'paper' | 'fabric' | 'forge' | 'purpur'
```

3. 整合到 ServerManager
```typescript
// packages/core/src/managers/ServerManager.ts
private getDownloader(type: ServerType) {
  switch (type) {
    case 'purpur':
      return new PurpurDownloader()
    // ...
  }
}
```

4. 添加測試
```typescript
// packages/core/tests/PurpurDownloader.test.ts
describe('PurpurDownloader', () => {
  it('should download Purpur server', async () => {
    // 測試
  })
})
```

---

## 附錄

### 參考資源

- [Minecraft Wiki](https://minecraft.fandom.com/wiki/Server)
- [Paper API Documentation](https://papermc.io/api/docs)
- [Fabric Wiki](https://fabricmc.net/wiki)
- [Forge Documentation](https://docs.minecraftforge.net/)
- [Electron Documentation](https://www.electronjs.org/docs)

### 授權條款

本專案採用 **MIT