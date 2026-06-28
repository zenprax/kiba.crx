import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { Toggle } from './Toggle';

/** Props for a single feature toggle row inside a Card. */
export interface FeatureToggleCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}

/** Card containing an icon, title/description, and a toggle switch for one feature. */
export function FeatureToggleCard({
  icon: Icon,
  title,
  description,
  checked,
  disabled,
  onChange,
  label,
}: FeatureToggleCardProps) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-zp-2">
          <Icon className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
          <div>
            <div className="text-zp-base font-semibold">{title}</div>
            <div className="text-zp-md text-text-muted">{description}</div>
          </div>
        </div>
        <Toggle checked={checked} disabled={disabled} onChange={onChange} label={label} />
      </div>
    </Card>
  );
}
