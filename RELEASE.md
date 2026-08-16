# Lumix 1.0.0 Release Notes

**版本**: 1.0.0  
**發布日期**: 2026-05-17  
**類型**: Formal Release

## 概述

Lumix 1.0.0 是一個 Windows-first 的 Minecraft 伺服器啟動與管理工具，提供從建立、匯入、啟停、備份還原，到連線資訊與更新檢查的一體化桌面體驗。

本次正式版以目前已經落地的功能為準，重點是把核心伺服器操作流程收斂成可穩定發布、可實際使用、可持續更新的正式產品。

## 正式版重點

### 伺服器管理
- 建立、啟動、停止、刪除 Minecraft 伺服器
- 支援 Vanilla、Paper、Purpur、Fabric、Forge、NeoForge 核心
- 即時 console 輸出與指令輸入
- 圖形化編輯 `server.properties`
- 一鍵開啟伺服器資料夾

### 匯入與首次使用流程
- 匯入既有伺服器資料夾並納入 Lumix 管理
- 自動辨識 Purpur，以及使用 `run.bat` / args file 啟動的 Forge、NeoForge 伺服器
- 支援 Modrinth 與 CurseForge 格式的 NeoForge 模組包
- 建立新伺服器後顯示首次引導 checklist
- 快速導向 Java、記憶體、設定、連線資訊與啟動動作

### Java 與版本相容
- 自動偵測系統已安裝的 Java
- 依 Minecraft 版本匹配合適的 Java 版本
- 支援自訂 Java 路徑

### 備份與還原
- 建立手動與排程備份
- 顯示備份清單、建立時間、大小與路徑
- 還原前執行 preflight 檢查
- 支援還原前自動建立保護性備份

### 連線資訊與診斷
- 顯示 `localhost`、LAN 位址與連接埠資訊
- 區分本機、區網與外網使用情境
- 提示常見連線問題與可行下一步

### 更新與桌面體驗
- 整合 GitHub Releases 自動更新
- 啟動後自動檢查更新
- 提供手動檢查、下載進度與重新啟動安裝流程
- 支援繁體中文與 English
- 支援淺色、深色與跟隨系統主題

## 系統需求

- 作業系統: Windows 10 / 11
- 記憶體: 建議 4GB 以上
- 可用空間: 至少 500MB
- 網路: 下載伺服器核心、更新與版本資料時需要網路
- Java:
  - MC 1.16.x 及以下建議 Java 8
  - MC 1.17 至 1.20.4 建議 Java 17
  - MC 1.20.5 以上建議 Java 21

## 安裝方式

從 [GitHub Releases](https://github.com/0png/Lumix/releases) 下載：

- `Lumix-Setup-1.0.0.exe`

安裝完成後首次啟動，Lumix 會自動偵測系統 Java 並可立即建立或匯入伺服器。

## 已知限制

- 產品目前以 Windows-first 為主，本次正式版發布與驗證目標為 Windows 桌面環境
- 少數非標準或自行修改過啟動腳本的模組伺服器，匯入時仍可能需要手動確認核心與版本
- Lumix 可提供區網與外網連線診斷，但不會自動設定路由器轉發或代管遠端連線
- 自動更新需要 GitHub Release 資產與版本資訊正確發布後才會生效

## 驗證摘要

本次正式版發版前已完成：

- 手動功能測試
- `pnpm --filter @lumix/app typecheck`
- `pnpm --filter @lumix/app lint`
- `pnpm --filter @lumix/app test`
- `pnpm --filter @lumix/app build`
- `pnpm --filter @lumix/app build:win`

## 回報問題

- GitHub Releases: https://github.com/0png/Lumix/releases
- GitHub Issues: https://github.com/0png/Lumix/issues

回報問題時建議附上：
- Windows 版本
- Java 版本
- Minecraft 版本與核心類型
- 錯誤訊息
- 重現步驟

## 授權

- License: MIT
- Author: 0png
