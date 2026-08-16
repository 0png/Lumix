# Lumix 1.1.0 Release Notes

**版本**: 1.1.0

**發布日期**: 2026-08-16

**類型**: Feature Release

## 概述

Lumix 1.1.0 擴充了伺服器核心與模組包支援，並重新整理桌面管理體驗。這次更新加入 NeoForge、Purpur 與 Modrinth／CurseForge 模組包匯入，同時強化既有伺服器匯入、啟動流程、連線診斷與 renderer 異常復原。

介面方面，伺服器儀表板與詳細資訊改為更緊湊的桌面配置；設定則改為大型工作區 Modal，以一般／Java 二級導覽呈現，並加入短促、低幅度且支援 reduced motion 的微動效。

## 版本重點

### NeoForge 與 Purpur

- 完整支援 NeoForge 版本探索、安裝器建置、args-file 啟動與既有伺服器匯入
- 透過 Purpur 官方 v2 API 探索版本與下載最新 build
- 為 NeoForge、Purpur 補齊專屬圖示、建立流程、記憶體建議與中英文文案
- 改善現代 Forge／NeoForge 啟動 metadata 與舊版 `forge-config.json` 相容性

### 模組包匯入

- 支援 Modrinth 與 CurseForge 格式的伺服器模組包
- 匯入前掃描並顯示 Minecraft 版本、loader 與記憶體配置
- 提供驗證、下載進度、錯誤回饋與完成後伺服器建立流程

### 伺服器管理體驗

- 重構伺服器儀表板、卡片與詳細資訊為更緊湊的桌面配置
- 改善新增伺服器入口，清楚區分標準建立、模組包匯入與既有伺服器匯入
- 更新側欄、標題列、console 與首次使用引導
- 強化本機、區網與外網連線資訊與診斷提示

### 設定工作區

- 將獨立設定頁改為大型工作區 Modal，保留使用者目前所在畫面
- 使用「一般／Java」二級導覽與單欄設定內容
- 主題與語言改為緊湊 Select，記憶體配置使用橫向 Slider
- Java 安裝改為單欄清單，支援重新偵測與長路徑顯示
- Modal 使用 `cubic-bezier(0.34, 1.56, 0.64, 1)` 進場
- 導覽、Select、Slider、按鈕與清單加入短促微動效，並支援 `prefers-reduced-motion`

### 穩定性

- 修復切換至較短頁面時，舊 scroll position 造成空白或黑畫面的問題
- 新增 view-level error boundary，renderer 異常時可安全返回伺服器儀表板
- 改善伺服器下載、匯入、啟動 metadata 與生命週期處理
- 擴充下載、Forge 安裝、匯入、模組包、生命週期、連線診斷與備份測試

## 安裝方式

從 [GitHub Releases](https://github.com/0png/Lumix/releases) 下載：

- `Lumix-Setup-1.1.0.exe`

若已安裝 Lumix 1.0.0，可透過應用程式內的更新檢查下載 1.1.0。

## 系統需求

- Windows 10 / 11
- 建議 4GB 以上記憶體
- 至少 500MB 可用空間
- 下載伺服器核心、模組包、Java 或更新時需要網路

## 驗證摘要

本次發版前完成：

- `pnpm --filter @lumix/app typecheck`
- `pnpm --filter @lumix/app lint`
- `pnpm --filter @lumix/app test`
- `pnpm --filter @lumix/app build`
- `pnpm --filter @lumix/app build:win`
- Windows 1000×650 與寬視窗設定 Modal 實機檢查
- 鍵盤焦點、Select、Esc 關閉與 Java 長清單檢查

## 已知限制

- Lumix 目前以 Windows-first 為主要發布與驗證目標
- 少數非標準或自行修改啟動腳本的伺服器，匯入時仍可能需要手動確認核心與版本
- Lumix 不會自動設定路由器連接埠轉發或代管遠端連線
- 自動更新需依賴 GitHub Release 中的安裝程式、blockmap 與 `latest.yml`

## 回報問題

- [GitHub Issues](https://github.com/0png/Lumix/issues)
- [GitHub Releases](https://github.com/0png/Lumix/releases)

回報時建議附上 Windows、Java、Minecraft 與核心版本，以及錯誤訊息和重現步驟。
