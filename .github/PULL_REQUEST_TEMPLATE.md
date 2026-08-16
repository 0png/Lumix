## Summary / 摘要

<!-- What changed? Keep this focused and link the related issue. -->
<!-- 改了什麼？請保持聚焦並連結相關 Issue。 -->

Closes #

## Why / 原因

<!-- What user or maintainer problem does this solve? -->
<!-- 這解決了什麼使用者或維護問題？ -->

## Validation / 驗證

<!-- List exact commands and manual scenarios you ran. -->
<!-- 列出實際執行的指令與手動測試情境。 -->

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build` or / 或 `pnpm --filter @lumix/app build:win` when relevant / 若相關

## Visual changes / 視覺變更

<!-- Add before/after screenshots or a short recording. Remove this section if not applicable. -->
<!-- 請附上前後截圖或短片；不適用時刪除此段。 -->

## Checklist / 檢查清單

- [ ] The change is scoped to one concern and contains no unrelated generated files. / 變更聚焦單一目的，未包含無關產物。
- [ ] IPC changes update shared types, main handlers, preload, and renderer consumers together. / IPC 變更已同步 shared、main、preload 與 renderer。
- [ ] User-facing text is updated in both `zh-TW.json` and `en.json`. / 使用者文案已同步中英文語系。
- [ ] Sensitive information, local paths, raw recordings, and build output are not committed. / 未提交敏感資訊、本機路徑、原始錄影或建置產物。
