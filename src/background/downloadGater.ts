/**
 * Feature: Download Gater（未承認ドメインからのダウンロード制御）。
 *
 * アップロード（持ち出し）だけでなく、未承認 SaaS からのダウンロード（マルウェアの
 * 持ち込み・不正なデータ取得）もリスク。chrome.downloads.onCreated で開始を検知し、
 * 未承認ドメインからのダウンロードを chrome.downloads.pause で一時停止する。OS 通知の
 * 「許可 / キャンセル」ボタンで、承認なら resume、却下なら cancel する。
 *
 * DRY_RUN（download 機能モード）では pause せず監査ログのみ記録する。
 *
 * 判定ロジックの純粋関数（shouldGateDownload / extractDownloadHost）は DOM/Chrome
 * 非依存で単体テスト可能（downloadGater.test.ts）。
 */

import { isDryRun, tagDetail } from '../lib/dryRun';
import { addAuditLog, getSettings } from '../lib/storage';
import type { KibaSettings } from '../types';

/** 通知 ID → 一時停止中のダウンロード ID。承認/却下ボタン処理で参照する。 */
const pendingByNotification = new Map<string, number>();
/** 通知 ID プレフィックス（他機能の通知と区別する）。 */
const NOTIF_PREFIX = 'kiba:download-gate:';

/**
 * ダウンロードの「出所ホスト名」を取り出す。finalUrl > url > referrer の順で
 * 最初に解釈できたものを使う。解釈不能なら null。
 */
export function extractDownloadHost(item: {
  finalUrl?: string;
  url?: string;
  referrer?: string;
}): string | null {
  for (const candidate of [item.finalUrl, item.url, item.referrer]) {
    if (!candidate) continue;
    try {
      return new URL(candidate).hostname;
    } catch {
      // 次の候補へ。
    }
  }
  return null;
}

/** host が allowlist に載っているか（完全一致 or サブドメイン一致）。 */
function isAllowedHost(host: string, allowlist: string[]): boolean {
  return allowlist.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * このダウンロードをゲート（一時停止・確認）すべきか判定する純粋関数。
 *  - Download Gater 無効 → false
 *  - ホスト不明 → false（判定材料が無いものは通す＝誤ブロック回避）
 *  - allowlist 一致 → false
 *  - それ以外 → true
 */
export function shouldGateDownload(
  host: string | null,
  settings: Pick<KibaSettings, 'downloadGaterEnabled' | 'downloadAllowlist'>,
): boolean {
  if (!settings.downloadGaterEnabled) return false;
  if (!host) return false;
  if (isAllowedHost(host, settings.downloadAllowlist)) return false;
  return true;
}

async function onDownloadCreated(item: chrome.downloads.DownloadItem): Promise<void> {
  const settings = await getSettings();
  const host = extractDownloadHost(item);
  if (!shouldGateDownload(host, settings)) return;

  const hostname = host ?? 'unknown';

  // DRY_RUN: 一時停止せず記録のみ。（機能単位 DRY_RUN がマージされたら
  // isDryRunFor(settings, 'download') へ差し替え可能。）
  if (isDryRun(settings)) {
    void addAuditLog(
      'download-block',
      tagDetail(`Download from ${hostname} would be gated`, true),
      hostname,
    );
    return;
  }

  // ENFORCE: 一時停止して確認を求める。
  try {
    await chrome.downloads.pause(item.id);
  } catch {
    return; // すでに完了/中断などで pause できない場合は何もしない。
  }

  void addAuditLog(
    'download-block',
    tagDetail(`Paused download from ${hostname}`, false),
    hostname,
  );

  const notificationId = `${NOTIF_PREFIX}${item.id}`;
  pendingByNotification.set(notificationId, item.id);
  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'kiba.crx — Download paused',
    message: `A download from ${hostname} was paused by policy. Allow it?`,
    priority: 2,
    buttons: [{ title: 'Allow' }, { title: 'Cancel' }],
    requireInteraction: true,
  });
}

/** 通知ボタン押下を処理する。button 0 = Allow（resume）、1 = Cancel。 */
async function onNotificationButton(notificationId: string, buttonIndex: number): Promise<void> {
  const downloadId = pendingByNotification.get(notificationId);
  if (downloadId === undefined) return;
  pendingByNotification.delete(notificationId);
  chrome.notifications.clear(notificationId);

  try {
    if (buttonIndex === 0) {
      await chrome.downloads.resume(downloadId);
    } else {
      await chrome.downloads.cancel(downloadId);
    }
  } catch {
    // ダウンロードがすでに無効化されている等は無視。
  }
}

/** 通知本体クリック（ボタン以外）は安全側＝キャンセル扱いで閉じる。 */
async function onNotificationClicked(notificationId: string): Promise<void> {
  if (!notificationId.startsWith(NOTIF_PREFIX)) return;
  const downloadId = pendingByNotification.get(notificationId);
  if (downloadId === undefined) return;
  pendingByNotification.delete(notificationId);
  chrome.notifications.clear(notificationId);
  try {
    await chrome.downloads.cancel(downloadId);
  } catch {
    // 無視。
  }
}

/** Download Gater のリスナを配線する。background 起動時に 1 度呼ぶ。 */
export function initDownloadGater(): void {
  chrome.downloads.onCreated.addListener((item) => void onDownloadCreated(item));
  chrome.notifications.onButtonClicked.addListener(
    (notificationId, buttonIndex) => void onNotificationButton(notificationId, buttonIndex),
  );
  chrome.notifications.onClicked.addListener(
    (notificationId) => void onNotificationClicked(notificationId),
  );
}
