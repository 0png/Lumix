# Implementation Plan: Playit.gg Integration

## Overview

本實作計畫將 playit.gg 隧道服務整合到 Lumix 中，讓使用者可以一鍵開啟公開連線。採用漸進式開發，每個階段都能編譯並通過測試。

## Tasks

- [ ] 1. 建立 IPC 通道與類型定義
  - [ ] 1.1 新增 Playit IPC Channels
    - 更新 `packages/app/src/shared/ipc-channels.ts`
    - 新增 PlayitChannels 常數 (CHECK_INSTALLED, DOWNLOAD_AGENT, START_TUNNEL, STOP_TUNNEL, OPEN_CLAIM, GET_STATUS, CLEAR_AUTH)
    - 新增事件通道 (STATUS_CHANGED, CLAIM_URL, DOWNLOAD_PROGRESS)
    - _Requirements: 3.1, 5.2_

  - [ ] 1.2 新增 Playit 類型定義
    - 更新 `packages/app/src/shared/ipc-types.ts`
    - 定義 TunnelStatus type
    - 定義 TunnelStatusEvent, ClaimUrlEvent interfaces
    - 定義 PlayitSettings interface
    - 定義 PlayitError, PlayitResult interfaces
    - _Requirements: 5.1, 6.1_

- [ ] 2. Checkpoint - 確保類型定義可編譯
  - 執行 TypeScript 編譯檢查

- [ ] 3. 建立 PlayitService 核心服務
  - [ ] 3.1 建立 PlayitService 基礎架構
    - 建立 `packages/app/src/main/services/playit-service.ts`
    - 定義 PlayitService class 與 EventEmitter
    - 實作 `getAgentPath()` 取得 agent 儲存路徑
    - 實作 `isAgentInstalled()` 檢查 agent 是否存在
    - _Requirements: 1.1, 1.5_

  - [ ] 3.2 實作 Agent 下載功能
    - 實作 `downloadAgent()` 下載對應平台的 agent
    - 實作下載進度回報 (emit download-progress event)
    - 處理下載失敗的錯誤
    - 設定執行權限 (macOS/Linux)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 3.3 實作 Secret Key 管理
    - 實作 `hasSecretKey()` 檢查是否有儲存的 key
    - 實作 `getSecretKey()` 取得儲存的 key
    - 實作 `saveSecretKey()` 儲存 key 到 settings
    - 實作 `clearSecretKey()` 清除 key (登出)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 3.4 實作隧道啟動邏輯
    - 實作 `startTunnel(serverId, port)` 啟動隧道
    - 若無 secret key，啟動 agent 並解析 claim URL
    - 若有 secret key，使用 `--secret` 參數啟動
    - 發射 status-changed 事件
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [ ] 3.5 實作 Agent 輸出解析
    - 解析 claim URL 輸出
    - 解析 secret key 輸出
    - 解析 tunnel address 輸出
    - 發射對應事件 (claim-url, status-changed)
    - _Requirements: 2.4, 3.2, 4.4_

  - [ ] 3.6 實作隧道停止邏輯
    - 實作 `stopTunnel(serverId)` 停止隧道
    - 終止 agent process
    - 更新狀態為 disconnected
    - _Requirements: 3.3, 3.4_

  - [ ] 3.7 實作狀態查詢
    - 實作 `getTunnelStatus(serverId)` 取得當前狀態
    - 返回 TunnelStatus 與 publicAddress
    - _Requirements: 5.1, 5.3_

- [ ] 4. Checkpoint - 確保 PlayitService 功能完整
  - 撰寫基本 unit tests
  - 確保所有方法可正常呼叫

- [ ] 5. 建立 IPC Handlers
  - [ ] 5.1 建立 playit-handlers.ts
    - 建立 `packages/app/src/main/ipc/playit-handlers.ts`
    - 實作所有 IPC handlers
    - 連接 PlayitService 方法
    - _Requirements: 3.1, 5.2_

  - [ ] 5.2 實作事件轉發
    - 監聽 PlayitService 的 status-changed 事件
    - 監聽 PlayitService 的 claim-url 事件
    - 監聯 PlayitService 的 download-progress 事件
    - 轉發事件到所有 BrowserWindow
    - _Requirements: 5.2_

  - [ ] 5.3 更新 IPC index
    - 更新 `packages/app/src/main/ipc/index.ts`
    - 匯出 initPlayitHandlers
    - _Requirements: N/A_

  - [ ] 5.4 更新 main/index.ts
    - 初始化 PlayitService
    - 呼叫 initPlayitHandlers
    - 在 app quit 時清理資源
    - _Requirements: N/A_

