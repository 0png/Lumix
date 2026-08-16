# Security Policy / 安全政策

## Supported versions / 支援版本

Security fixes are provided for the latest published Lumix release. Before reporting, reproduce the issue on the latest version when it is safe to do so.

安全修正以最新發布的 Lumix 版本為主。在安全可行的情況下，請先確認問題能在最新版重現。

## Report a vulnerability / 通報漏洞

Do not open a public issue. Use GitHub's [private vulnerability reporting form](https://github.com/0png/Lumix/security/advisories/new) instead.

請勿建立公開 Issue，請使用 GitHub 的[私人漏洞通報表單](https://github.com/0png/Lumix/security/advisories/new)。

Include / 請提供：

- Affected Lumix and Windows versions / 受影響的 Lumix 與 Windows 版本
- Impact and the conditions required to trigger it / 影響與觸發條件
- Reproduction steps or a minimal proof of concept / 重現步驟或最小概念驗證
- Relevant logs with tokens, usernames, IP addresses, and private paths removed / 已移除權杖、使用者名稱、IP 與私人路徑的相關記錄
- Any known workaround / 已知暫時解法

The maintainer will acknowledge the report, investigate it, and coordinate disclosure through the private advisory. Response and fix timing depends on severity and maintainer availability. Lumix does not currently operate a bug bounty program.

維護者會確認收到通報、進行調查，並透過私人 Advisory 協調揭露；回覆與修正時間取決於嚴重程度與維護量能。Lumix 目前沒有漏洞獎勵計畫。

## Scope / 範圍

Reports about Lumix application code, installer behavior, update delivery, local file handling, and privilege boundaries are in scope. Vulnerabilities in Minecraft, server cores, Java distributions, or third-party services should be reported to their respective maintainers unless Lumix introduces the issue.

Lumix 應用程式、安裝流程、更新傳遞、本機檔案處理與權限邊界屬於本政策範圍。Minecraft、伺服器核心、Java distribution 或第三方服務本身的漏洞，除非由 Lumix 引入，否則請回報給各自維護者。
