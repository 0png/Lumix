# AGENTS.md

## 語言

- 與使用者溝通一律使用繁體中文。

## 專案定位

- 這是 `pnpm workspace` monorepo，目前主要產品是 `packages/app`。
- `packages/app` 是 Windows 優先的 Minecraft Server Launcher，技術棧為 Electron + Vite + React + TypeScript。
- 主要功能包含伺服器建立/啟停、Java 偵測、版本下載、即時 console、設定、以及 GitHub Release 自動更新。

## 目錄重點

- `package.json`: workspace 層級指令入口。
- `packages/app/package.json`: Electron app 的開發、測試、建置與打包指令。
- `packages/app/src/main`: Electron main process，負責視窗、IPC handler 註冊、伺服器程序/下載/更新等系統層服務。
- `packages/app/src/preload`: 透過 `contextBridge` 暴露安全 API 給 renderer。
- `packages/app/src/shared`: IPC channels 與共用型別。跨 process contract 先看這裡。
- `packages/app/src/renderer/src`: React UI、hooks、contexts、i18n、shadcn/ui 元件。
- `packages/app/resources`: 打包資源，例如 icon。
- `RELEASE.md`: 版本內容與功能摘要。
- `UPDATE_SETUP.md`: 自動更新設定說明；內有 placeholder repo/owner 時，修改前先核對現況，不要照抄。

## 開發原則

- 先釐清變更落點是在 `main`、`preload`、`shared` 還是 `renderer`，不要跨層硬塞邏輯。
- Renderer 不要直接碰 Node/Electron 能力；需要新能力時，先補 `shared` type/channel，再補 `main` handler，最後經 `preload` 暴露給前端。
- 變更 IPC 時，`src/shared/ipc-channels.ts`、`src/shared/ipc-types.ts`、`src/main/ipc/*`、`src/preload/index.ts` 與對應 renderer hook/UI 要一起檢查。
- 伺服器生命週期、下載、Java 偵測、更新流程屬於 main process service 邏輯，優先改 `packages/app/src/main/services`，不要把流程判斷塞進 React component。
- UI 文案若有改動，至少同步檢查 `packages/app/src/renderer/src/i18n/locales/zh-TW.json` 與 `en.json`，避免只改單一語系。
- 這個 repo 現在已使用 `useCallback` 等既有 React pattern；新增程式碼時先維持現有風格，不要混入另一套狀態管理或資料流。
- 視窗設定目前有固定最小尺寸 `1000x650`；UI 改版若影響 layout，需注意桌面 app 實際視窗限制，不要只用一般網站響應式思維處理。

## 常用指令

在 repo root 執行：

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

針對 app 單獨操作：

```bash
pnpm --filter @lumix/app dev
pnpm --filter @lumix/app build
pnpm --filter @lumix/app test
pnpm --filter @lumix/app lint
pnpm --filter @lumix/app typecheck
pnpm --filter @lumix/app build:win
```

## 驗證準則

- 一般程式碼修改完成後，至少跑受影響範圍的 `typecheck`、`lint`、`test`。
- 若改到跨層 contract、IPC、shared type、或 build config，預設跑 root 的 `pnpm typecheck`、`pnpm test`、`pnpm build`。
- 若改到 Electron 打包、更新機制、資源路徑、或 installer 相關設定，再補 `pnpm --filter @lumix/app build:win`。
- 若無法執行 GUI 驗證，至少用建置、型別、測試與靜態檢查確認沒有明顯回歸。

## 修改建議

- 新增功能前，先用 `rg` 搜尋既有 hook、service、IPC handler，通常已有接近的實作模式可延用。
- 若改動設定、版本號、release 流程，同步檢查根 `package.json`、`packages/app/package.json`、`RELEASE.md`、`CHANGELOG.md`。
- 自動更新功能依賴 `electron-updater` 與 `build.publish` 設定；若要處理發布問題，先核對 `owner/repo` 是否仍是正確值。
- 若要新增 UI 元件，先檢查 `packages/app/src/renderer/src/components/ui` 是否已有可重用元件，避免重複造輪子。

## 避免事項

- 不要讓 renderer 直接使用 `ipcRenderer`；統一走 `window.electronAPI`。
- 不要只改 IPC 的單一端點而忽略 shared contract，這類變更很容易在 build 前後出現型別與執行期不一致。
- 不要把與伺服器程序、檔案系統、下載、Java 偵測有關的副作用藏進純展示元件。
- 未經確認前，不要假設 `UPDATE_SETUP.md` 中的發布步驟或 repo placeholder 仍然完全正確。

## 交付風格

- 回覆時先講實際做了什麼，再補驗證結果與尚未驗證的風險。
- 若只做說明或 repo 導覽，保持精簡直接；若有實作，預設直接改完並驗證，不停在純建議。