- [ ] 6. Checkpoint - 確保 IPC 整合完成
  - 測試 IPC 通道可正常呼叫

- [ ] 7. 更新 Preload 與類型
  - [ ] 7.1 更新 preload/index.ts
    - 新增 playit API 到 contextBridge
    - 實作 checkInstalled, downloadAgent, startTunnel, stopTunnel
    - 實作 openClaim, getStatus, clearAuth
    - 實作事件監聽 onStatusChanged, onClaimUrl, onDownloadProgress
    - _Requirements: N/A_

  - [ ] 7.2 更新 preload/index.d.ts
    - 新增 playit API 類型定義
    - _Requirements: N/A_

- [ ] 8. 建立 React Hook
  - [ ] 8.1 建立 use-playit.ts
    - 建立 `packages/app/src/renderer/src/hooks/use-playit.ts`
    - 管理 tunnel status state
    - 管理 download progress state
    - 管理 auth dialog state
    - 實作 startTunnel, stopTunnel, clearAuth actions
    - 監聽 IPC 事件並更新 state
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 9. Checkpoint - 確保 Hook 功能完整
  - 測試 hook 可正常使用

- [ ] 10. 建立 UI 元件
  - [ ] 10.1 建立 AuthModeDialog 元件
    - 建立 `packages/app/src/renderer/src/components/playit/AuthModeDialog.tsx`
    - 顯示「訪客模式」與「註冊/登入」選項
    - 說明兩種模式的差異
    - 點擊後開啟 claim URL
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 10.2 建立 TunnelSection 元件
    - 建立 `packages/app/src/renderer/src/components/playit/TunnelSection.tsx`
    - 顯示隧道狀態 (disconnected, connecting, connected, error)
    - 顯示公開地址與複製按鈕
    - 顯示啟動/停止按鈕
    - 顯示下載進度 (首次使用時)
    - 伺服器未運行時禁用控制項
    - _Requirements: 3.2, 4.1, 4.2, 4.3, 5.1, 5.3, 8.2, 8.3_

  - [ ] 10.3 整合到 ServerDetail
    - 更新 `packages/app/src/renderer/src/components/server/ServerDetail.tsx`
    - 在適當位置加入 TunnelSection
    - 傳入 serverId, serverPort, serverStatus props
    - _Requirements: 8.1, 8.4_

- [ ] 11. 新增 i18n 翻譯
  - [ ] 11.1 更新英文翻譯
    - 更新 `packages/app/src/renderer/src/i18n/locales/en.json`
    - 新增 playit 相關翻譯 key
    - _Requirements: N/A_

  - [ ] 11.2 更新繁體中文翻譯
    - 更新 `packages/app/src/renderer/src/i18n/locales/zh-TW.json`
    - 新增 playit 相關翻譯 key
    - _Requirements: N/A_

- [ ] 12. Checkpoint - 確保 UI 整合完成
  - 測試完整流程
  - 確保所有翻譯正確顯示

- [ ] 13. 錯誤處理強化
  - [ ] 13.1 實作錯誤處理
    - 處理下載失敗 (DOWNLOAD_FAILED, NETWORK_ERROR)
    - 處理認證失敗 (AUTH_TIMEOUT, INVALID_SECRET)
    - 處理程序錯誤 (SPAWN_FAILED, AGENT_CRASHED)
    - 顯示友善的錯誤訊息
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 13.2 實作重試機制
    - 下載失敗時顯示重試按鈕
    - 認證失敗時允許重新認證
    - _Requirements: 1.3, 2.6_

- [ ] 14. 撰寫測試
  - [ ] 14.1 撰寫 PlayitService unit tests
    - 測試 agent 安裝檢查
    - 測試 secret key 管理
    - 測試狀態轉換
    - _Requirements: All_

  - [ ] 14.2 撰寫 property tests
    - **Property 1: Agent Download Idempotency**
    - **Property 5: Secret Key Persistence**
    - **Property 7: Status Transitions Emit Events**
    - _Requirements: 1.5, 5.2, 6.1_

- [ ] 15. Final Checkpoint - 確保所有功能完成
  - 執行所有測試
  - 測試完整使用流程
  - 確認錯誤處理正常運作

## Notes

- 每個任務都參照特定需求以確保可追溯性
- Checkpoint 任務用於確保階段性驗證
- 優先實作核心功能，UI 可後續優化
- Agent 下載 URL 使用 GitHub releases，確保穩定性
