/** Shape of a complete UI translation object. Adding a key here forces both JA and EN to supply it. */
export type Translations = {
  status: { protected: string; paused: string };
  tabs: {
    dashboard: string;
    filter: string;
    antiClickFix: string;
    sso: string;
    audit: string;
    settings: string;
  };
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
