import { createContext, useContext } from 'react';

export type Lang = 'ja' | 'en';

export const JA: Translations = {
  status: { protected: '保護中', paused: '一時停止中' },
  tabs: {
    dashboard: 'ダッシュボード',
    sso: 'SSO',
    audit: '監査ログ',
    settings: '設定',
  },
  dashboard: {
    itemsBlocked: 'ブロック件数',
    bypass: 'ワンタイム回避',
    armed: '有効',
    off: '無効',
    antiClickFix: 'Anti-ClickFix',
    antiClickFixDesc: '危険なOSコマンド貼り付けをブロック',
    masking: 'Confidential Masking',
    maskingDesc: '外部テナントへの貼り付け時に機密情報をマスク',
    sso: 'Pseudo-SSO Autofill',
    ssoDesc: '共有アカウントの非表示自動入力',
    trustedTenants: '信頼テナント',
    entries: '件',
    noTenants: '信頼テナントが未設定です。',
    bypassTitle: 'ワンタイム Upload 回避',
    bypassDesc: '制限ドメインへの単回アップロード例外を申請します。承認は管理コンソール経由です。',
    bypassArmed: '回避有効中 — 1回アップロードで消費',
    bypassRequest: 'ワンタイム回避を申請',
    networkFilter: 'Threat Intelligence Filter',
    networkFilterDesc: '脅威インテリジェンスに基づくネットワークフィルタリング',
  },
  sso: {
    title: '共有認証情報',
    synced: '件同期済み',
    desc: '認証情報はbackgroundのメモリにのみ保持され、ここには表示されません。',
    notConfigured: 'コンソール未設定。SSO自動入力は無効です。',
    noCredentials: '認証情報未同期（オンライン同期が必要）。',
    countSynced: (n: number) => `コンソールから ${n} 件の共有認証情報を同期済み。`,
  },
  audit: {
    title: '監査ログ',
    events: '件',
    noEvents: 'セキュリティイベントはまだ記録されていません。',
  },
  settings: {
    langTitle: '表示言語',
    cloudSync: 'クラウド同期設定',
    cloudSyncDesc: 'Zenprax Cloud発行のPolicy IDと復号鍵（BYOK）を入力して同期します。',
    policyIdLabel: 'Policy ID (UUID)',
    decryptionKeyLabel: 'Decryption Key (BYOK · Base64)',
  },
  tenantManager: {
    title: '信頼テナントの管理',
    addButton: '追加',
    providerLabel: 'プロバイダ',
    tenantIdLabel: 'テナント ID',
    tenantIdPlaceholder: 'T0XXXXXXX',
    labelLabel: 'ラベル',
    labelPlaceholder: '例: 自社 Slack',
    removeAriaLabel: 'エントリを削除',
    managedNote: '組織ポリシーにより読み取り専用です。',
  },
  managed: '組織のポリシーで管理されています',
  managedTooltip: '管理者ポリシーにより設定は読み取り専用です。',
} as const;

export type Translations = {
  status: { protected: string; paused: string };
  tabs: { dashboard: string; sso: string; audit: string; settings: string };
  dashboard: {
    itemsBlocked: string;
    bypass: string;
    armed: string;
    off: string;
    antiClickFix: string;
    antiClickFixDesc: string;
    masking: string;
    maskingDesc: string;
    sso: string;
    ssoDesc: string;
    trustedTenants: string;
    entries: string;
    noTenants: string;
    bypassTitle: string;
    bypassDesc: string;
    bypassArmed: string;
    bypassRequest: string;
    networkFilter: string;
    networkFilterDesc: string;
  };
  sso: {
    title: string;
    synced: string;
    desc: string;
    notConfigured: string;
    noCredentials: string;
    countSynced: (n: number) => string;
  };
  audit: { title: string; events: string; noEvents: string };
  tenantManager: {
    title: string;
    addButton: string;
    providerLabel: string;
    tenantIdLabel: string;
    tenantIdPlaceholder: string;
    labelLabel: string;
    labelPlaceholder: string;
    removeAriaLabel: string;
    managedNote: string;
  };
  settings: {
    langTitle: string;
    cloudSync: string;
    cloudSyncDesc: string;
    policyIdLabel: string;
    decryptionKeyLabel: string;
  };
  managed: string;
  managedTooltip: string;
};

export const EN: Translations = {
  status: { protected: 'Protected', paused: 'Paused' },
  tabs: {
    dashboard: 'Dashboard',
    sso: 'SSO',
    audit: 'Audit',
    settings: 'Settings',
  },
  dashboard: {
    itemsBlocked: 'Items Blocked',
    bypass: 'One-Time Bypass',
    armed: 'Armed',
    off: 'Off',
    antiClickFix: 'Anti-ClickFix',
    antiClickFixDesc: 'Block dangerous OS-command pastes',
    masking: 'Confidential Masking',
    maskingDesc: 'Mask secrets on foreign-tenant pastes',
    sso: 'Pseudo-SSO Autofill',
    ssoDesc: 'Hidden autofill for shared accounts',
    trustedTenants: 'Trusted Tenants',
    entries: 'entries',
    noTenants: 'No trusted tenants configured.',
    bypassTitle: 'One-Time Upload Bypass',
    bypassDesc:
      'Request a single-use upload exception for restricted domains. Approval is mediated by the admin console.',
    bypassArmed: 'Bypass Armed — use one upload',
    bypassRequest: 'Request One-Time Bypass',
    networkFilter: 'Threat Intelligence Filter',
    networkFilterDesc: 'Network filtering based on threat intelligence feeds',
  },
  sso: {
    title: 'Shared Credentials',
    synced: 'synced',
    desc: 'Credentials are managed by the admin console and held only in memory by the extension background. They are never stored or shown here.',
    notConfigured: 'Console not configured. SSO autofill is inactive.',
    noCredentials: 'No credentials synced yet (online sync required).',
    countSynced: (n: number) =>
      `${n} shared credential${n === 1 ? '' : 's'} synced from console.`,
  },
  audit: {
    title: 'Audit Log',
    events: 'events',
    noEvents: 'No security events recorded yet.',
  },
  settings: {
    langTitle: 'Display Language',
    cloudSync: 'Cloud Sync Settings',
    cloudSyncDesc:
      'Enter the Policy ID and decryption key (BYOK) issued by Zenprax Cloud to sync.',
    policyIdLabel: 'Policy ID (UUID)',
    decryptionKeyLabel: 'Decryption Key (BYOK · Base64)',
  },
  tenantManager: {
    title: 'Manage Trusted Tenants',
    addButton: 'Add',
    providerLabel: 'Provider',
    tenantIdLabel: 'Tenant ID',
    tenantIdPlaceholder: 'T0XXXXXXX',
    labelLabel: 'Label',
    labelPlaceholder: 'e.g. My Slack',
    removeAriaLabel: 'Remove entry',
    managedNote: 'Read-only under organization policy.',
  },
  managed: 'Managed by your organization',
  managedTooltip: 'Settings are enforced by an administrator policy and are read-only on this device.',
};

export const LangContext = createContext<Translations>(JA);

export function useLang(): Translations {
  return useContext(LangContext);
}
