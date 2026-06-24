kiba.crx - MVP (Phase 1) Technical Specification

This document defines the technical specification for the MVP of kiba.crx, an open-source enterprise browser security extension designed under the Zenprax philosophy.

kiba.crx aims to block risks at the edge (the browser) before they turn into encrypted network traffic, specifically focusing on Inline File Control, Paste Sanitation (ClickFix Protection), and lightweight Ad-blocking.

1. Project Overview & Tech Stack

Platform: Chrome Extension (Manifest V3)

Target Browsers: Google Chrome, Microsoft Edge, Brave, and other Chromium-based browsers.

Tech Stack:

TypeScript (Type-safe codebase)

Vite + CRXJS (Modern, fast extension bundler)

React + Tailwind CSS (For Popup and UI components)

Permissions Required (manifest.json):

declarativeNetRequest (High-performance network/ad-blocking)

storage (For local policy/configurations)

scripting (For dynamic content injection)

activeTab (Contextual security)

clipboardRead, clipboardWrite (Clipboard sanitization)

2. Directory Structure

We recommend the following structure for the Vite + TypeScript + CRXJS environment:

kiba.crx/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── manifest.json         <-- Extension Manifest (Manifest V3)
│   ├── background/
│   │   └── index.ts          <-- Service Worker (Background Script)
│   ├── content/
│   │   ├── index.ts          <-- Main Content Script (DOM injection)
│   │   └── style.css         <-- Styling for inline warning overlays
│   └── popup/
│       ├── index.html
│       ├── main.tsx
│       ├── Popup.tsx         <-- Admin/User Local Dashboard UI
│       └── index.css
└── rules/
    └── static_rules.json     <-- declarativeNetRequest rule template (Ad-block)


3. Manifest Configuration (src/manifest.json)

Configure the manifest to support TypeScript bundling via CRXJS, including declarative blocking rules.

{
  "manifest_version": 3,
  "name": "kiba.crx",
  "version": "0.1.0",
  "description": "Zenprax Edge-based Browser Security. High-performance inline blocking and context control.",
  "permissions": [
    "declarativeNetRequest",
    "storage",
    "clipboardRead",
    "clipboardWrite"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.ts"],
      "css": ["src/content/style.css"],
      "run_at": "document_start"
    }
  ],
  "action": {
    "default_popup": "src/popup/index.html",
    "default_icon": "icon.png"
  },
  "declarative_net_request": {
    "rule_resources": [
      {
        "id": "ad_rules",
        "enabled": true,
        "path": "rules/static_rules.json"
      }
    ]
  }
}


4. Feature Requirements & Implementation Guide

Feature 1: Declarative Ad-blocking & Malicious Domain Block (DNR)

Using chrome.declarativeNetRequest to block tracking, advertising, and known malware domains without compromising browser performance.

Implementation (rules/static_rules.json):
Create a core ruleset blocking standard advertising domains and fake error/phishing sites.

[
  {
    "id": 1,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "doubleclick.net",
      "resourceTypes": ["sub_frame", "script", "image", "xmlhttprequest"]
    }
  },
  {
    "id": 2,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "googleads.g.doubleclick.net",
      "resourceTypes": ["sub_frame", "script", "image", "xmlhttprequest"]
    }
  }
]


Feature 2: Anti-ClickFix & Paste Sanitizer

Prevents users from pasting malicious OS commands (e.g., PowerShell, bash scripts hidden in fake error prompts) into terminal-like SaaS interfaces or standard input boxes.

Logic (Content Script src/content/index.ts):

Listen to the paste event globally.

Analyze the clipboard data using regular expressions.

Detect signatures of terminal commands: powershell, cmd.exe, /bin/bash, curl | sh, Invoke-Expression, iex.

If malicious commands are detected:

Call e.preventDefault() to stop the paste operation.

Sanitize the clipboard (optional) or pop up a custom inline warning overlay created in the DOM.

// Core Paste Inspection Logic in src/content/index.ts
document.addEventListener('paste', async (event: ClipboardEvent) => {
  const pastedText = event.clipboardData?.getData('text') || '';

  // RegEx to catch dangerous CLI patterns often used in ClickFix campaigns
  const dangerPattern = /(powershell|cmd\.exe|Invoke-WebRequest|iex\s*\(|curl\s+.*\|\s*sh|bash\s+-c)/i;

  if (dangerPattern.test(pastedText)) {
    event.preventDefault();
    event.stopPropagation();

    showDangerOverlay(
      "kiba.crx Blocked Dangerous Paste",
      "The text you tried to paste contains administrative OS commands. Paste operation cancelled."
    );
  }
}, true); // Use capture phase to intercept early


Feature 3: File Upload Interception & Dynamic Lock (MVP Simulation)

Intercepts user file upload attempts on unauthorized domains and simulates the dynamic "One-Time Permission" workflow.

Logic (Content Script src/content/index.ts):

Listen for change events on input[type="file"].

Intercept drag-and-drop file transfers (drop event).

Read target domain and check against local blocklist stored in chrome.storage.local.

If the target domain is NOT whitelisted:

Block the file processing.

Display an inline modal overlay asking for "One-Time Permission".

(MVP Simulation) Store the temporary bypass flag in chrome.storage.local to allow the next single upload when the user clicks "Request Demo One-Time Bypass".

// Core File Interception Logic
document.addEventListener('change', (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target && target.type === 'file' && target.files && target.files.length > 0) {
    const currentDomain = window.location.hostname;

    // Check if domain is globally restricted (MVP static check)
    const isRestricted = !currentDomain.includes('zenprax.com') && !currentDomain.includes('github.com');

    if (isRestricted) {
      // Check if we have a simulated "One-Time Token" in storage
      chrome.storage.local.get(['oneTimeBypassActive'], (result) => {
        if (!result.oneTimeBypassActive) {
          event.preventDefault();
          target.value = ''; // Reset input

          showRequestBypassModal(currentDomain);
        } else {
          // Consume the token after allowing the current action
          chrome.storage.local.set({ oneTimeBypassActive: false });
          showNotification("kiba.crx", "One-Time Upload allowed and consumed.");
        }
      });
    }
  }
}, true);


Feature 4: Edge UI (Popup) & Local Policy Controls (src/popup/Popup.tsx)

A clean, Tailwind CSS-powered dashboard to show current security posture, statistics (blocked items count), and manual toggles for simulating admin controls.

UI Components:

Status Header: Cool "Zenprax" themed aesthetic (Dark mode, deep emerald tones, and sleek cards).

Anti-ClickFix Toggle: Switch to turn on/off clipboard monitoring.

File Control Simulator: Trigger a simulated admin approval to grant "One-Time Bypass" for testing.

Audit Log List: Mini scroll-area showing local block events (e.g., [14:22:01] Blocked PowerShell paste on dubious-site.com).
