import { createContext, useContext } from 'react';

export type Lang = 'ja' | 'en';

export const JA: Translations = {
  status: { protected: '保護中', paused: '一時停止中' },
  tabs: {
    dashboard: 'ダッシュボード',
    filter: 'フィルター',
    antiClickFix: 'Anti-ClickFix',
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
    bypassDomain: '対象ドメイン',
    bypassExpiry: (mins: number) => `残り約 ${mins} 分`,
    bypassRevoke: '取り消す',
    networkFilter: 'Threat Intelligence Filter',
    networkFilterDesc: '脅威インテリジェンスに基づくネットワークフィルタリング',
    quickActions: {
      title: 'このサイトを操作',
      desc: '現在開いているサイトをワンクリックで許可／ブロックリストに追加します。',
      currentSite: '現在のサイト',
      block: 'ブロック',
      allow: '許可',
      noActiveTab: '対象のタブを取得できません。',
    },
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
    chart: { title: 'イベント内訳', noData: '集計するイベントがありません。' },
  },
  download: {
    title: 'ダウンロード制御',
    desc: '未承認ドメインからのダウンロードを一時停止し、承認フローに乗せます。',
    enable: 'Download Gater を有効化',
    enableDesc: '未承認ドメインからのダウンロードを一時停止して確認します。',
    allowlistTitle: '許可ドメイン',
    allowlistDesc: 'これらのドメインからのダウンロードは無条件で許可します。',
    allowlistPlaceholder: 'files.example.com',
  },
  screenShare: {
    title: '画面共有の監査',
    desc: '画面共有（getDisplayMedia）の要求を監査ログに記録します。共有自体はブロックしません。',
    enable: '画面共有の監査を有効化',
    enableDesc: '画面共有が要求された際に監査ログへ記録します。',
  },
  settings: {
    themeTitle: 'カラーテーマ',
    langTitle: '表示言語',
    cloudSync: 'クラウド同期設定',
    cloudSyncDesc: 'ボタン1つで ZENPRAX Cloud に安全に接続し、ポリシーと復号鍵を自動同期します。',
    connectButton: 'ZENPRAX Cloud に接続する',
    connecting: '接続中…',
    connected: '接続済み',
    connectedDesc: 'クラウド同期が有効です。ポリシーは自動的に最新化されます。',
    reconnectButton: '再接続する',
    managedNote: '組織ポリシーにより読み取り専用です。',
    featureModesTitle: '機能別の実施モード',
    featureModesDesc:
      '機能ごとに ENFORCE（実ブロック）／DRY_RUN（記録のみ）を選べます。未指定の機能は全体設定に従います。',
    globalMode: '全体設定',
    enforce: 'ENFORCE',
    dryRun: 'DRY_RUN',
    featurePaste: 'ペースト検知',
    featureFile: 'ファイルアップロード',
    featureTenant: 'テナント制限・マスク',
    featureDownload: 'ダウンロード制御',
    useGlobal: '全体設定に従う',
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
  filter: {
    title: 'Threat Intelligence Filter',
    blockTitle: 'ブロックドメイン',
    blockDesc: '指定したドメインへのリクエストをブロックします。',
    blockPlaceholder: 'evil.com',
    allowTitle: '除外ドメイン（ホワイトリスト）',
    allowDesc: 'ブロックルールから除外するドメインを登録します。',
    allowPlaceholder: 'trusted.example.com',
    addButton: '追加',
    removeAriaLabel: 'エントリを削除',
    managedNote: '組織ポリシーにより読み取り専用です。',
    noEntries: '未登録',
    domainLabel: 'ドメイン',
  },
  antiClickFix: {
    title: 'Anti-ClickFix 検知パターン',
    desc: '以下のパターンを含む貼り付けテキストはブロックされます。これらのパターンはシステムに組み込まれており変更できません。',
    patterns: [
      'PowerShell / pwsh',
      'cmd.exe / mshta',
      'Invoke-WebRequest',
      'Invoke-Expression / iex()',
      'curl … | sh/bash',
      'wget … | sh/bash',
      'bash -c',
      '/bin/bash / /bin/sh',
    ],
    customTitle: '組織配信のカスタムパターン',
    customDesc: '管理ポリシーで追加配信された検知パターンです。',
    noCustom: 'カスタムパターンはありません。',
  },
  managed: '組織のポリシーで管理されています',
  managedTooltip: '管理者ポリシーにより設定は読み取り専用です。',
} as const;

export type Translations = {
  status: { protected: string; paused: string };
  tabs: { dashboard: string; filter: string; antiClickFix: string; sso: string; audit: string; settings: string };
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
    bypassDomain: string;
    bypassExpiry: (mins: number) => string;
    bypassRevoke: string;
    networkFilter: string;
    networkFilterDesc: string;
    quickActions: {
      title: string;
      desc: string;
      currentSite: string;
      block: string;
      allow: string;
      noActiveTab: string;
    };
  };
  sso: {
    title: string;
    synced: string;
    desc: string;
    notConfigured: string;
    noCredentials: string;
    countSynced: (n: number) => string;
  };
  audit: {
    title: string;
    events: string;
    noEvents: string;
    chart: { title: string; noData: string };
  };
  download: {
    title: string;
    desc: string;
    enable: string;
    enableDesc: string;
    allowlistTitle: string;
    allowlistDesc: string;
    allowlistPlaceholder: string;
  };
  screenShare: {
    title: string;
    desc: string;
    enable: string;
    enableDesc: string;
  };
  filter: {
    title: string;
    blockTitle: string;
    blockDesc: string;
    blockPlaceholder: string;
    allowTitle: string;
    allowDesc: string;
    allowPlaceholder: string;
    addButton: string;
    removeAriaLabel: string;
    managedNote: string;
    noEntries: string;
    domainLabel: string;
  };
  antiClickFix: {
    title: string;
    desc: string;
    patterns: string[];
    customTitle: string;
    customDesc: string;
    noCustom: string;
  };
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
    themeTitle: string;
    langTitle: string;
    cloudSync: string;
    cloudSyncDesc: string;
    connectButton: string;
    connecting: string;
    connected: string;
    connectedDesc: string;
    reconnectButton: string;
    managedNote: string;
    featureModesTitle: string;
    featureModesDesc: string;
    globalMode: string;
    enforce: string;
    dryRun: string;
    featurePaste: string;
    featureFile: string;
    featureTenant: string;
    featureDownload: string;
    useGlobal: string;
  };
  managed: string;
  managedTooltip: string;
};

