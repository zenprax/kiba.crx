import { useEffect, useState } from 'react';
import {
  Cloud,
  Languages,
  Building2,
  Plus,
  X,
  KeyRound,
  Lock,
  CheckCircle2,
  SlidersHorizontal,
  Sun,
  Moon,
} from 'lucide-react';
import type { KibaMode, KibaSettings, TenantWhitelistEntry } from '../../types';
import type { TenantProvider } from '../../types';
import type { DryRunFeature } from '../../lib/dryRun';
import { sendKibaMessage } from '../../lib/messaging';
import { Card } from '../Popup';
import { useLang } from '../i18n';

export interface SettingsProps {
  settings: KibaSettings;
  isManaged: boolean;
  onUpdateSettings: (patch: Partial<KibaSettings>) => Promise<void>;
}

export function Settings({ settings, isManaged, onUpdateSettings }: SettingsProps) {
  const t = useLang();

  return (
    <div className="space-y-zp-3">
      {/* Theme selection */}
      <Card>
        <div className="flex items-center gap-zp-2">
          {settings.theme === 'dark' ? (
            <Moon className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
          ) : (
            <Sun className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
          )}
          <div className="text-zp-base font-semibold">{t.settings.themeTitle}</div>
        </div>
        <div className="mt-zp-2 flex gap-zp-2">
          {(['dark', 'light'] as const).map((th) => (
            <button
              key={th}
              onClick={() => void onUpdateSettings({ theme: th })}
              className={`rounded-zp-lg px-zp-4 py-zp-1 text-zp-md font-semibold transition ${
                settings.theme === th
                  ? 'bg-brand-hover text-text-on-brand'
                  : 'bg-bg-base/60 text-text-muted hover:text-text-secondary'
              }`}
            >
              {th === 'dark' ? 'ダーク' : 'ライト'}
            </button>
          ))}
        </div>
      </Card>

      {/* Language selection */}
      <Card>
        <div className="flex items-center gap-zp-2">
          <Languages className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
          <div className="text-zp-base font-semibold">{t.settings.langTitle}</div>
        </div>
        <div className="mt-zp-2 flex gap-zp-2">
          {(['ja', 'en'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => void onUpdateSettings({ language: lang })}
              className={`rounded-zp-lg px-zp-4 py-zp-1 text-zp-md font-semibold transition ${
                settings.language === lang
                  ? 'bg-brand-hover text-text-on-brand'
                  : 'bg-bg-base/60 text-text-muted hover:text-text-secondary'
              }`}
            >
              {lang === 'ja' ? '日本語' : 'English'}
            </button>
          ))}
        </div>
      </Card>

      {/* Per-feature enforcement modes (機能単位 DRY_RUN) */}
      <FeatureModesCard
        settings={settings}
        isManaged={isManaged}
        onUpdateSettings={onUpdateSettings}
      />

      {/* Cloud sync settings. Visible even when managed, but locked down. */}
      <CloudSyncCard isManaged={isManaged} />

      {/* Trusted tenant manager */}
      <TenantManagerCard
        entries={settings.tenantWhitelist}
        isManaged={isManaged}
        onUpdateSettings={onUpdateSettings}
      />
    </div>
  );
}

/** popup ← 模擬 OAuth ポータルからの承認シグナル。 */
interface OAuthMockMessage {
  source: 'kiba-oauth';
  status: 'success';
}

function isOAuthMockMessage(data: unknown): data is OAuthMockMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === 'kiba-oauth' &&
    (data as { status?: unknown }).status === 'success'
  );
}

/** ランダムな 32 バイトの模擬復号鍵を Base64 で生成する。 */
function generateMockKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

type ConnectStatus = 'idle' | 'connecting' | 'connected';

/** Lock アイコン付きの「組織ポリシーで読み取り専用」警告バナー。 */
function ManagedNote({ text }: { text: string }) {
  return (
    <div className="mt-zp-2 flex items-center gap-zp-2 rounded-zp-lg border border-border-default bg-bg-surface px-zp-3 py-zp-2 text-zp-sm font-semibold text-brand-primary">
      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{text}</span>
    </div>
  );
}

