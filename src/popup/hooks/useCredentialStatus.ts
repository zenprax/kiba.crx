/**
 * 擬似 SSO 資格情報の同期状態を background（credentialBroker）へ問い合わせるフック。
 *
 * セキュリティ要件: 資格情報そのものは popup に渡さない。構成有無（configured）と
 * 件数（count）のみを取得する。ssoEnabled が変化したタイミングで再問い合わせする。
 */

import { useEffect, useState } from 'react';
import { sendKibaMessage } from '../../lib/messaging';
import type { CredentialStatusResponse } from '../../types';

/**
 * background から返る資格情報の同期状態（機密情報は含まない）。
 * メッセージング契約 {@link CredentialStatusResponse} のエイリアス。
 */
export type CredentialStatus = CredentialStatusResponse;

const EMPTY_STATUS: CredentialStatus = { configured: false, count: 0 };

/**
 * 資格情報の同期状態を返すフック。ssoEnabled に依存して再問い合わせする。
 */
export function useCredentialStatus(ssoEnabled: boolean): CredentialStatus {
  const [status, setStatus] = useState<CredentialStatus>(EMPTY_STATUS);

  useEffect(() => {
    void sendKibaMessage({ kind: 'kiba:credential-status' }).then((res) => {
      if (res) setStatus(res);
    });
  }, [ssoEnabled]);

  return status;
}
