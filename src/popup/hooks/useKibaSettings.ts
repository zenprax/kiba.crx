/**
 * Settings hook for the popup.
 *
 * Encapsulates reading chrome.storage.local (getSettings) and subscribing to
 * changes (onSettingsChanged), keeping the UI components a pure presentation
 * layer. The persistence logic is consolidated in lib/storage.ts, and this hook
 * is merely a thin React adapter on top of it.
 */

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type KibaSettings } from '../../types';
import { getSettings, onSettingsChanged, setSettings } from '../../lib/storage';

/** Return value of useKibaSettings. */
export interface UseKibaSettings {
  /** Current settings (initially DEFAULT_SETTINGS, replaced with real values once loaded). */
  settings: KibaSettings;
  /** True until the initial load completes. */
  loading: boolean;
  /** Persists a partial update and immediately reflects it in local state. */
  updateSettings: (patch: Partial<KibaSettings>) => Promise<void>;
}

/**
 * Hook that performs the initial settings load and subscribes to storage changes.
 *
 * Because onSettingsChanged automatically reflects updates from the background
 * and other surfaces, manual syncing after updateSettings is unnecessary, but
 * setLocal is still called for immediate responsiveness.
 */
export function useKibaSettings(): UseKibaSettings {
  const [settings, setLocal] = useState<KibaSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getSettings().then((s) => {
      setLocal(s);
      setLoading(false);
    });
    return onSettingsChanged(setLocal);
  }, []);

  const updateSettings = useCallback(async (patch: Partial<KibaSettings>) => {
    setLocal(await setSettings(patch));
  }, []);

  return { settings, loading, updateSettings };
}
