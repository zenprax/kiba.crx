/**
 * Type-safe wrapper around chrome.storage.local for kiba.crx settings.
 *
 * All three runtime surfaces (background, content, popup) import these helpers
 * so the storage key and shape are defined exactly once.
 */

import {
  DEFAULT_SETTINGS,
  MAX_AUDIT_ENTRIES,
  type AuditEventType,
  type AuditLogEntry,
  type KibaSettings,
} from '../types';

/** Single key under which the entire KibaSettings object is stored. */
export const SETTINGS_KEY = 'kibaSettings';

/** Reads the full settings object, merging in defaults for any missing fields. */
export async function getSettings(): Promise<KibaSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = (result[SETTINGS_KEY] ?? {}) as Partial<KibaSettings>;
  return { ...DEFAULT_SETTINGS, ...stored };
}

/** Persists a partial update, merged onto the current settings. */
export async function setSettings(patch: Partial<KibaSettings>): Promise<KibaSettings> {
  const current = await getSettings();
  const next: KibaSettings = { ...current, ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

/** Prepends a new audit-log entry, trimming the list to MAX_AUDIT_ENTRIES. */
export async function addAuditLog(
  type: AuditEventType,
  detail: string,
  domain: string,
): Promise<void> {
  const current = await getSettings();
  const entry: AuditLogEntry = { ts: Date.now(), type, detail, domain };
  const auditLog = [entry, ...current.auditLog].slice(0, MAX_AUDIT_ENTRIES);
  await setSettings({ auditLog });
}

/**
 * 旧バージョンが平文で保存していた SSO 資格情報（`ssoCredentials` キー）を、
 * 起動時に 1 度だけ storage から削除する。資格情報は本番では background の
 * メモリ常駐キャッシュにのみ保持され、平文で永続化されることはない。
 *
 * 更新インストール後に古い平文機密が残らないことを保証するためのマイグレーション。
 */
export async function purgeLegacyCredentials(): Promise<void> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY];
  if (stored && typeof stored === 'object' && 'ssoCredentials' in stored) {
    delete (stored as Record<string, unknown>).ssoCredentials;
    await chrome.storage.local.set({ [SETTINGS_KEY]: stored });
  }
}

/**
 * ローカルの監査ログを endpoint へ POST し、送信成功分をローカルから削除する。
 *
 * - 送信成功時のみローカルを変更する（べき等：失敗しても次回のフラッシュで再試行）。
 * - chunkSize 件ずつ送信して単一リクエストのペイロードサイズを制限する。
 * - 送信成功件数を返す（0 は送信なし or 失敗）。
 */
export async function flushAuditQueue(endpoint: string, chunkSize = 50): Promise<number> {
  const current = await getSettings();
  if (current.auditLog.length === 0) return 0;

  const chunk = current.auditLog.slice(0, chunkSize);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) return 0;
  } catch {
    return 0;
  }

  const remaining = current.auditLog.slice(chunkSize);
  await setSettings({ auditLog: remaining });
  return chunk.length;
}

/**
 * Subscribes to settings changes. Returns an unsubscribe function.
 * The callback receives the freshly merged settings object.
 */
export function onSettingsChanged(callback: (settings: KibaSettings) => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName !== 'local' || !(SETTINGS_KEY in changes)) return;
    const next = (changes[SETTINGS_KEY].newValue ?? {}) as Partial<KibaSettings>;
    callback({ ...DEFAULT_SETTINGS, ...next });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
