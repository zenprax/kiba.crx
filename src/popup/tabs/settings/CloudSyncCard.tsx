import { useEffect, useState } from 'react';
import { Cloud, KeyRound, CheckCircle2 } from 'lucide-react';
import { sendKibaMessage } from '../../../lib/messaging';
import { Card } from '../../components';
import { useLang } from '../../i18n';
import { ManagedNote } from './ManagedNote';

/** Approval signal sent to the popup from the mock OAuth portal. */
interface OAuthMockMessage {
  source: 'kiba-oauth';
  status: 'success';
}

function isOAuthMockMessage(data: unknown): data is OAuthMockMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === 'kiba-oauth' &&
    (data as { status?: unknown }).status === 'success'
  );
}

/** Generates a random 32-byte mock decryption key encoded as Base64. */
function generateMockKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

type ConnectStatus = 'idle' | 'connecting' | 'connected';

/** Card for connecting to Zenprax Cloud and triggering a policy sync. */
export function CloudSyncCard({ isManaged }: { isManaged: boolean }) {
  const t = useLang();
  const [status, setStatus] = useState<ConnectStatus>('idle');

  useEffect(() => {
    void chrome.storage.local.get('customPolicyId').then((v) => {
      if (typeof v.customPolicyId === 'string' && v.customPolicyId.length > 0) {
        setStatus('connected');
      }
    });
  }, []);

  function handleConnect() {
    if (isManaged) return;
    setStatus('connecting');

    const portal = window.open(
      chrome.runtime.getURL('oauth-mock.html'),
      'zenprax-cloud-auth',
      'width=440,height=620',
    );

    const onMessage = async (event: MessageEvent<unknown>) => {
      if (!isOAuthMockMessage(event.data)) return;
      window.removeEventListener('message', onMessage);

      // Auth success signal received -> auto-generate and save the ID/key, then sync immediately.
      const customPolicyId = crypto.randomUUID();
      const decryptionKey = generateMockKey();
      await chrome.storage.local.set({ customPolicyId, decryptionKey });
      await sendKibaMessage({ kind: 'kiba:request-sync' });
      setStatus('connected');
    };

    window.addEventListener('message', onMessage);

    // Watch for the portal being cancelled/closed in order to revert to idle.
    if (portal) {
      const timer = window.setInterval(() => {
        if (portal.closed) {
          window.clearInterval(timer);
          window.removeEventListener('message', onMessage);
          setStatus((prev) => (prev === 'connecting' ? 'idle' : prev));
        }
      }, 500);
    }
  }

  const connected = status === 'connected';
  const connecting = status === 'connecting';

  return (
    <Card>
      <div className="flex items-center gap-zp-2">
        <Cloud className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
        <div className="text-zp-base font-semibold">{t.settings.cloudSync}</div>
      </div>
      <div className="mt-zp-1 text-zp-md text-text-muted">
        {connected ? t.settings.connectedDesc : t.settings.cloudSyncDesc}
      </div>

      {connected && (
        <div className="mt-zp-3 flex items-center gap-zp-2 rounded-zp-lg bg-bg-base/60 px-zp-3 py-zp-2 text-zp-md font-semibold text-status-warn-text">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
          <span className="text-text-primary">{t.settings.connected}</span>
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={isManaged || connecting}
        className="mt-zp-3 flex w-full items-center justify-center gap-zp-2 rounded-zp-lg bg-brand-hover px-zp-3 py-zp-2 text-zp-base font-semibold text-text-on-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <KeyRound className="h-4 w-4" aria-hidden />
        {connecting
          ? t.settings.connecting
          : connected
            ? t.settings.reconnectButton
            : t.settings.connectButton}
      </button>

      {isManaged && <ManagedNote text={t.settings.managedNote} />}
    </Card>
  );
}
