# kiba.crx

**Zenprax Edge-based Browser Security** — a Manifest V3 Chrome extension that blocks
risks at the edge (the browser) before they turn into encrypted network traffic.

This is the **MVP (Phase 1)** scaffold built per [`kiba_crx_spec.md`](./kiba_crx_spec.md).

> 日本語版 README はこちら: [README.ja.md](./README.ja.md)

## Features

| # | Feature | Implementation |
|---|---------|----------------|
| 1 | **Ad / malicious-domain blocking** | `declarativeNetRequest` static ruleset ([`rules/static_rules.json`](./rules/static_rules.json)) |
| 2 | **Anti-ClickFix paste sanitizer** | Capture-phase `paste` interception in the content script; dangerous OS-command detection in [`src/lib/patterns.ts`](./src/lib/patterns.ts) |
| 3 | **File-upload interceptor** | Gates uploads/drops on non-whitelisted domains behind a simulated **One-Time Bypass** token in `chrome.storage.local` |
| 4 | **Edge UI (Popup)** | React + Tailwind dashboard ([`src/popup/Popup.tsx`](./src/popup/Popup.tsx)) — toggle, stats, audit log |

## Tech Stack

- **TypeScript** (strict, type-safe)
- **Vite + CRXJS** (`@crxjs/vite-plugin`) for MV3 bundling and HMR
- **React + Tailwind CSS** for the popup; plain scoped CSS for injected overlays
- **Vitest** for unit tests

## Project Structure

```
kiba.crx/
├── src/
│   ├── manifest.ts          # MV3 manifest (CRXJS defineManifest)
│   ├── types/index.ts       # Shared types + defaults (KibaSettings, AuditLogEntry)
│   ├── lib/
│   │   ├── patterns.ts      # ClickFix detection regex + helpers (unit-tested)
│   │   ├── patterns.test.ts
│   │   └── storage.ts       # Type-safe chrome.storage.local wrapper
│   ├── background/index.ts  # Service worker (install defaults, notifications)
│   ├── content/
│   │   ├── index.ts         # Paste + file/drop interception, injected overlays
│   │   └── style.css        # Overlay/modal styling
│   └── popup/               # React dashboard
├── rules/static_rules.json  # DNR ad/phishing block rules
└── public/icons/            # Placeholder extension icons
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
- **Popup:** Toggle Anti-ClickFix, grant a bypass, and watch the audit log update
  in real time.

## Notes on the MVP Simulation

- File-upload blocking runs in the content script's **isolated world**; it resets
  the input and gates the workflow but cannot replay the original file selection,
  so after a bypass the user re-selects the file. This is intentional for the MVP.
- `clipboardRead` / `clipboardWrite` permissions are **not** requested — blocking a
  paste via `preventDefault()` does not require clipboard access.

## License

Apache 2.0 — see [LICENSE](./LICENSE).
