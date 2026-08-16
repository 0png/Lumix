# Lumix 1.0 Feature Proposal

Status: Draft  
Audience: Another Codex session or engineer implementing the work in this repo  
Scope: `packages/app` only unless explicitly noted

## Goal

Prepare Lumix for a credible 1.0 release as a Windows-first Minecraft Server Launcher by closing the biggest product gaps in server lifecycle, safety, onboarding, and connectivity diagnostics.

This proposal is intentionally structured as `Phase 1` to `Phase 4` so another AI session can implement one phase at a time without having to reinterpret the roadmap.

## Product Outcome

After all four phases are complete, Lumix should support this end-to-end flow:

- import an existing server instead of forcing a fresh setup
- create a new server and immediately know what to do next
- protect a world with backup and restore flows that feel trustworthy
- understand local, LAN, and WAN connection scenarios without Lumix pretending it can solve router configuration automatically

## Global Constraints

- Keep Lumix local-first. Do not introduce Lumix-hosted infrastructure.
- Renderer must not directly use Node or Electron APIs.
- Any new system capability must flow through:
  - `src/shared/ipc-channels.ts`
  - `src/shared/ipc-types.ts`
  - `src/main/ipc/*`
  - `src/main/services/*`
  - `src/preload/index.ts`
  - `src/renderer/src/*`
- The app is Windows-first. UX should prioritize Windows desktop workflows.
- Remote access must be explained honestly. Lumix must not imply it can always automate port forwarding.

## Non-Goals

- No Lumix-managed relay or tunnel service
- No router web UI automation
- No cloud sync
- No plugin or mod marketplace in this proposal
- No advanced world repair tooling in this proposal

## Phase Order

1. Phase 1: Import Existing Server
2. Phase 2: Post-Create Onboarding
3. Phase 3: Connection Info and Diagnostics
4. Phase 4: Backup / Restore / Failure Recovery Hardening

This order is deliberate:

- Phase 1 and Phase 2 close the biggest product workflow gaps.
- Phase 3 improves usability without overreaching.
- Phase 4 is safety-critical and should be implemented carefully after the surrounding flows are clearer.

---

## Phase 1: Import Existing Server

### Objective

Allow users to bring an existing Minecraft server folder into Lumix without copying it, so the app is usable beyond greenfield setup.

### Why This Phase Exists

If Lumix only supports fresh creation, it feels incomplete. Existing-world import is one of the clearest signals that the product is a serious server operations tool.

### Required User Flow

1. User clicks `Import Server`.
2. User selects a directory.
3. Lumix scans the folder in the main process.
4. Lumix shows an import review screen with detected metadata.
5. User confirms or corrects uncertain fields.
6. Lumix creates a managed server entry pointing to the existing folder.

### Required Detection Data

Detect from folder contents:

- `eula.txt`
- `server.properties`
- `server.jar` or obvious jar candidates
- `fabric-server-launch.jar`
- `libraries`
- `mods`
- `plugins`
- `usercache.json`
- `ops.json`
- `whitelist.json`

### Detection Heuristics

Core type:

- `plugins` suggests Paper/Spigot family
- `mods` suggests Fabric/Forge family
- jar names should override folder heuristics when possible
- if detection is uncertain, return unknown and let the user choose

Minecraft version:

- best effort from known jar names or metadata
- if not reliable, keep it unknown instead of fabricating a version

### Required Shared Contracts

Add types such as:

- `DetectImportCandidateRequest`
- `ImportCandidateDto`
- `ImportServerRequest`

Suggested DTO:

```ts
interface ImportCandidateDto {
  directory: string;
  suggestedName: string;
  detectedCoreType?: CoreType;
  detectedMcVersion?: string;
  serverJarPath?: string;
  hasEula: boolean;
  eulaAccepted: boolean;
  hasServerProperties: boolean;
  hasWorldData: boolean;
  hasModsFolder: boolean;
  hasPluginsFolder: boolean;
  warnings: string[];
}
```

