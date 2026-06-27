/**
 * 組織のマスターポリシー（GPO/MDM）配下かどうかを判定するフック。
 *
 * 判定の真実源 1: chrome.storage.managed の policyId。managed ストレージ非対応の
 * 環境（個人 Chrome 等）では get が例外を投げる/空を返すため、その場合は false。
 */

import { useEffect, useState } from 'react';

/**
 * managed ストレージに policyId が配備されているかを返す。
 *
 * これは「管理ロック」判定の一要素にすぎない。実効的なロックは呼び出し側で
 * compileActiveSettings 由来の settings.isManaged との OR で評価する。
 */
export function useManagedPolicy(): boolean {
  const [managedByPolicy, setManagedByPolicy] = useState(false);

  useEffect(() => {
    void chrome.storage.managed
      .get(['policyId'])
      .then((m) => setManagedByPolicy(typeof m.policyId === 'string' && m.policyId.length > 0))
      .catch(() => setManagedByPolicy(false));
  }, []);

  return managedByPolicy;
}
