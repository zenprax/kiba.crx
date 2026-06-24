CLAUDE.md - Developer Guidelines for kiba.crx

This document defines the development standards, commands, and AI assistant behavior rules for the kiba.crx repository.

🤖 AI Assistant Behavior Rules (CRITICAL)

AI assistants (such as Claude, Cursor, or Copilot) interacting with this repository MUST strictly adhere to the following rules:

Language Requirement (日本語回答の徹底):

ALL responses, explanations, comments, and communication MUST be written in Japanese.

Do not use English for conversational responses, even if the prompt or the file content is in English.

Git Operations & Delegation (Git操作におけるHaikuの強制):

Any Git operations (generating commit messages, running git commands, reviewing diffs for commit, or drafting pull requests) MUST be executed or delegated using the "Claude Haiku" (e.g., Claude 3 Haiku / Claude 3.5 Haiku) model.

Larger, reasoning-heavy models (like Claude 3.5 Sonnet or Opus) must not be wasted on routine Git commands or commit message generation.

If the client supports model switching for shell commands, ensure the agent switches to Haiku for Git tasks.

🛠️ Project Tech Stack

Platform: Chrome Extension (Manifest V3)

Framework & Tooling: TypeScript + React + Tailwind CSS

Build System: Vite + CRXJS (Vite Chrome Extension Compiler)

Target Browsers: Chromium-based browsers (Chrome, Edge, Brave, etc.)

🚀 Common Development Commands

Installation & Environment Setup

# Install dependencies
npm install

# Initialize development server with hot-reload (HMR)
npm run dev


Build & Packaging

# Build the production-ready extension (outputs to `dist/`)
npm run build

# Type check TypeScript files without building
npm run type-check


Quality Assurance & Linting

# Run ESLint for code quality checks
npm run lint

# Format codebase with Prettier
npm run format


📐 Code Style & Architecture Guidelines

TypeScript & Types:

Strictly avoid using any. Write explicit interfaces and types for all custom events, message passing, and chrome storage data.

Ensure type safety for Chrome APIs (use @types/chrome).

Chrome Extension Constraints (Manifest V3):

Keep background service workers lightweight and asynchronous.

Handle dynamic DOM injection carefully to prevent styling conflicts on target web pages. Use highly unique class names or shadow DOM for overlay UIs.

Tailwind CSS Integration:

Tailwind utility classes must be isolated inside the popup UI and injected overlay components so they do not pollute the styles of host websites.
