# Lumix 1.1.1

Lumix 1.1.1 是針對 Windows 安裝版的必要修復，解決 1.1.0 啟動時可能因遺失 runtime dependency 而立即退出的問題。

> [!IMPORTANT]
> **如果你已安裝 Lumix 1.1.0，請直接下載 1.1.1 安裝程式覆蓋安裝。**
> 1.1.0 可能在啟動時顯示 `Cannot find module 'debug'`，因此無法使用應用程式內更新。正在使用 1.0.0 的使用者可透過應用程式內更新，或手動安裝此版本。

## 下載

**[下載 Lumix 1.1.1 for Windows →](https://github.com/0png/Lumix/releases/download/v1.1.1/Lumix-Setup-1.1.1.exe)**

- Windows 10 / 11（x64）
- 安裝程式：`Lumix-Setup-1.1.1.exe`
- SHA-256：`18311e4653bcba65712d2f58c380902988a74568b94bbad5c387a42e6de34435`

## 修正內容

- 修復 1.1.0 Windows 安裝版因封裝時遺漏傳遞依賴，導致 Electron main process 無法啟動的問題。
- 將壓縮檔解包所需的 runtime dependencies 直接 bundle 進 main process，避免安裝後受 `node_modules` 結構影響。

## 可靠性改善

- 新增 production main bundle 檢查；如果建置結果仍存在未預期的外部 runtime dependency，會在打包前直接失敗。
- 新增 Windows 發布前啟動 smoke test，直接執行打包後的 Lumix，確認 main process 可正常持續運行。
- 發布前重新核對安裝程式、blockmap、更新 metadata 與 SHA-256 digest。

## 同時包含 Lumix 1.1 的新功能

- NeoForge 與 Purpur 伺服器完整支援
- Modrinth 與 CurseForge 伺服器模組包匯入
- 全新的伺服器儀表板、詳細資訊與連線診斷
- 大型設定工作區 Modal 與短促的介面微動效
- 黑畫面防護與頁面層級錯誤復原

> [!NOTE]
> Lumix 目前尚未提供程式碼簽章，Windows SmartScreen 可能顯示保護提示。請只從本 repo 的 GitHub Releases 下載，並可使用上方 SHA-256 驗證檔案。

**[查看 v1.1.0...v1.1.1 完整變更](https://github.com/0png/Lumix/compare/v1.1.0...v1.1.1)**
