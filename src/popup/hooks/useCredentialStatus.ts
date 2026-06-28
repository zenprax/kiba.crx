/**
 * Hook that queries the background (credentialBroker) for the sync status of
 * pseudo-SSO credentials.
 *
 * Security requirement: the credentials themselves are never passed to the popup.
 * Only whether they are configured (configured) and the count (count) are
 * retrieved. It re-queries whenever ssoEnabled changes.
 */

import { useEffect, useState } from 'react';
import { sendKibaMessage } from '../../lib/messaging';
import type { CredentialStatusResponse } from '../../types';

/**
 * The credential sync status returned by the background (contains no secrets).
 * Alias for the messaging contract {@link CredentialStatusResponse}.
 */
export type CredentialStatus = CredentialStatusResponse;

const EMPTY_STATUS: CredentialStatus = { configured: false, count: 0 };

/**
 * Hook that returns the credential sync status. Re-queries based on ssoEnabled.
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
