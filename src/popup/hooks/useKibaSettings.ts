/**
 * Popup 用の設定フック。
 *
 * chrome.storage.local の読み込み（getSettings）と変更購読（onSettingsChanged）を
 * 内包し、UI コンポーネントを純粋なプレゼンテーション層に保つ。永続化ロジックは
 * lib/storage.ts に集約済みで、本フックはその上の薄い React アダプタにすぎない。
 */

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type KibaSettings } from '../../types';
import { getSettings, onSettingsChanged, setSettings } from '../../lib/storage';

/** useKibaSettings の戻り値。 */
export interface UseKibaSettings {
  /** 現在の設定（初期値は DEFAULT_SETTINGS、ロード完了で実値へ）。 */
  settings: KibaSettings;
  /** 初回ロードが完了していなければ true。 */
  loading: boolean;
  /** 部分更新を永続化し、ローカル state も即時反映する。 */
  updateSettings: (patch: Partial<KibaSettings>) => Promise<void>;
}

/**
 * 設定の初期ロードと storage 変更購読を行うフック。
 *
 * onSettingsChanged により background / 他サーフェスからの更新も自動で反映される
 * ため、updateSettings 後の手動同期は不要だが、即時反応性のため setLocal も呼ぶ。
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
