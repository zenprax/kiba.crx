/**
 * Hook that determines whether the device is under an organization master
 * policy (GPO/MDM).
 *
 * Source of truth 1: the policyId in chrome.storage.managed. In environments
 * that do not support managed storage (e.g. personal Chrome), get throws or
 * returns empty, in which case the result is false.
 */

import { useEffect, useState } from 'react';

/**
 * Returns whether a policyId is deployed in managed storage.
 *
 * This is only one factor in the "managed lock" determination. The effective
 * lock is evaluated by the caller as an OR with settings.isManaged derived from
 * compileActiveSettings.
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
