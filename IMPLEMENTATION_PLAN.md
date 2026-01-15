# 重構：移除後端邏輯，保留 Electron + UI

## Stage 1: 刪除 packages/core 套件
**目標（Goal）**: 完全移除 core 套件
**成功標準（Success Criteria）**: core 資料夾被刪除
**狀態（Status）**: In Progress

## Stage 2: 簡化 IPC Handlers 為 Mock 回應
**目標（Goal）**: 保留 IPC 架構，但 handlers 回傳 mock 資料
**成功標準（Success Criteria）**: 所有 handlers 不再依賴 core，回傳假資料
**狀態（Status）**: Not Started

## Stage 3: 更新 package.json 依賴
**目標（Goal）**: 移除對 @lumix/core 的依賴
**成功標準（Success Criteria）**: pnpm install 和 electron-vite dev 成功
**狀態（Status）**: Not Started

## Stage 4: 測試 Electron 應用程式
**目標（Goal）**: 確保 UI 可以正常顯示和互動
**成功標準（Success Criteria）**: electron-vite dev 啟動後 UI 正常運作
**狀態（Status）**: Not Started
