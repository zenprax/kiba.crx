import { Languages, Sun, Moon } from 'lucide-react';
import type { KibaSettings } from '../../types';
import { Card } from '../components';
import { useLang } from '../i18n';
import { CloudSyncCard } from './settings/CloudSyncCard';
import { FeatureModesCard } from './settings/FeatureModesCard';
import { TenantManagerCard } from './settings/TenantManagerCard';

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

      {/* Per-feature enforcement modes (per-feature DRY_RUN) */}
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
