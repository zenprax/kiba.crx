import { SlidersHorizontal } from 'lucide-react';
import type { KibaMode, KibaSettings } from '../../../types';
import type { DryRunFeature } from '../../../lib/dryRun';
import { Card } from '../../components';
import { useLang } from '../../i18n';
import { ManagedNote } from './ManagedNote';

/** Card for switching per-feature enforcement mode (ENFORCE / DRY_RUN / follow global setting). */
export function FeatureModesCard({
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

  // 'global' is a pseudo-value that deletes the relevant key to fall back to the global mode.
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
