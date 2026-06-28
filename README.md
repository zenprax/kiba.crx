# kiba.crx

**Zenprax Edge-based Browser Security** — a Manifest V3 Chrome extension that blocks
risks at the edge (the browser) before they turn into encrypted network traffic.

This is the standalone **OSS edition (Phase 1)**, with the Phase 2 enterprise
groundwork (pull-based sync, TTL auth) scaffolded behind it.

> 日本語版 README はこちら: [README.ja.md](./README.ja.md)

## Features

| # | Feature | Implementation |
|---|---------|----------------|
| 1 | **Ad / malicious-domain blocking** | `declarativeNetRequest` static ruleset + user-managed block/allow lists ([`rules/static_rules.json`](./rules/static_rules.json), [`src/background/domainRules.ts`](./src/background/domainRules.ts)) |
| 2 | **Tenant restriction** | Detects the SaaS tenant/workspace (Slack / Google / GitHub) and treats non-whitelisted ("foreign") tenants as restricted contexts ([`src/lib/tenantDetector.ts`](./src/lib/tenantDetector.ts), [`src/content/tenant.ts`](./src/content/tenant.ts)) |
| 3 | **Anti-ClickFix paste sanitizer** | Capture-phase `paste` interception; dangerous OS-command detection + confidential-data masking in restricted contexts ([`src/lib/patterns.ts`](./src/lib/patterns.ts), [`src/content/pasteGuard.ts`](./src/content/pasteGuard.ts)) |
| 4 | **File-upload interceptor** | Gates uploads/drops on restricted contexts behind a simulated **One-Time Bypass** token ([`src/content/fileGater.ts`](./src/content/fileGater.ts)) |
| 5 | **Download Gater** | Intercepts downloads via `chrome.downloads` and holds unapproved ones pending user confirmation ([`src/background/downloadGater.ts`](./src/background/downloadGater.ts)) |
| 6 | **Screen Share Audit** | Patches `getDisplayMedia` in the main world to detect and log screen-sharing events ([`src/content/screenShareHook.ts`](./src/content/screenShareHook.ts), [`src/content/mainWorld/getDisplayMediaPatch.ts`](./src/content/mainWorld/getDisplayMediaPatch.ts)) |
| 7 | **Pseudo-SSO autofill** | Injects shared-account credentials into login forms, with DevTools-open detection to deter plaintext exfiltration ([`src/content/ssoFiller.ts`](./src/content/ssoFiller.ts)) |
| 8 | **Extension audit (Shadow IT)** | Background `chrome.management` scan flags risky installed extensions (AI assistants, etc.) into the local audit log ([`src/background/auditor.ts`](./src/background/auditor.ts)) |
| 9 | **Quick Actions** | One-click per-site allow/block from the Dashboard for the currently active tab ([`src/popup/tabs/Dashboard.tsx`](./src/popup/tabs/Dashboard.tsx)) |
| 10 | **Audit Chart** | Visual breakdown of audit log events by category and time ([`src/popup/tabs/AuditChart.tsx`](./src/popup/tabs/AuditChart.tsx)) |
| 11 | **Per-feature DRY_RUN mode** | Each feature can independently be set to `ENFORCE` or `DRY_RUN`, overriding the global mode ([`src/lib/dryRun.ts`](./src/lib/dryRun.ts), [`src/popup/tabs/Settings.tsx`](./src/popup/tabs/Settings.tsx)) |
| 12 | **Edge UI (Popup)** | React + Tailwind plugin-style dashboard — feature tabs appear/disappear with their toggle ([`src/popup/Popup.tsx`](./src/popup/Popup.tsx)) |

## Tech Stack

- **TypeScript** (strict, type-safe)
- **Vite + CRXJS** (`@crxjs/vite-plugin`) for MV3 bundling and HMR
- **React + Tailwind CSS** for the popup; plain scoped CSS for injected overlays
- **Vitest** for unit tests

## Project Structure