Add IPC channels:

- `APP.SELECT_DIRECTORY` or equivalent directory picker channel
- `SERVER.DETECT_IMPORT_CANDIDATE`
- `SERVER.IMPORT_EXISTING`

### Main Process Work

Implement under `packages/app/src/main/services` and related handlers:

- safe folder scanning
- parsing `eula.txt`
- parsing `server.properties`
- jar candidate detection
- duplicate-import prevention
- invalid-path rejection

### Renderer Work

Implement:

- import entry action
- import wizard or dialog
- review screen with warnings
- user correction controls for uncertain fields

### Error States

Handle explicitly:

- missing or inaccessible folder
- directory already imported
- folder does not look like a server
- partial config detected but import still possible
- unsupported or unknown core

### Acceptance Criteria

- User can import a valid existing server directory without copying files.
- Imported server appears in the server list and opens in normal server detail flow.
- Duplicate imports of the same folder are blocked.
- If detection is incomplete, user can still finish import by confirming values manually.

### Done Checklist

- shared types added
- IPC channels added
- preload API added
- main detection service implemented
- renderer import flow implemented
- basic validation and error handling implemented

### Prompt For Another AI Session

Implement `Phase 1: Import Existing Server` from `.codex/PROPOSAL_1_0_FEATURES.md`. Follow the shared/main/preload/renderer layering rules in `AGENTS.md`. Do not work on later phases. Finish the import flow end-to-end, including detection, review UI, persistence, and validation. Run affected verification commands when done.

---

## Phase 2: Post-Create Onboarding

### Objective

After creating a server, guide the user through the first meaningful actions instead of dropping them into a generic detail page.

### Why This Phase Exists

Users often finish setup and then stall. A formal release needs a clear first-run experience that turns "server created" into "server ready to operate".

### Required User Flow

When server creation succeeds:

- navigate into the new server context
- show a structured `Next Steps` panel, modal, or card
- allow the user to act immediately
- allow the user to dismiss and reopen later

### Suggested Onboarding Steps

1. Review server folder and core
2. Review memory and Java
3. Open `server.properties` essentials
4. Review connection info
5. Start server
6. Optional: create first backup

### Required Step States

- `ready`
- `recommended`
- `blocked`
- `completed`

### Suggested Renderer Components

- `ServerFirstRunChecklist.tsx`
- `ServerQuickActions.tsx`
- `ConnectionInfoCard.tsx` if Phase 3 data is already available

### Data Requirements

The checklist should reflect actual state:

- Java available?
- Java compatible?
- server jar ready?
- backup exists?
- EULA accepted?
- connection info available?

### Persistence

Track onboarding state per server.

Suggested field:

```ts
onboardingState?: {
  dismissedAt?: string;
  completedSteps?: string[];
}
```

If that is too heavy for server data, use a local settings map keyed by server id.

### Shared / Main Work

If onboarding state is persisted on server data:

- extend DTOs
- extend update contracts
- support saving onboarding progress

### Renderer Work

- show onboarding after successful create flow
- link checklist actions to real pages and actions
- add a reopen entry in server detail

### Acceptance Criteria

- After server creation, the user sees a real next-step flow.
- The flow links to settings, start, backup, and connection info.
- The flow can be dismissed and reopened.
- Step state reflects actual server status.

### Done Checklist

- onboarding state model chosen
- renderer checklist implemented
- create flow trigger wired
- reopen entry added
- persistence behavior defined

### Prompt For Another AI Session

Implement `Phase 2: Post-Create Onboarding` from `.codex/PROPOSAL_1_0_FEATURES.md`. Do not expand scope into backup hardening or import flow changes unless required for integration. Focus on a polished first-run checklist tied to real server state and actions.

---

## Phase 3: Connection Info and Diagnostics

### Objective

Help users understand how to connect locally, over LAN, and over WAN, while clearly distinguishing what Lumix can verify and what requires manual router or ISP work.

