/**
 * Pull 型ポリシー同期。
 *
 * 仕様どおり kiba.crx は WebSocket を張らない。ポリシー更新はスケジュール
 * （chrome.alarms）・起動時・ネットワーク復帰時に静的 URL から *pull* する。
 * 取得ペイロードは顧客管理鍵（BYOK）で AES-GCM 暗号化された JSON で、
 * crypto.subtle で復号する。
 *
 * エンドポイントと鍵は src/lib/consoleClient.ts の CONSOLE_CONFIG に集約。
 * 未設定（null）のときは no-op となり、ローカル既定ポリシーが維持される。
 */

import { decryptEnvelope, type EncryptedEnvelope } from '../lib/crypto';
import { CONSOLE_CONFIG, resolveKey } from '../lib/consoleClient';
import { parsePolicyPayload, type PolicyPatch } from '../lib/policySchema';
import { getSettings, setSettings } from '../lib/storage';
import type { KibaSettings } from '../types';

/** chrome.alarms name used to schedule periodic policy pulls. */
const SYNC_ALARM = 'kiba:sync';

/** Sync interval in minutes. */
const SYNC_PERIOD_MINUTES = 30;

/**
 * 検証済みポリシーパッチを現在の設定へ適用する。auth は部分パッチなので既存値と
 * 合成してから保存する（setSettings は浅いマージのため auth は丸ごと置換される）。
 */
async function applyPolicyPatch(patch: PolicyPatch): Promise<void> {
  const { auth: authPatch, ...rest } = patch;
  const update: Partial<KibaSettings> = { ...rest };

  if (authPatch) {
    const current = await getSettings();
    update.auth = { ...current.auth, ...authPatch };
  }

  await setSettings(update);
}

/**
 * リモートポリシーを pull して適用する。エンドポイント／鍵が未設定のときは
 * 即座に return（OSS フォールバック：ローカル既定を維持）。fetch 失敗・復号失敗・
 * スキーマ不正はいずれもローカル現状維持で握りつぶす（不正ポリシーは適用しない）。
 */
export async function syncPolicy(): Promise<void> {
  const { policyUrl, keyRef } = CONSOLE_CONFIG;
  if (policyUrl === null || keyRef === null) return;

  try {
    const res = await fetch(policyUrl, { cache: 'no-store' });
    if (!res.ok) return;
    const envelope = (await res.json()) as EncryptedEnvelope;

    const key = await resolveKey(keyRef);
    const plaintext = await decryptEnvelope(envelope, key);
    const patch = parsePolicyPayload(JSON.parse(plaintext));
    if (!patch) return;

    await applyPolicyPatch(patch);
  } catch {
    // ネットワーク／復号／パース失敗時はローカル既定を維持する。
    return;
  }
}

/**
 * Registers the sync alarm, runs an initial sync, and wires network-recovery
 * triggers. Safe to call once at service-worker startup.
 */
export function initSyncManager(): void {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_PERIOD_MINUTES });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== SYNC_ALARM) return;
    void syncPolicy();
  });

  // Trigger a pull on startup and whenever connectivity returns.
  void syncPolicy();
  self.addEventListener('online', () => {
    void syncPolicy();
  });
}
