import { useEffect, useState } from 'react';
import { MousePointerClick, EyeOff, KeyRound, Building2, Upload, Cloud } from 'lucide-react';
import type { KibaSettings } from '../../types';
import { Card, StatCard, Toggle, TenantList } from '../Popup';

/** Props passed down from the Popup router. */
export interface DashboardProps {
  settings: KibaSettings;
  loading: boolean;
  /** 組織管理下（読み取り専用ロックダウン）のとき true。 */
  isManaged: boolean;
  blockedCount: number;
  onToggleAntiClickFix: () => void;
  onToggleMask: () => void;
  onToggleSso: () => void;
  onGrantBypass: () => void;
}

/** Main dashboard tab: stats, feature toggles, file-control simulator, tenants. */
export function Dashboard({
  settings,
  loading,
  isManaged,
  blockedCount,
  onToggleAntiClickFix,
  onToggleMask,
  onToggleSso,
  onGrantBypass,
}: DashboardProps) {
  // 管理下では全トグルを読み取り専用にする（loading 中も無効）。
  const locked = loading || isManaged;
  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Items Blocked" value={blockedCount} />
        <StatCard
          label="One-Time Bypass"
          value={settings.oneTimeBypass ? 'Armed' : 'Off'}
          accent={settings.oneTimeBypass ? 'amber' : 'emerald'}
        />
      </div>

      {/* Anti-ClickFix toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MousePointerClick className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <div>
              <div className="text-sm font-semibold">Anti-ClickFix</div>
              <div className="text-xs text-emerald-200/60">
                Block dangerous OS-command pastes
              </div>
            </div>
          </div>
          <Toggle
            checked={settings.antiClickFixEnabled}
            disabled={locked}
            onChange={onToggleAntiClickFix}
            label="Anti-ClickFix"
          />
        </div>
      </Card>

      {/* Paste masking toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <EyeOff className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <div>
              <div className="text-sm font-semibold">Confidential Masking</div>
              <div className="text-xs text-emerald-200/60">
                Mask secrets on foreign-tenant pastes
              </div>
            </div>
          </div>
          <Toggle
            checked={settings.maskEnabled}
            disabled={locked}
            onChange={onToggleMask}
            label="Confidential Masking"
          />
        </div>
      </Card>

      {/* Pseudo-SSO toggle (credential list lives in the SSO tab) */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <div>
              <div className="text-sm font-semibold">Pseudo-SSO Autofill</div>
              <div className="text-xs text-emerald-200/60">
                Hidden autofill for shared accounts
              </div>
            </div>
          </div>
          <Toggle
            checked={settings.ssoEnabled}
            disabled={locked}
            onChange={onToggleSso}
            label="Pseudo-SSO Autofill"
          />
        </div>
      </Card>

      {/* Trusted tenant whitelist (read-only) */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <div className="text-sm font-semibold">Trusted Tenants</div>
          </div>
          <span className="text-[11px] text-emerald-200/50">
            {settings.tenantWhitelist.length} entries
          </span>
        </div>
        <TenantList entries={settings.tenantWhitelist} />
      </Card>

      {/* One-Time Bypass control */}
      <Card>
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
          <div className="text-sm font-semibold">One-Time Upload Bypass</div>
        </div>
        <div className="mt-1 text-xs text-emerald-200/60">
          Request a single-use upload exception for restricted domains. Approval
          is mediated by the admin console.
        </div>
        <button
          onClick={onGrantBypass}
          disabled={settings.oneTimeBypass !== null || isManaged}
          className="mt-3 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zenprax-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {settings.oneTimeBypass
            ? 'Bypass Armed — use one upload'
            : 'Request One-Time Bypass'}
        </button>
      </Card>

      {/* クラウド同期設定（個人・OSS 利用時のみ。管理下では非表示）。 */}
      {!isManaged && <CloudSyncCard />}
    </div>
  );
}

/**
 * 個人用クラウド同期設定カード。Zenprax Cloud 発行の Policy ID(UUID) と
 * Decryption Key(BYOK 鍵) を chrome.storage.local に保存し、保存と同時に
 * background へ即時同期を要求する。
 */
function CloudSyncCard() {
  const [policyId, setPolicyId] = useState('');
  const [decryptionKey, setDecryptionKey] = useState('');
  const [saved, setSaved] = useState(false);

  // 既存の保存値を読み込んでフォームへ反映する。
  useEffect(() => {
    void chrome.storage.local.get(['customPolicyId', 'decryptionKey']).then((v) => {
      if (typeof v.customPolicyId === 'string') setPolicyId(v.customPolicyId);
      if (typeof v.decryptionKey === 'string') setDecryptionKey(v.decryptionKey);
    });
  }, []);

  async function save() {
    await chrome.storage.local.set({
      customPolicyId: policyId.trim(),
      decryptionKey: decryptionKey.trim(),
    });
    // 保存直後に background へ即時ポリシー同期を要求する。
    await chrome.runtime.sendMessage({ kind: 'kiba:request-sync' });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
        <div className="text-sm font-semibold">クラウド同期設定</div>
      </div>
      <div className="mt-1 text-xs text-emerald-200/60">
        Zenprax Cloud で発行された Policy ID と復号鍵（BYOK）を入力して同期します。
      </div>

      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-emerald-200/50">
        Policy ID (UUID)
      </label>
      <input
        type="text"
        value={policyId}
        onChange={(e) => setPolicyId(e.target.value)}
        placeholder="00000000-0000-0000-0000-000000000000"
        className="mt-1 w-full rounded-lg border border-emerald-500/15 bg-zenprax-950/60 px-2.5 py-2 font-mono text-xs text-emerald-50 placeholder:text-emerald-200/30 focus:border-emerald-500/40 focus:outline-none"
      />

      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-emerald-200/50">
        Decryption Key (BYOK · Base64)
      </label>
      <input
        type="password"
        value={decryptionKey}
        onChange={(e) => setDecryptionKey(e.target.value)}
        placeholder="Base64 encoded AES-GCM key"
        className="mt-1 w-full rounded-lg border border-emerald-500/15 bg-zenprax-950/60 px-2.5 py-2 font-mono text-xs text-emerald-50 placeholder:text-emerald-200/30 focus:border-emerald-500/40 focus:outline-none"
      />

      <button
        onClick={() => void save()}
        className="mt-3 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zenprax-950 transition hover:brightness-110"
      >
        {saved ? 'Saved — Syncing…' : 'Save & Sync'}
      </button>
    </Card>
  );
}
