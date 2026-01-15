# 實作計畫：連接伺服器管理到真實後端

## 問題描述
目前 `App.tsx` 使用 mock data 和假的處理函式，伺服器建立/啟動/停止只是 UI 變化，沒有實際功能。

## Stage 1: 整合 useServers Hook 到 App.tsx
**目標（Goal）**: 將 App.tsx 從 mock data 改為使用 useServers hook
**成功標準（Success Criteria）**: 
- 伺服器列表從 IPC 載入
- 建立伺服器會呼叫真正的 API
- 啟動/停止伺服器會呼叫真正的 API
**測試（Tests）**: 手動測試 - 建立伺服器後重啟 App 資料仍存在
**狀態（Status）**: Complete

## Stage 2: 建立伺服器時下載 JAR
**目標（Goal）**: 建立伺服器時自動下載對應的伺服器 JAR 檔案
**成功標準（Success Criteria）**: 
- 建立伺服器時顯示下載進度
- JAR 檔案下載到正確的實例目錄
**測試（Tests）**: 建立 Paper 1.20.4 伺服器，確認 server.jar 存在
**狀態（Status）**: Complete

## Stage 3: Java 路徑設定
**目標（Goal）**: 確保伺服器有正確的 Java 路徑才能啟動
**成功標準（Success Criteria）**: 
- 自動偵測系統 Java
- 或讓使用者在設定中指定 Java 路徑
**測試（Tests）**: 啟動伺服器時使用正確的 Java
**狀態（Status）**: Not Started
