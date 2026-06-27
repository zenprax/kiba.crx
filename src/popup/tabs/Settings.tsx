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
    <div className="space-y-3">
      {/* Language selection */}
      <Card>
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
          <div className="text-sm font-semibold">{t.settings.langTitle}</div>
        </div>
        <div className="mt-2 flex gap-2">
          {(['ja', 'en'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => void onUpdateSettings({ language: lang })}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
                settings.language === lang
                  ? 'bg-emerald-500 text-zenprax-950'
                  : 'bg-zenprax-950/60 text-emerald-200/60 hover:text-emerald-200'
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
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
        <div className="text-sm font-semibold">{t.settings.cloudSync}</div>
      </div>
      <div className="mt-1 text-xs text-emerald-200/60">{t.settings.cloudSyncDesc}</div>

      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-emerald-200/50">
        {t.settings.policyIdLabel}
      </label>
      <input
        type="text"
        value={policyId}
        onChange={(e) => setPolicyId(e.target.value)}
        placeholder="00000000-0000-0000-0000-000000000000"
        className="mt-1 w-full rounded-lg border border-emerald-500/15 bg-zenprax-950/60 px-2.5 py-2 font-mono text-xs text-emerald-50 placeholder:text-emerald-200/30 focus:border-emerald-500/40 focus:outline-none"
      />

      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-emerald-200/50">
        {t.settings.decryptionKeyLabel}
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
