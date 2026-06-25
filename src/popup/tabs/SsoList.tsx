import { Card } from '../Popup';

/** SsoList の props。資格情報そのものは popup へ渡さず、状態のみ表示する。 */
export interface SsoListProps {
  /** コンソール連携が構成済みか（credentialUrl 設定済み）。 */
  configured: boolean;
  /** background のメモリに保持された資格情報の件数（password は含まない）。 */
  count: number;
}

/**
 * 擬似 SSO の状態表示タブ。
 *
 * 資格情報は background（credentialBroker）のメモリ常駐キャッシュにのみ存在し、
 * popup は信頼境界外のため password はおろか資格情報自体を受け取らない。
 * ここでは「コンソール管理・N 件同期済み」という状態のみを表示する。
 */
export function SsoList({ configured, count }: SsoListProps) {
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Shared Credentials</div>
          <span className="text-[11px] text-emerald-200/50">{count} synced</span>
        </div>
        <p className="mt-1 text-xs text-emerald-200/60">
          Credentials are managed by the admin console and held only in memory by
          the extension background. They are never stored or shown here.
        </p>
        {!configured ? (
          <div className="mt-3 rounded-lg border border-dashed border-emerald-500/15 py-3 text-center text-[11px] text-emerald-200/40">
            Console not configured. SSO autofill is inactive.
          </div>
        ) : count === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-emerald-500/15 py-3 text-center text-[11px] text-emerald-200/40">
            No credentials synced yet (online sync required).
          </div>
        ) : (
          <div className="mt-3 rounded-lg bg-zenprax-950/60 px-2.5 py-2 text-xs text-emerald-200/70">
            {count} shared credential{count === 1 ? '' : 's'} synced from console.
          </div>
        )}
      </Card>
    </div>
  );
}
