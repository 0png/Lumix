# Electron 自動更新設定指南

## 概述

本專案已整合 `electron-updater`，可從 GitHub Release 自動檢查並下載更新。

## 配置步驟

### 1. 更新 package.json 的 publish 設定

在 `packages/app/package.json` 中的 `build.publish` 區塊，將 GitHub 資訊改為你的實際 repo：

```json
"publish": {
  "provider": "github",
  "owner": "your-github-username",
  "repo": "lumix"
}
```

### 2. 設定 GitHub Token（用於發布）

建立 GitHub Personal Access Token：
1. 前往 GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 點擊 "Generate new token (classic)"
3. 勾選 `repo` 權限
4. 複製產生的 token

設定環境變數：
```bash
# Windows (PowerShell)
$env:GH_TOKEN="your-github-token"

# macOS/Linux
export GH_TOKEN="your-github-token"
```

### 3. 建置與發布

```bash
# 建置應用程式
pnpm --filter @lumix/app build:win

# 發布到 GitHub Release（需要 GH_TOKEN）
pnpm --filter @lumix/app publish
```

或使用 electron-builder 直接發布：
```bash
cd packages/app
npx electron-builder --win --publish always
```

## 更新流程

### 自動檢查更新

應用程式啟動後 3 秒會自動檢查更新（在 `use-app.ts` 中實作）。

### 手動觸發更新

你也可以在設定頁面加入「檢查更新」按鈕：

```tsx
import { useUpdate } from '@/hooks/use-update';

function SettingsView() {
  const { checkForUpdates, checking } = useUpdate();
  
  return (
    <Button onClick={checkForUpdates} disabled={checking}>
      {checking ? '檢查中...' : '檢查更新'}
    </Button>
  );
}
```

### 更新通知

當有新版本時，會自動顯示 toast 通知：
- 點擊「下載更新」開始下載
- 下載完成後顯示「立即重啟並安裝」按鈕
- 點擊後應用程式會重啟並安裝更新

## 開發模式

在開發模式下，`electron-updater` 不會實際檢查更新。若要測試更新功能：

1. 建置正式版本
2. 發布到 GitHub Release
3. 修改版本號（例如從 0.1.0 改為 0.1.1）
4. 再次建置並執行，應該會檢測到更新

## 版本號管理

更新版本號時需同步修改：
- `package.json` (根目錄)
- `packages/app/package.json`

建議使用語意化版本號（Semantic Versioning）：
- `0.1.0` → `0.1.1` (patch: 修正 bug)
- `0.1.0` → `0.2.0` (minor: 新功能)
- `0.1.0` → `1.0.0` (major: 重大變更)

## 發布檢查清單

- [ ] 更新版本號
- [ ] 更新 CHANGELOG.md
- [ ] 執行所有測試 (`pnpm test`)
- [ ] 建置應用程式 (`pnpm build`)
- [ ] 設定 GH_TOKEN 環境變數
- [ ] 發布到 GitHub Release
- [ ] 驗證 Release 包含正確的安裝檔案

## 故障排除

### 更新檢查失敗

- 確認 `package.json` 中的 GitHub repo 資訊正確
- 確認 GitHub Release 存在且包含安裝檔案
- 檢查網路連線

### 下載失敗

- 確認 Release 中的檔案可公開存取
- 檢查防火牆設定

### 安裝失敗

- 確認使用者有足夠權限
- 檢查防毒軟體是否阻擋

## 相關檔案

- `packages/app/src/main/services/update-service.ts` - 更新服務
- `packages/app/src/main/ipc/update-handlers.ts` - IPC handlers
- `packages/app/src/renderer/src/hooks/use-update.ts` - React hook
- `packages/app/src/renderer/src/components/update/UpdateNotification.tsx` - UI 元件
