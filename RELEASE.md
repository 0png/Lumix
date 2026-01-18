# Lumix Beta Release Notes

**版本**: 0.1.0-beta  
**發布日期**: 2026-01-18  
**類型**: Beta Release

## 概述

Lumix Beta 是一個跨平台的 Minecraft 伺服器管理工具，提供直覺的圖形介面來建立、管理和監控 Minecraft 伺服器。此 Beta 版本包含核心功能與自動更新系統。

## 新增功能

### 🎮 伺服器管理
- **多核心支援**: 支援 Vanilla、Paper、Fabric、Forge 四種伺服器核心
- **伺服器生命週期管理**: 建立、啟動、停止、刪除伺服器
- **即時控制台**: 顯示伺服器日誌並支援指令輸入
- **伺服器屬性編輯器**: 圖形化編輯 server.properties（難度、遊戲模式、最大玩家數等）
- **資料夾快速開啟**: 一鍵開啟伺服器資料夾

### ☕ Java 管理
- **自動偵測**: 自動偵測系統已安裝的 Java 版本
- **版本匹配**: 根據 Minecraft 版本自動選擇合適的 Java 版本
- **Java 路徑管理**: 支援自訂 Java 路徑

### 🔄 自動更新系統（本次新增）
- **自動檢查更新**: 應用程式啟動 3 秒後自動檢查 GitHub Release 更新
- **手動檢查更新**: 在關於頁面提供「檢查更新」按鈕
- **下載進度顯示**: 即時顯示更新下載進度
- **一鍵安裝**: 下載完成後可立即重啟並安裝更新
- **更新通知**: 使用 toast 通知提示使用者更新狀態

### 🌍 多語系支援
- **繁體中文** (zh-TW)
- **English** (en)
- 所有 UI 元素與訊息皆支援多語系

### 🎨 主題系統
- **淺色主題**: 適合白天使用
- **深色主題**: 適合夜間使用
- **跟隨系統**: 自動跟隨作業系統主題設定

## 技術架構

### 前端技術棧
- **Electron 28**: 跨平台桌面應用框架
- **React 18**: UI 框架
- **TypeScript 5**: 型別安全
- **Vite 5**: 快速建置工具
- **Tailwind CSS 3**: 樣式框架
- **Radix UI**: 無障礙 UI 元件庫
- **shadcn/ui**: UI 元件集合

### 後端服務
- **ServerManager**: 伺服器生命週期管理
- **ProcessManager**: 程序管理與監控
- **FileManager**: 檔案系統操作
- **DownloadService**: 伺服器 JAR 下載
- **UpdateService**: 自動更新服務（新增）
- **JavaDetector**: Java 版本偵測

### 測試覆蓋
- **164 個測試案例**: 包含單元測試與 property-based testing
- **測試覆蓋範圍**: ServerManager, ProcessManager, FileManager, DownloadService
- **測試框架**: Vitest + fast-check

## 已知限制

### 功能限制
1. **Forge 安裝器**: 目前僅支援基本的 Forge 安裝流程，部分版本可能需要手動處理
2. **Java 8 支援**: 系統無法自動安裝 Java 8，需使用者手動安裝
3. **更新功能**: 開發模式下無法測試更新功能，需建置正式版本

### 平台支援
- **Windows**: 完整支援（已測試）
- **macOS**: 理論支援（未完整測試）
- **Linux**: 理論支援（未完整測試）

## 安裝需求

### 系統需求
- **作業系統**: Windows 10/11, macOS 10.15+, Linux (Ubuntu 20.04+)
- **記憶體**: 建議 4GB 以上
- **硬碟空間**: 至少 500MB 可用空間
- **網路**: 需要網路連線以下載伺服器 JAR 與更新

### 軟體需求
- **Java**: 根據 Minecraft 版本需要 Java 8/17/21
  - MC 1.16 及以下: Java 8
  - MC 1.17-1.20.4: Java 17
  - MC 1.20.5+: Java 21

## 安裝步驟

1. 從 [GitHub Releases](https://github.com/your-username/lumix/releases) 下載 `Lumix Setup Beta.exe`
2. 執行安裝程式
3. 選擇安裝位置（或使用預設位置）
4. 完成安裝後啟動 Lumix
5. 首次啟動會自動偵測系統 Java

## 使用指南

### 建立第一個伺服器
1. 點擊側邊欄的「新增伺服器」按鈕
2. 輸入伺服器名稱
3. 選擇核心類型（Vanilla/Paper/Fabric/Forge）
4. 選擇 Minecraft 版本
5. 設定記憶體配置（建議最小 1GB，最大 2-4GB）
6. 勾選同意 Minecraft EULA
7. 點擊「建立」並等待下載完成

### 啟動伺服器
1. 在伺服器列表中選擇伺服器
2. 點擊「啟動」按鈕
3. 等待伺服器啟動完成（控制台會顯示 "Done"）
4. 使用 Minecraft 客戶端連線到 `localhost:25565`

### 檢查更新
1. 點擊側邊欄的「關於」
2. 在應用程式資訊卡片底部點擊「檢查更新」
3. 如果有新版本，會顯示下載按鈕
4. 下載完成後點擊「立即重啟並安裝」

## 故障排除

### 伺服器無法啟動
- **檢查 Java 版本**: 確認已安裝對應版本的 Java
- **檢查記憶體**: 確認系統有足夠的可用記憶體
- **檢查埠號**: 確認 25565 埠未被佔用
- **查看日誌**: 在控制台查看詳細錯誤訊息

### 找不到 Java
- **手動安裝**: 從 [Adoptium](https://adoptium.net/) 下載並安裝對應版本的 Java
- **重新偵測**: 安裝完成後在設定頁面點擊「偵測」按鈕

### 更新失敗
- **檢查網路**: 確認網路連線正常
- **手動下載**: 從 GitHub Releases 手動下載最新版本
- **防毒軟體**: 檢查防毒軟體是否阻擋更新

## 回報問題

如果遇到問題或有功能建議，請前往：
- **GitHub Issues**: https://github.com/your-username/lumix/issues
- **提供資訊**: 作業系統版本、Java 版本、錯誤訊息、重現步驟

## 未來計畫

以下功能正在規劃中（不保證實作）：
- 插件/模組管理
- 備份與還原
- 多伺服器同時運行
- 效能監控圖表
- 遠端管理功能

## 授權資訊

- **授權**: MIT License
- **作者**: 0png
- **版權**: © 2026 0png

## 致謝

感謝以下開源專案：
- Electron
- React
- TypeScript
- Tailwind CSS
- Radix UI
- shadcn/ui
- electron-updater

---

**注意**: 這是 Beta 版本，可能存在未知的 bug。建議在測試環境中使用，不要用於生產環境的重要伺服器。