```
kiba.crx/
├── src/
│   ├── manifest.ts              # MV3 manifest (CRXJS defineManifest)
│   ├── types/index.ts           # Shared types + defaults (KibaSettings, AuditLogEntry)
│   ├── lib/                     # DOM-independent, unit-tested logic
│   │   ├── patterns.ts          # ClickFix detection + confidential-data masking
│   │   ├── tenantDetector.ts    # SaaS tenant/workspace extraction
│   │   ├── tenantRules.ts       # Pluggable tenant provider registry
│   │   ├── policyFilter.ts      # OTA policy pattern filtering
│   │   ├── policySchema.ts      # Policy schema validation
│   │   ├── ssoFiller.ts         # Credential matching + native form fill
│   │   ├── dryRun.ts            # Per-feature DRY_RUN helpers
│   │   ├── bypass.ts            # One-Time Bypass token logic
│   │   └── storage.ts           # Type-safe chrome.storage.local wrapper
│   ├── background/              # Service worker
│   │   ├── index.ts             # Install defaults, notifications, init
│   │   ├── auditor.ts           # chrome.management extension audit
│   │   ├── downloadGater.ts     # Download interception + approval flow
│   │   ├── domainRules.ts       # Dynamic DNR rule management
│   │   ├── bypassManager.ts     # One-Time Bypass token management
│   │   ├── credentialBroker.ts  # SSO credential storage broker
│   │   ├── syncManager.ts       # Pull-based policy sync scaffold (Phase 2)
│   │   └── authHandler.ts       # TTL / offline standalone logic (Phase 2)
│   ├── content/                 # Isolated-world plugins, orchestrated by index.ts
│   │   ├── index.ts             # Orchestrator (starts/stops plugins per toggle)
│   │   ├── tenant.ts            # Restricted-context decision
│   │   ├── pasteGuard.ts        # Anti-ClickFix + masking
│   │   ├── fileGater.ts         # File-upload gate + One-Time Bypass
│   │   ├── screenShareHook.ts   # Screen-share audit (isolated world side)
│   │   ├── ssoFiller.ts         # Pseudo-SSO autofill
│   │   ├── overlay.tsx          # Injected overlay/modal/toast UI
│   │   ├── overlayStyles.ts     # Overlay style constants
│   │   └── mainWorld/
│   │       └── getDisplayMediaPatch.ts  # getDisplayMedia patch (main world)
│   └── popup/                   # React dashboard
│       ├── Popup.tsx            # Plugin-style tab router
│       └── tabs/                # Per-tab panels
│           ├── Dashboard.tsx    # Feature toggles + Quick Actions
│           ├── AuditLog.tsx     # Chronological audit event list
│           ├── AuditChart.tsx   # Visual audit event breakdown
│           ├── AntiClickFixTab.tsx # ClickFix pattern tuning
│           ├── FilterTab.tsx    # User block/allow domain lists
│           ├── SsoList.tsx      # SSO credential list
│           └── Settings.tsx     # Global mode, per-feature mode, cloud sync
├── rules/static_rules.json      # DNR ad/phishing block rules
└── public/icons/                # Placeholder extension icons
```

## Getting Started

```bash
npm install
npm run dev      # Vite dev server with CRXJS HMR
npm run build    # Type-check + production build → dist/
npm test         # Run Vitest unit tests
```

### Load the extension

1. `npm run build`
2. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `dist/` directory.

> During development you can instead load `dist/` after `npm run dev` for live HMR.

## Manual Verification

- **Anti-ClickFix:** On any page, copy a command like
  `powershell -c iex(...)` and paste into an input — the paste is blocked and a
  warning overlay appears. A normal URL pastes fine.
- **File control:** On a non-whitelisted domain (anything except `zenprax.com` /
  `github.com`), choose a file in an `<input type="file">` — it is reset and the
  **One-Time Bypass** modal appears. Granting the bypass arms a single-use token;
  the next upload is allowed and the token is consumed.
- **Download Gater:** Trigger a file download on a restricted domain — it is held
  pending approval and a confirmation toast appears.
- **Screen Share Audit:** Start a screen share (`getDisplayMedia`) on any page —
  the event is captured and an audit entry is created.
- **Quick Actions:** Open the popup on any page; use the Quick Actions card to
  instantly allow or block the current site's domain.
- **Popup (plugin-style UI):** Toggle Anti-ClickFix, grant a bypass, and watch the
  audit log and chart update in real time. Turning **Pseudo-SSO** off removes its tab from
  the popup entirely; turning it on brings the tab back.
- **DRY_RUN:** Set `mode: "DRY_RUN"` in settings (or per-feature in the Settings tab)
  and repeat the paste/file tests — nothing is blocked, but `[DRY_RUN]`-tagged entries
  appear in the audit log.

## Notes on the MVP Simulation

- File-upload blocking runs in the content script's **isolated world**; it resets
  the input and gates the workflow but cannot replay the original file selection,
  so after a bypass the user re-selects the file. This is intentional for the MVP.
- `clipboardRead` / `clipboardWrite` permissions are **not** requested — blocking a
  paste via `preventDefault()` does not require clipboard access.
- Screen share patching injects a script into the **main world** to intercept
  `navigator.mediaDevices.getDisplayMedia` before the page can call it.

## API Specification

The endpoints that kiba.crx communicates with are documented publicly for transparency:

- [Kiba Policy Delivery API](https://zenprax.github.io/kiba.crx/) — OpenAPI specification (GitHub Pages)

## License

Apache 2.0 — see [LICENSE](./LICENSE).