export const EN: Translations = {
  status: { protected: 'Protected', paused: 'Paused' },
  tabs: {
    dashboard: 'Dashboard',
    filter: 'Filter',
    antiClickFix: 'Anti-ClickFix',
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
    bypassDomain: 'Domain',
    bypassExpiry: (mins: number) => `~${mins} min remaining`,
    bypassRevoke: 'Revoke',
    networkFilter: 'Threat Intelligence Filter',
    networkFilterDesc: 'Network filtering based on threat intelligence feeds',
    quickActions: {
      title: 'This Site',
      desc: 'Add the currently open site to the allow or block list in one click.',
      currentSite: 'Current site',
      block: 'Block',
      allow: 'Allow',
      noActiveTab: 'Could not read the active tab.',
    },
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
    chart: { title: 'Event Breakdown', noData: 'No events to chart yet.' },
  },
  download: {
    title: 'Download Control',
    desc: 'Pause downloads from unapproved domains and route them through an approval flow.',
    enable: 'Enable Download Gater',
    enableDesc: 'Pause downloads from unapproved domains for review.',
    allowlistTitle: 'Allowed Domains',
    allowlistDesc: 'Downloads from these domains are always allowed.',
    allowlistPlaceholder: 'files.example.com',
  },
  screenShare: {
    title: 'Screen Share Audit',
    desc: 'Record screen-share (getDisplayMedia) requests to the audit log. Sharing itself is not blocked.',
    enable: 'Enable Screen Share Audit',
    enableDesc: 'Log to the audit trail when a screen share is requested.',
  },
  settings: {
    themeTitle: 'Color Theme',
    langTitle: 'Display Language',
    cloudSync: 'Cloud Sync Settings',
    cloudSyncDesc:
      'Connect to ZENPRAX Cloud in one click to securely sync policies and your decryption key.',
    connectButton: 'Connect to ZENPRAX Cloud',
    connecting: 'Connecting…',
    connected: 'Connected',
    connectedDesc: 'Cloud sync is active. Policies refresh automatically.',
    reconnectButton: 'Reconnect',
    managedNote: 'Read-only under organization policy.',
    featureModesTitle: 'Per-Feature Enforcement',
    featureModesDesc:
      'Choose ENFORCE (real block) or DRY_RUN (log only) per feature. Features left unset follow the global setting.',
    globalMode: 'Global setting',
    enforce: 'ENFORCE',
    dryRun: 'DRY_RUN',
    featurePaste: 'Paste detection',
    featureFile: 'File upload',
    featureTenant: 'Tenant restriction & masking',
    featureDownload: 'Download control',
    useGlobal: 'Use global',
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
  filter: {
    title: 'Threat Intelligence Filter',
    blockTitle: 'Block Domains',
    blockDesc: 'Requests to these domains will be blocked.',
    blockPlaceholder: 'evil.com',
    allowTitle: 'Allowlist (Exceptions)',
    allowDesc: 'Domains exempted from all block rules.',
    allowPlaceholder: 'trusted.example.com',
    addButton: 'Add',
    removeAriaLabel: 'Remove entry',
    managedNote: 'Read-only under organization policy.',
    noEntries: 'None configured',
    domainLabel: 'Domain',
  },
  antiClickFix: {
    title: 'Anti-ClickFix Detection Patterns',
    desc: 'Paste text matching any of the following patterns is blocked. These patterns are built-in and cannot be modified.',
    patterns: [
      'PowerShell / pwsh',
      'cmd.exe / mshta',
      'Invoke-WebRequest',
      'Invoke-Expression / iex()',
      'curl … | sh/bash',
      'wget … | sh/bash',
      'bash -c',
      '/bin/bash / /bin/sh',
    ],
    customTitle: 'Org-Delivered Custom Patterns',
    customDesc: 'Detection patterns delivered by your administrator policy.',
    noCustom: 'No custom patterns.',
  },
  managed: 'Managed by your organization',
  managedTooltip: 'Settings are enforced by an administrator policy and are read-only on this device.',
};

export const LangContext = createContext<Translations>(JA);

export function useLang(): Translations {
  return useContext(LangContext);
}
