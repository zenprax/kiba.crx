import * as Switch from '@radix-ui/react-switch';

/** Accessible on/off switch built on Radix Switch. */
export function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <Switch.Root
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      aria-label={label}
      className="relative h-6 w-11 shrink-0 rounded-zp-full bg-toggle-off transition data-[state=checked]:bg-brand-primary disabled:opacity-50"
    >
      <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-zp-full bg-toggle-knob transition-transform data-[state=checked]:translate-x-[22px]" />
    </Switch.Root>
  );
}