### Why This Phase Exists

Users often cannot tell whether the problem is the server, the address, the port, the firewall, or the router. Lumix cannot fully automate remote access, but it can remove confusion.

### Product Positioning

This phase is diagnostics and guidance, not one-click hosting.

Lumix must never imply:

- router setup is automatic
- WAN reachability can always be guaranteed
- public connectivity is under Lumix control

### Required UI

Add a compact `Connection Info` card in server detail or a nearby server operations view.

Suggested visible content:

- Local: `localhost:<port>`
- LAN: `<local-ip>:<port>`
- WAN: `requires router port forwarding`
- concise diagnostics list

Suggested actions:

- copy local address
- copy LAN address
- open connection help

### Required Data

Minimum:

- configured port from `server.properties`
- bound `server-ip` if present
- `localhost` address
- LAN IPv4 address
- whether the server process is running
- whether the server is listening on the configured port

Optional if practical:

- public IP lookup
- likely CGNAT hint
- Windows firewall hint

### Required Shared Contracts

Add types like:

- `ConnectionInfoDto`
- `ConnectionDiagnostic`

Suggested shape:

```ts
interface ConnectionDiagnostic {
  level: 'info' | 'warn' | 'error';
  code: string;
  message: string;
}

interface ConnectionInfoDto {
  serverId: string;
  port: number;
  serverIp?: string;
  localhostAddress: string;
  lanAddress?: string;
  publicIp?: string;
  isRunning: boolean;
  isListeningOnPort: boolean;
  diagnostics: ConnectionDiagnostic[];
}
```

Suggested diagnostic codes:

- `SERVER_NOT_RUNNING`
- `PORT_NOT_LISTENING`
- `LAN_IP_UNAVAILABLE`
- `SERVER_IP_BOUND`
- `FIREWALL_MAY_BLOCK`
- `WAN_REQUIRES_PORT_FORWARDING`
- `PUBLIC_IP_UNAVAILABLE`
- `CGNAT_SUSPECTED`

### Main Process Work

Add network diagnostics service logic:

- resolve local interfaces
- determine LAN IPv4 candidate
- inspect listening state on configured port
- inspect Windows-specific process or firewall hints where feasible

Do not block renderer on slow checks.

### Renderer Work

- render compact connection card
- add copy actions
- add clear text separating local, LAN, and WAN cases

### Messaging Guidance

Keep copy plain and honest:

- same PC: use `localhost`
- same network: share the LAN address
- outside the network: router port forwarding is usually required
- Lumix cannot configure the router automatically

### Acceptance Criteria

- User can copy a correct local address and LAN address from the UI.
- UI clearly distinguishes LAN vs WAN usage.
- If the server is not listening on the configured port, Lumix says so directly.
- WAN messaging does not overpromise automation.

### Done Checklist

- shared connection DTOs added
- IPC channel added
- preload API added
- main diagnostics service implemented
- renderer connection card implemented
- copy actions and basic diagnostics visible

### Prompt For Another AI Session

Implement `Phase 3: Connection Info and Diagnostics` from `.codex/PROPOSAL_1_0_FEATURES.md`. Keep the scope honest: diagnostics and guidance only, no fake automation of router configuration. Build the feature through shared IPC, main services, preload, and renderer UI.

---

## Phase 4: Backup / Restore / Failure Recovery Hardening

### Objective

Turn backup and restore into a trustworthy safety feature suitable for a formal release, with stronger restore preflight, failure handling, and recovery-oriented UX.

### Why This Phase Exists

Backup is a trust feature. If it feels fragile, generic, or unsafe, the product will not feel release-ready even if everything else looks polished.

### Current Direction

The repo already contains backup-related types and UI direction. This phase is about making the existing direction reliable and explicit.

### Required Product Behaviors

#### Manual Backup

- one-click `Back Up Now`
- if server is running:
  - run any necessary save preparation
  - communicate that backup is being taken from a live server
- show progress and result

