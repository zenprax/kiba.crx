import { useEffect, useState } from 'react';
import { Cloud, Languages } from 'lucide-react';
import type { KibaSettings } from '../../types';
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
