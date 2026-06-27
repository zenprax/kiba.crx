import { useState } from 'react';
import { Shield, ShieldOff, Plus, X, Lock } from 'lucide-react';
import type { KibaSettings } from '../../types';
import { Card } from '../Popup';
import { useLang } from '../i18n';

export interface FilterTabProps {
  settings: KibaSettings;
  isManaged: boolean;
  onUpdateSettings: (patch: Partial<KibaSettings>) => Promise<void>;
}

export function FilterTab({ settings, isManaged, onUpdateSettings }: FilterTabProps) {
  const t = useLang();

  return (
    <div className="space-y-zp-3">
      <DomainListCard
        icon={<ShieldOff className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />}
        title={t.filter.blockTitle}
        desc={t.filter.blockDesc}
        placeholder={t.filter.blockPlaceholder}
        entries={settings.userBlockDomains}
        isManaged={isManaged}
        addButton={t.filter.addButton}
        removeAriaLabel={t.filter.removeAriaLabel}
        noEntries={t.filter.noEntries}
        managedNote={t.filter.managedNote}
        domainLabel={t.filter.domainLabel}
        onUpdate={(next) => void onUpdateSettings({ userBlockDomains: next })}
      />
      <DomainListCard
        icon={<Shield className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />}
        title={t.filter.allowTitle}
        desc={t.filter.allowDesc}
        placeholder={t.filter.allowPlaceholder}
        entries={settings.filterAllowlist}
        isManaged={isManaged}
        addButton={t.filter.addButton}
        removeAriaLabel={t.filter.removeAriaLabel}
        noEntries={t.filter.noEntries}
        managedNote={t.filter.managedNote}
        domainLabel={t.filter.domainLabel}
        onUpdate={(next) => void onUpdateSettings({ filterAllowlist: next })}
      />
    </div>
  );
}

interface DomainListCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  placeholder: string;
  entries: string[];
  isManaged: boolean;
  addButton: string;
  removeAriaLabel: string;
  noEntries: string;
  managedNote: string;
  domainLabel: string;
  onUpdate: (next: string[]) => void;
}

function DomainListCard({
  icon,
  title,
  desc,
  placeholder,
  entries,
  isManaged,
  addButton,
  removeAriaLabel,
  noEntries,
  managedNote,
  domainLabel,
  onUpdate,
}: DomainListCardProps) {
  const [input, setInput] = useState('');

  function handleAdd() {
    const domain = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!domain || entries.includes(domain)) return;
    onUpdate([...entries, domain]);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd();
  }

  function handleRemove(index: number) {
    onUpdate(entries.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <div className="flex items-center gap-zp-2">
        {icon}
        <div className="text-zp-base font-semibold">{title}</div>
      </div>
      <div className="mt-zp-1 text-zp-md text-text-muted">{desc}</div>

      {isManaged ? (
        <div className="mt-zp-2 flex items-center gap-zp-2 rounded-zp-lg border border-border-default bg-bg-surface px-zp-3 py-zp-2 text-zp-sm font-semibold text-brand-primary">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{managedNote}</span>
        </div>
      ) : (
        <div className="mt-zp-3 flex gap-zp-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={domainLabel}
            className="min-w-0 flex-1 rounded-zp-lg border border-input-border bg-bg-surface px-zp-2 py-zp-2 font-mono text-zp-md text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className="flex shrink-0 items-center gap-zp-1 rounded-zp-lg bg-brand-hover px-zp-3 py-zp-2 text-zp-base font-semibold text-text-on-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {addButton}
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="mt-zp-2 rounded-zp-lg border border-dashed border-border-default py-zp-3 text-center text-zp-sm text-text-muted">
          {noEntries}
        </div>
      ) : (
        <ul className="mt-zp-3 space-y-1.5">
          {entries.map((domain, i) => (
            <li
              key={`${domain}-${i}`}
              className="flex items-center justify-between rounded-zp-lg bg-bg-base/60 px-zp-2 py-zp-2 text-zp-md"
            >
              <span className="truncate font-mono text-text-primary">{domain}</span>
              {!isManaged && (
                <button
                  onClick={() => handleRemove(i)}
                  aria-label={removeAriaLabel}
                  className="ml-zp-2 shrink-0 rounded-zp-sm p-0.5 text-text-muted transition hover:bg-btn-danger-bg hover:text-text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