#### Restore Backup

- require server to be stopped before restore
- show destructive confirmation
- offer automatic pre-restore backup
- restore at least:
  - world data
  - `server.properties`
  - `ops.json`
  - `whitelist.json`
  - `banned-players.json`
  - `banned-ips.json`
  - `mods`
  - `plugins`

#### Failure Recovery UX

When backup or restore fails, show likely cause and next step, not only a generic toast.

Required failure categories:

- insufficient disk space
- file locked by running process
- permission denied
- corrupted backup source
- missing source path

#### Backup Visibility

Each backup entry should show:

- name
- created at
- size
- trigger type
- path if useful

### Technical Direction

Recommended MVP backup strategy:

- managed directory snapshot first
- compressed archive later if needed

If archive flow already exists, keep it only if restore validation is explicit and recoverable.

### Suggested Shared Contract Additions

- richer backup operation result objects
- failure reason codes
- restore preflight result

Example:

```ts
interface BackupPreflightResult {
  canRun: boolean;
  requiresServerStop: boolean;
  freeSpaceBytes?: number;
  warnings: string[];
}
```

### Main Process Work

Under `src/main/services`, backup logic should own:

- live backup preparation
- copy strategy
- retention
- restore preflight
- partial failure cleanup where safe

### Renderer Work

Improve backup UI with:

- clearer recent backup list
- visually separated destructive restore action
- `create pre-restore backup` toggle defaulted on
- better error detail surfaces beyond toasts

### Acceptance Criteria

- User can create a manual backup and see it in the list.
- User cannot restore while the server is running.
- Restore flow includes explicit confirmation and optional pre-restore backup.
- Failure UI explains likely cause and next step.

### Done Checklist

- backup flow audited
- restore preflight added
- richer failure results added
- pre-restore backup option implemented
- restore confirmations improved
- backup result and failure UI improved

### Prompt For Another AI Session

Implement `Phase 4: Backup / Restore / Failure Recovery Hardening` from `.codex/PROPOSAL_1_0_FEATURES.md`. Treat backup as safety-critical. Focus on restore preflight, explicit confirmations, structured failure handling, and trustworthy UX. Avoid scope creep into unrelated server management features.

---

## Cross-Phase Architecture Notes

### Likely Renderer Areas

- `packages/app/src/renderer/src/components/server/*`
- `packages/app/src/renderer/src/components/settings/*` when needed
- `packages/app/src/renderer/src/App.tsx`
- hooks related to server state, app state, import, onboarding, backup, and diagnostics

### Likely Main Process Areas

- `packages/app/src/main/services/*`
- `packages/app/src/main/ipc/server-handlers.ts`
- possibly `app-handlers.ts` if directory pickers or network helpers fit better there

### Shared Contracts

Most phases will touch:

- `packages/app/src/shared/ipc-channels.ts`
- `packages/app/src/shared/ipc-types.ts`
- `packages/app/src/preload/index.ts`

### Persistence Considerations

Need to decide where to persist:

- imported server metadata
- onboarding state
- backup metadata if not purely derived

Preferred rule:

- keep server-behavior state on the server model
- keep purely UI dismissal state in settings if it does not affect behavior

---

## Verification Expectations

For each phase:

- run `pnpm --filter @lumix/app typecheck`
- run `pnpm --filter @lumix/app lint`
- run affected tests if present

After a phase is considered complete:

- run `pnpm typecheck`
- run `pnpm test`

Before release readiness:

- run `pnpm build`
- run `pnpm --filter @lumix/app build:win`
- manually verify on Windows:
  - import existing server
  - create server and follow onboarding
  - inspect connection info while stopped and running
  - create backup and restore backup safely

---

## Definition of Done

This proposal is complete when Lumix can credibly support this user story:

> I can import or create a Minecraft server, understand what to do next, protect it with backups, and clearly see how local, LAN, and WAN connectivity work, all inside Lumix without needing to guess which operational step I am missing.

