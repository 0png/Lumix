# Lumix 1.1.1 Release Notes

**版本**: 1.1.1

**發布日期**: 2026-08-16

**類型**: Hotfix Release

## 重要修正

Lumix 1.1.1 修復 1.1.0 Windows 安裝版啟動時出現 `Cannot find module 'debug'`，導致 main process 無法啟動的問題。

問題源自 `extract-zip` 被保留為 production external module，但 electron-builder 在 pnpm workspace 打包時只收錄套件本體，沒有一併收錄 `debug`、`yauzl` 等傳遞依賴。

1.1.1 將 `extract-zip` 與其 runtime dependencies 直接 bundle 進 Electron main process，不再依賴安裝包內的傳遞 `node_modules` 結構。

## 防回歸措施

- 新增 production main bundle 驗證腳本
- 建置時若發現非 Electron／Node built-in 的外部 `require()`，會直接讓 build 失敗
- 發布前直接啟動 `win-unpacked/Lumix.exe`，確認 main process 能持續運行
- 核對安裝程式、blockmap 與 `latest.yml` 的版本和 digest

## 1.1 系列功能

- NeoForge 與 Purpur 完整支援
- Modrinth／CurseForge 模組包匯入
- 伺服器儀表板、詳細資訊與連線診斷改版
- 大型設定工作區 Modal 與 Linear-style 微動效
- renderer 黑畫面防護與 view-level error recovery

## 安裝方式

請勿使用 Lumix 1.1.0，改由 [GitHub Releases](https://github.com/0png/Lumix/releases) 下載：

- `Lumix-Setup-1.1.1.exe`

已安裝 1.0.0 的使用者可透過應用程式內更新功能升級。1.1.0 因無法啟動，請直接執行 1.1.1 安裝程式覆蓋安裝。

## 驗證摘要

- `pnpm --filter @lumix/app typecheck`
- `pnpm --filter @lumix/app lint`
- `pnpm --filter @lumix/app test`
- `pnpm --filter @lumix/app build`
- `pnpm --filter @lumix/app build:win`
- Production main bundle external dependency gate
- Windows unpacked executable startup smoke test
