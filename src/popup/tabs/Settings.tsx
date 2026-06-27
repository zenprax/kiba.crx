import { useEffect, useState } from 'react';
import { Cloud, Languages, Building2, Plus, X } from 'lucide-react';
import type { KibaSettings, TenantWhitelistEntry } from '../../types';
import type { TenantProvider } from '../../types';
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

      {/* Cloud sync settings (personal/non-managed only) */}
      {!isManaged && <CloudSyncCard />}

      {/* Trusted tenant manager */}
      <TenantManagerCard
        entries={settings.tenantWhitelist}
        isManaged={isManaged}
        onUpdateSettings={onUpdateSettings}
      />
    </div>
  );
}

function CloudSyncCard() {
  const t = useLang();
  const [policyId, setPolicyId] = useState('');
  const [decryptionKey, setDecryptionKey] = useState('');
  const [saved, setSaved] = useState(false);

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
    await chrome.runtime.sendMessage({ kind: 'kiba:request-sync' });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <div className="flex items-center gap-zp-2">
        <Cloud className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
        <div className="text-zp-base font-semibold">{t.settings.cloudSync}</div>
      </div>
      <div className="mt-zp-1 text-zp-md text-text-muted">{t.settings.cloudSyncDesc}</div>

      <label className="mt-zp-3 block text-zp-sm font-semibold uppercase tracking-wide text-text-muted">
        {t.settings.policyIdLabel}
      </label>
      <input
        type="text"
        value={policyId}
        onChange={(e) => setPolicyId(e.target.value)}
        placeholder="00000000-0000-0000-0000-000000000000"
        className="mt-zp-1 w-full rounded-zp-lg border border-input-border bg-bg-surface px-zp-2 py-zp-2 font-mono text-zp-md text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none"
      />

      <label className="mt-zp-3 block text-zp-sm font-semibold uppercase tracking-wide text-text-muted">
        {t.settings.decryptionKeyLabel}
      </label>
      <input
        type="password"
        value={decryptionKey}
        onChange={(e) => setDecryptionKey(e.target.value)}
        placeholder="Base64 encoded AES-GCM key"
        className="mt-zp-1 w-full rounded-zp-lg border border-input-border bg-bg-surface px-zp-2 py-zp-2 font-mono text-zp-md text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none"
      />

      <button
        onClick={() => void save()}
        className="mt-zp-3 w-full rounded-zp-lg bg-brand-hover px-zp-3 py-zp-2 text-zp-base font-semibold text-text-on-brand transition hover:brightness-110"
      >
        {saved ? 'Saved — Syncing…' : 'Save & Sync'}
      </button>
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
        <div className="mt-zp-2 text-zp-sm text-text-muted">{t.tenantManager.managedNote}</div>
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
              <option key={p} value={p}>{p}</option>
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
                <div className="truncate font-mono text-zp-xs text-text-muted">{entry.tenantId}</div>
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