function CloudSyncCard({ isManaged }: { isManaged: boolean }) {
  const t = useLang();
  const [status, setStatus] = useState<ConnectStatus>('idle');

  useEffect(() => {
    void chrome.storage.local.get('customPolicyId').then((v) => {
      if (typeof v.customPolicyId === 'string' && v.customPolicyId.length > 0) {
        setStatus('connected');
      }
    });
  }, []);

  function handleConnect() {
    if (isManaged) return;
    setStatus('connecting');

    const portal = window.open(
      chrome.runtime.getURL('oauth-mock.html'),
      'zenprax-cloud-auth',
      'width=440,height=620',
    );

    const onMessage = async (event: MessageEvent<unknown>) => {
      if (!isOAuthMockMessage(event.data)) return;
      window.removeEventListener('message', onMessage);

      // 認証成功シグナル受領 → ID/鍵を自動生成して保存し、即時同期する。
      const customPolicyId = crypto.randomUUID();
      const decryptionKey = generateMockKey();
      await chrome.storage.local.set({ customPolicyId, decryptionKey });
      await sendKibaMessage({ kind: 'kiba:request-sync' });
      setStatus('connected');
    };

    window.addEventListener('message', onMessage);

    // ポータルがキャンセル/クローズされた場合に idle へ戻すための監視。
    if (portal) {
      const timer = window.setInterval(() => {
        if (portal.closed) {
          window.clearInterval(timer);
          window.removeEventListener('message', onMessage);
          setStatus((prev) => (prev === 'connecting' ? 'idle' : prev));
        }
      }, 500);
    }
  }

  const connected = status === 'connected';
  const connecting = status === 'connecting';

  return (
    <Card>
      <div className="flex items-center gap-zp-2">
        <Cloud className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
        <div className="text-zp-base font-semibold">{t.settings.cloudSync}</div>
      </div>
      <div className="mt-zp-1 text-zp-md text-text-muted">
        {connected ? t.settings.connectedDesc : t.settings.cloudSyncDesc}
      </div>

      {connected && (
        <div className="mt-zp-3 flex items-center gap-zp-2 rounded-zp-lg bg-bg-base/60 px-zp-3 py-zp-2 text-zp-md font-semibold text-status-warn-text">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
          <span className="text-text-primary">{t.settings.connected}</span>
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={isManaged || connecting}
        className="mt-zp-3 flex w-full items-center justify-center gap-zp-2 rounded-zp-lg bg-brand-hover px-zp-3 py-zp-2 text-zp-base font-semibold text-text-on-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <KeyRound className="h-4 w-4" aria-hidden />
        {connecting
          ? t.settings.connecting
          : connected
            ? t.settings.reconnectButton
            : t.settings.connectButton}
      </button>

      {isManaged && <ManagedNote text={t.settings.managedNote} />}
    </Card>
  );
}

/** 機能別の実施モード（ENFORCE / DRY_RUN / 全体設定に従う）切替カード。 */
function FeatureModesCard({
  settings,
  isManaged,
  onUpdateSettings,
}: {
  settings: KibaSettings;
  isManaged: boolean;
  onUpdateSettings: (patch: Partial<KibaSettings>) => Promise<void>;
}) {
  const t = useLang();
  const featureModes = settings.featureModes ?? {};

  const features: { key: DryRunFeature; label: string }[] = [
    { key: 'paste', label: t.settings.featurePaste },
    { key: 'file', label: t.settings.featureFile },
    { key: 'tenant', label: t.settings.featureTenant },
    { key: 'download', label: t.settings.featureDownload },
  ];

  // 'global' は該当キーを削除して全体 mode にフォールバックさせる擬似値。
  type Choice = KibaMode | 'global';

  async function setFeatureMode(key: DryRunFeature, choice: Choice) {
    const next: NonNullable<KibaSettings['featureModes']> = { ...featureModes };
    if (choice === 'global') {
      delete next[key];
    } else {
      next[key] = choice;
    }
    await onUpdateSettings({ featureModes: next });
  }

  return (
    <Card>
      <div className="flex items-center gap-zp-2">
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
        <div className="text-zp-base font-semibold">{t.settings.featureModesTitle}</div>
      </div>
      <div className="mt-zp-1 text-zp-md text-text-muted">{t.settings.featureModesDesc}</div>

      {isManaged ? (
        <ManagedNote text={t.settings.managedNote} />
      ) : (
        <ul className="mt-zp-3 space-y-zp-2">
          {features.map(({ key, label }) => {
            const value: Choice = featureModes[key] ?? 'global';
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-zp-2 rounded-zp-lg bg-bg-base/60 px-zp-2 py-zp-2 text-zp-md"
              >
                <span className="min-w-0 truncate text-text-primary">{label}</span>
                <select
                  value={value}
                  onChange={(e) => void setFeatureMode(key, e.target.value as Choice)}
                  aria-label={label}
                  className="shrink-0 rounded-zp-lg border border-input-border bg-bg-surface px-zp-2 py-zp-1 text-zp-sm text-text-primary focus:border-input-focus focus:outline-none"
                >
                  <option value="global">{t.settings.useGlobal}</option>
                  <option value="ENFORCE">{t.settings.enforce}</option>
                  <option value="DRY_RUN">{t.settings.dryRun}</option>
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const PROVIDERS: TenantProvider[] = ['slack', 'google', 'github', 'unknown'];

interface TenantManagerCardProps {
  entries: TenantWhitelistEntry[];
  isManaged: boolean;
  onUpdateSettings: (patch: Partial<KibaSettings>) => Promise<void>;
}

function TenantManagerCard({ entries, isManaged, onUpdateSettings }: TenantManagerCardProps) {
  const t = useLang();
  const [provider, setProvider] = useState<TenantProvider>('slack');
  const [tenantId, setTenantId] = useState('');
  const [label, setLabel] = useState('');

  async function handleAdd() {
    const trimmedId = tenantId.trim();
    const trimmedLabel = label.trim();
    if (!trimmedId || !trimmedLabel) return;
    const newEntry: TenantWhitelistEntry = { provider, tenantId: trimmedId, label: trimmedLabel };
    await onUpdateSettings({ tenantWhitelist: [...entries, newEntry] });
    setTenantId('');
    setLabel('');
  }

  async function handleRemove(index: number) {
    await onUpdateSettings({ tenantWhitelist: entries.filter((_, i) => i !== index) });
  }

  return (
    <Card>
      <div className="flex items-center gap-zp-2">
        <Building2 className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
        <div className="text-zp-base font-semibold">{t.tenantManager.title}</div>
      </div>

      {isManaged ? (
        <ManagedNote text={t.tenantManager.managedNote} />
      ) : (
        <div className="mt-zp-3 space-y-zp-2">
          <label className="block text-zp-sm font-semibold uppercase tracking-wide text-text-muted">
            {t.tenantManager.providerLabel}
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as TenantProvider)}
            className="w-full rounded-zp-lg border border-input-border bg-bg-surface px-zp-2 py-zp-2 text-zp-md text-text-primary focus:border-input-focus focus:outline-none"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <label className="block text-zp-sm font-semibold uppercase tracking-wide text-text-muted">
            {t.tenantManager.tenantIdLabel}
          </label>
          <input
            type="text"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder={t.tenantManager.tenantIdPlaceholder}
            className="w-full rounded-zp-lg border border-input-border bg-bg-surface px-zp-2 py-zp-2 font-mono text-zp-md text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none"
          />

          <label className="block text-zp-sm font-semibold uppercase tracking-wide text-text-muted">
            {t.tenantManager.labelLabel}
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t.tenantManager.labelPlaceholder}
            className="w-full rounded-zp-lg border border-input-border bg-bg-surface px-zp-2 py-zp-2 text-zp-md text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none"
          />

          <button
            onClick={() => void handleAdd()}
            disabled={!tenantId.trim() || !label.trim()}
            className="flex w-full items-center justify-center gap-zp-1 rounded-zp-lg bg-brand-hover px-zp-3 py-zp-2 text-zp-base font-semibold text-text-on-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t.tenantManager.addButton}
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <ul className="mt-zp-3 space-y-1.5">
          {entries.map((entry, i) => (
            <li
              key={`${entry.provider}-${entry.tenantId}-${i}`}
              className="flex items-center justify-between rounded-zp-lg bg-bg-base/60 px-zp-2 py-zp-2 text-zp-md"
            >
              <div className="min-w-0">
                <div className="truncate text-text-primary">{entry.label}</div>
                <div className="truncate font-mono text-zp-xs text-text-muted">
                  {entry.tenantId}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-zp-2">
                <span className="rounded-zp-sm bg-brand-muted px-zp-1 py-0.5 text-zp-xs font-bold uppercase text-brand-primary">
                  {entry.provider}
                </span>
                {!isManaged && (
                  <button
                    onClick={() => void handleRemove(i)}
                    aria-label={t.tenantManager.removeAriaLabel}
                    className="rounded-zp-sm p-0.5 text-text-muted transition hover:bg-btn-danger-bg hover:text-text-primary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
