/**
 * 擬似 SSO 資格情報の同期状態を background（credentialBroker）へ問い合わせるフック。
 *
 * セキュリティ要件: 資格情報そのものは popup に渡さない。構成有無（configured）と
 * 件数（count）のみを取得する。ssoEnabled が変化したタイミングで再問い合わせする。
 */

import { useEffect, useState } from 'react';

/** background から返る資格情報の同期状態（機密情報は含まない）。 */
export interface CredentialStatus {
  /** コンソール連携で資格情報が構成済みなら true。 */
  configured: boolean;
  /** メモリ常駐キャッシュの資格情報件数（password は含まない）。 */
  count: number;
}

const EMPTY_STATUS: CredentialStatus = { configured: false, count: 0 };

/**
 * 資格情報の同期状態を返すフック。ssoEnabled に依存して再問い合わせする。
 */
export function useCredentialStatus(ssoEnabled: boolean): CredentialStatus {
  const [status, setStatus] = useState<CredentialStatus>(EMPTY_STATUS);

  useEffect(() => {
    void chrome.runtime
      .sendMessage({ kind: 'kiba:credential-status' })
      .then((res: CredentialStatus | undefined) => {
        if (res) setStatus(res);
      });
  }, [ssoEnabled]);

  return status;
}
