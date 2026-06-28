/**
 * Barrel for shared type definitions used across the background service worker,
 * content script, and popup UI.
 *
 * Types are split by domain into sibling modules; this barrel re-exports them so
 * importers keep using `from '../types'` unchanged. The dependency direction
 * stays `lib -> types` (lib modules import these; types never imports from lib).
 *
 * Domain modules:
 *  - audit:    local audit-log events and retention
 *  - tenant:   tenant-context identification (Feature A)
 *  - sso:      pseudo-SSO autofill credentials (Feature B)
 *  - auth:     operating mode, TTL auth/standalone state, One-Time Bypass
 *  - policy:   enterprise dynamic-policy distribution (attribute targeting)
 *  - settings: top-level KibaSettings, defaults, and popup tab ids
 */

export * from './audit';
export * from './tenant';
export * from './sso';
export * from './auth';
export * from './policy';
export * from './settings';
