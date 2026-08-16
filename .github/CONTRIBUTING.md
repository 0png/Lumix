# Contributing to Lumix / 參與 Lumix

Thank you for taking the time to improve Lumix. Small, focused changes are easier to review and safer to ship. Bug reports, documentation corrections, UX feedback, and code contributions are all welcome.

感謝你願意改善 Lumix。範圍小而聚焦的變更更容易審查，也更安全；錯誤回報、文件修正、UX 意見與程式碼貢獻都很歡迎。

## Before you start / 開始之前

- Search [existing issues](https://github.com/0png/Lumix/issues) before opening a new one.
- Use the bug or feature issue form so maintainers receive the context they need.
- For a larger behavior or architecture change, open an issue before investing in an implementation.
- Never report a vulnerability in a public issue; follow [SECURITY.md](SECURITY.md).

- 建立新 Issue 前，請先搜尋[現有 Issue](https://github.com/0png/Lumix/issues)。
- 使用錯誤或功能表單，讓維護者取得判斷所需的背景。
- 若變更範圍較大、涉及行為或架構，請先建立 Issue 討論再投入實作。
- 請勿在公開 Issue 回報漏洞，改依照 [SECURITY.md](SECURITY.md) 私下通報。

## Development setup / 開發環境

Lumix is a pnpm workspace. The app is Windows-first and is built with Electron, Vite, React, and TypeScript.

Lumix 是 pnpm workspace；主要程式是 Windows-first 的 Electron、Vite、React 與 TypeScript 桌面 App。

Requirements / 需求：

- Node.js 22 or newer / Node.js 22 以上
- pnpm 10 or newer / pnpm 10 以上
- Windows 10 or 11 for installer and GUI verification / 安裝檔與 GUI 驗證需 Windows 10 或 11

```bash
git clone https://github.com/0png/Lumix.git
cd Lumix
pnpm install --frozen-lockfile
pnpm dev
```

Important paths / 重要目錄：

| Path | Responsibility / 職責 |
|---|---|
| `packages/app/src/main` | Electron main process and system services / 主程序與系統服務 |
| `packages/app/src/preload` | Safe bridge exposed to the renderer / Renderer 的安全橋接層 |
| `packages/app/src/shared` | IPC channels and cross-process types / IPC channel 與跨程序型別 |
| `packages/app/src/renderer/src` | React UI, hooks, contexts, and translations / UI、hooks、context 與翻譯 |

Renderer code must not access Node.js or `ipcRenderer` directly. When changing an IPC contract, update the shared channel and types, main handler, preload bridge, and renderer consumer together.

Renderer 不應直接存取 Node.js 或 `ipcRenderer`。修改 IPC contract 時，請一起更新 shared channel/type、main handler、preload bridge 與 renderer consumer。

## Make a change / 進行變更

1. Create a branch from the latest `main`.
2. Keep each pull request focused on one problem.
3. Follow the existing TypeScript and React patterns; avoid introducing a new state-management approach for an isolated change.
4. Update both `zh-TW.json` and `en.json` for user-facing copy.
5. Use Conventional Commit style for commit messages, such as `fix(settings): prevent blank window`.

1. 從最新 `main` 建立分支。
2. 每個 Pull Request 聚焦處理一個問題。
3. 延續現有 TypeScript 與 React 寫法，避免為單一修改引入另一套狀態管理。
4. 使用者可見文案需同步更新 `zh-TW.json` 與 `en.json`。
5. Commit message 採 Conventional Commits，例如 `fix(settings): prevent blank window`。

Do not commit dependencies, build output, local configuration, Minecraft runtime data, credentials, or raw media captures.

不要提交 dependencies、建置輸出、本機設定、Minecraft runtime 資料、憑證或原始錄影。

## Validate / 驗證

Run these from the repository root before opening a pull request:

建立 Pull Request 前，請在 repo 根目錄執行：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Changes to Electron packaging, updater behavior, resources, or startup must also pass:

若修改 Electron 打包、更新器、資源或啟動流程，還需通過：

```bash
pnpm --filter @lumix/app build:win
```

For UI changes, verify the 1000 × 650 minimum window, a wider window, light and dark themes, keyboard focus, and both languages. Add before/after screenshots or a short recording to the pull request.

UI 變更請檢查 1000 × 650 最小視窗、寬視窗、明暗主題、鍵盤焦點與雙語，並在 Pull Request 提供前後截圖或短片。

## Pull requests / Pull Request 規範

A pull request should explain the problem, the chosen solution, risks, and exact validation performed. CI must pass before merge. Review feedback is about the change, not the contributor; questions and alternative approaches are welcome.

Pull Request 應說明問題、採用方案、風險與實際驗證內容；合併前 CI 必須通過。Review 針對變更本身而非貢獻者，歡迎提問或提出替代方案。

By contributing, you agree that your contribution is licensed under the repository's [MIT License](../LICENSE) and to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

提交貢獻代表你同意以本 repo 的 [MIT License](../LICENSE) 授權，並遵守 [Code of Conduct](CODE_OF_CONDUCT.md)。
