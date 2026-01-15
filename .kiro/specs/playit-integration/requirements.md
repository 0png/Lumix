# Requirements Document

## Introduction

本功能將 playit.gg 隧道服務整合到 Lumix 中，讓使用者可以一鍵開啟公開連線，讓朋友無需 port forwarding 即可連線到本地 Minecraft 伺服器。

## Glossary

- **Playit_Agent**: playit.gg 官方提供的隧道程式，負責建立本地與 playit 雲端之間的連線
- **Tunnel**: 隧道，將本地 port 映射到公開地址的連線通道
- **Claim_Code**: playit agent 首次啟動時產生的驗證碼，用於綁定帳號
- **Secret_Key**: 帳號綁定後產生的金鑰，用於後續自動認證
- **Public_Address**: 公開地址，玩家用來連線的 IP:Port 組合

## Requirements

### Requirement 1: Playit Agent 管理

**User Story:** As a user, I want Lumix to automatically manage the playit agent, so that I don't need to download or configure it manually.

#### Acceptance Criteria

1. WHEN the user first enables public connection, THE System SHALL automatically download the playit agent binary for the current platform
2. WHEN downloading the agent, THE System SHALL show download progress to the user
3. IF the download fails, THEN THE System SHALL display an error message and allow retry
4. THE System SHALL store the agent binary in the application data directory
5. WHEN the agent is already downloaded, THE System SHALL skip the download step

### Requirement 2: 帳號綁定流程

**User Story:** As a user, I want to choose between guest mode or registered account, so that I can decide the level of commitment.

#### Acceptance Criteria

1. WHEN the user first enables public connection and no secret key exists, THE System SHALL display a choice dialog with "Guest Mode" and "Register/Login" options
2. WHEN the user selects "Guest Mode", THE System SHALL start the agent and open the claim URL with guest parameter
3. WHEN the user selects "Register/Login", THE System SHALL start the agent and open the claim URL for account registration
4. WHEN the agent outputs a claim URL, THE System SHALL automatically open it in the default browser
5. WHEN the account binding is successful, THE System SHALL save the secret key to settings
6. IF the binding times out or fails, THEN THE System SHALL display an error and allow retry

### Requirement 3: 隧道生命週期管理

**User Story:** As a user, I want to start and stop tunnels easily, so that I can control when my server is publicly accessible.

#### Acceptance Criteria

1. WHEN the user clicks "Start Tunnel" and a secret key exists, THE System SHALL start the agent with the secret key
2. WHEN the tunnel is established, THE System SHALL display the public address to the user
3. WHEN the user clicks "Stop Tunnel", THE System SHALL terminate the agent process
4. WHEN the agent process exits unexpectedly, THE System SHALL update the tunnel status to disconnected
5. WHILE the tunnel is active, THE System SHALL display a "Connected" status indicator

### Requirement 4: 公開地址顯示與複製

**User Story:** As a user, I want to easily copy the public address, so that I can share it with friends.

#### Acceptance Criteria

1. WHEN the tunnel is connected, THE System SHALL display the public address prominently
2. WHEN the user clicks the copy button, THE System SHALL copy the address to clipboard
3. WHEN the address is copied, THE System SHALL show a success toast notification
4. THE System SHALL display the address in a format suitable for Minecraft (e.g., abc123.gl.ply.gg:25565)

### Requirement 5: 隧道狀態監控

**User Story:** As a user, I want to see the tunnel status in real-time, so that I know if my server is accessible.

#### Acceptance Criteria

1. THE System SHALL display one of the following statuses: disconnected, connecting, connected, error
2. WHEN the status changes, THE System SHALL emit a status change event
3. WHEN an error occurs, THE System SHALL display a descriptive error message
4. WHILE connecting, THE System SHALL show a loading indicator

### Requirement 6: 設定持久化

**User Story:** As a user, I want my playit settings to be saved, so that I don't need to reconfigure every time.

#### Acceptance Criteria

1. THE System SHALL persist the secret key securely in the settings file
2. THE System SHALL persist the user's mode preference (guest or registered)
3. WHEN the application restarts, THE System SHALL restore the saved settings
4. THE System SHALL provide an option to disconnect/logout from playit account

### Requirement 7: 錯誤處理

**User Story:** As a user, I want clear error messages when something goes wrong, so that I can understand and fix the issue.

#### Acceptance Criteria

1. IF the agent binary is not found, THEN THE System SHALL prompt to download it
2. IF the network is unavailable, THEN THE System SHALL display a network error message
3. IF the secret key is invalid, THEN THE System SHALL prompt to re-authenticate
4. IF the tunnel port is already in use, THEN THE System SHALL display a port conflict error
5. THE System SHALL include error codes for all error conditions

### Requirement 8: UI 整合

**User Story:** As a user, I want the tunnel controls integrated into the server detail page, so that I can manage everything in one place.

#### Acceptance Criteria

1. THE System SHALL display a "Public Connection" section in the ServerDetail component
2. WHEN the server is not running, THE System SHALL disable the tunnel controls
3. WHEN the server is running, THE System SHALL enable the tunnel controls
4. THE System SHALL show the tunnel status alongside the server status
