# Lumix 自動更新與發版設定指南

## 概述

Lumix 使用 `electron-updater` 搭配 GitHub Releases 提供桌面版自動更新。  
目前設定的發布目標為 `0png/Lumix`，正式版與後續更新都應沿用這個 repo。

## 目前發版設定

`packages/app/package.json` 的 `build.publish` 已設定為：

```json
"publish": {
  "provider": "github",
  "owner": "0png",
  "repo": "Lumix"
}
```

Windows 安裝程式會輸出為：

```text
Lumix-Setup-<version>.exe
```

## 發布前準備

1. 確認版本號已同步更新
   - `package.json`
   - `packages/app/package.json`
2. 更新 `CHANGELOG.md`
3. 更新 `RELEASE.md`
4. 設定 `GH_TOKEN`

PowerShell:

```powershell
$env:GH_TOKEN="your-github-token"
```

## 驗證指令

在 repo root 執行：

```bash
pnpm --filter @lumix/app typecheck
pnpm --filter @lumix/app lint
pnpm --filter @lumix/app test
pnpm --filter @lumix/app build
pnpm --filter @lumix/app build:win
```

## 發布方式

### 方式一：在 app 目錄使用 electron-builder

```bash
cd packages/app
npx electron-builder --win --publish always
```

### 方式二：先打包，再依需要手動上傳 Release 資產

```bash
pnpm --filter @lumix/app build:win
```

輸出檔案位於：

```text
packages/app/dist/
```

至少應包含：

- `Lumix-Setup-<version>.exe`
- `Lumix-Setup-<version>.exe.blockmap`
- `latest.yml`

## 更新測試流程

自動更新無法在開發模式中完整驗證，請使用已建置版本測試：

1. 先發布目前版本到 GitHub Releases
2. 將版本號提升到下一個版本，例如 `1.0.0` -> `1.0.1`
3. 重新建置並發布新版安裝檔
4. 在已安裝舊版的 Windows 環境啟動 Lumix
5. 確認可以檢查到更新、下載並完成重新啟動安裝

## 發布檢查清單

- [ ] 版本號一致
- [ ] `CHANGELOG.md` 已更新
- [ ] `RELEASE.md` 已更新
- [ ] `GH_TOKEN` 已設定
- [ ] `pnpm --filter @lumix/app typecheck` 通過
- [ ] `pnpm --filter @lumix/app lint` 通過
- [ ] `pnpm --filter @lumix/app test` 通過
- [ ] `pnpm --filter @lumix/app build` 通過
- [ ] `pnpm --filter @lumix/app build:win` 通過
- [ ] GitHub Release 內容與版本號一致
- [ ] Release 資產包含安裝程式與 `latest.yml`

## 常見問題

### 檢查不到更新

- 確認 GitHub Release 已發布且版本號比目前安裝版本新
- 確認 `latest.yml` 已隨 Release 資產一併提供
- 確認 `owner/repo` 仍是 `0png/Lumix`

### 下載或安裝失敗

- 確認 Release 資產可公開存取
- 確認 Windows 防火牆或防毒軟體沒有阻擋
- 確認目前使用者有安裝更新所需權限

## 相關檔案

- `packages/app/package.json`
- `packages/app/src/main/services/update-service.ts`
- `packages/app/src/main/ipc/update-handlers.ts`
- `packages/app/src/renderer/src/hooks/use-update.ts`
