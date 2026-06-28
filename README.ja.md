# kiba.crx

**Zenprax エッジブラウザセキュリティ** — ブラウザ（エッジ）でリスクを遮断し、暗号化されたネットワークトラフィックになる前に脅威をブロックする Manifest V3 Chrome 拡張機能です。

これは完全スタンドアローンの **OSS版（フェーズ1）** であり、その背後にフェーズ2のエンタープライズ基盤（プル型同期・TTL認証）を雛形として備えています。

> English README is available here: [README.md](./README.md)

## 機能一覧

| # | 機能 | 実装 |
|---|------|------|
| 1 | **広告・悪意あるドメインのブロック** | `declarativeNetRequest` 静的ルールセット＋ユーザー管理のブロック/許可リスト（[`rules/static_rules.json`](./rules/static_rules.json), [`src/background/domainRules.ts`](./src/background/domainRules.ts)） |
| 2 | **テナント制限** | SaaSのテナント／ワークスペース（Slack / Google / GitHub）を判別し、ホワイトリスト外（他社）テナントを制限コンテキストとして扱う（[`src/lib/tenantDetector.ts`](./src/lib/tenantDetector.ts), [`src/content/tenant.ts`](./src/content/tenant.ts)） |
| 3 | **ClickFix対策ペーストサニタイザー** | キャプチャフェーズで `paste` を横断し、危険なOSコマンドの検出＋制限コンテキストでの機密情報マスクを実施（[`src/lib/patterns.ts`](./src/lib/patterns.ts), [`src/content/pasteGuard.ts`](./src/content/pasteGuard.ts)） |
| 4 | **ファイルアップロード制御** | 制限コンテキストへのアップロード／ドロップを擬似**ワンタイムバイパス**トークンで管理（[`src/content/fileGater.ts`](./src/content/fileGater.ts)） |
| 5 | **Download Gater** | `chrome.downloads` でダウンロードを傍受し、未承認のものをユーザー確認待ち状態で保留（[`src/background/downloadGater.ts`](./src/background/downloadGater.ts)） |
| 6 | **スクリーンシェア監査** | メインワールドで `getDisplayMedia` をパッチし、画面共有イベントを検出・記録（[`src/content/screenShareHook.ts`](./src/content/screenShareHook.ts), [`src/content/mainWorld/getDisplayMediaPatch.ts`](./src/content/mainWorld/getDisplayMediaPatch.ts)） |
| 7 | **擬似SSOオートフィル** | 共有アカウントの資格情報をログインフォームへ注入。DevTools起動を検知して平文持ち出しを抑止（[`src/content/ssoFiller.ts`](./src/content/ssoFiller.ts)） |
| 8 | **拡張機能監査（シャドーIT）** | バックグラウンドで `chrome.management` をスキャンし、リスクのある拡張機能（生成AI系など）をローカル監査ログに記録（[`src/background/auditor.ts`](./src/background/auditor.ts)） |
| 9 | **クイックアクション** | ダッシュボードから現在のアクティブタブのサイトをワンクリックで許可/ブロック（[`src/popup/tabs/Dashboard.tsx`](./src/popup/tabs/Dashboard.tsx)） |
| 10 | **監査チャート** | 監査ログイベントのカテゴリ別・時系列ビジュアル表示（[`src/popup/tabs/AuditChart.tsx`](./src/popup/tabs/AuditChart.tsx)） |
| 11 | **機能単位 DRY_RUN モード** | 各機能を個別に `ENFORCE` / `DRY_RUN` 設定でき、グローバルモードを上書き可能（[`src/lib/dryRun.ts`](./src/lib/dryRun.ts), [`src/popup/tabs/Settings.tsx`](./src/popup/tabs/Settings.tsx)） |
| 12 | **エッジUI（ポップアップ）** | React + Tailwind のプラグイン型ダッシュボード。機能タブはトグルに連動して出現／消滅する（[`src/popup/Popup.tsx`](./src/popup/Popup.tsx)） |

## 技術スタック

- **TypeScript**（厳格モード、型安全）
- **Vite + CRXJS**（`@crxjs/vite-plugin`）— MV3 バンドルと HMR
- **React + Tailwind CSS** — ポップアップUI；インジェクション用オーバーレイにはスコープ付きプレーンCSS
- **Vitest** — ユニットテスト

## プロジェクト構成

```
kiba.crx/
├── src/
│   ├── manifest.ts              # MV3 マニフェスト（CRXJS defineManifest）
│   ├── types/index.ts           # 共有型定義とデフォルト値（KibaSettings, AuditLogEntry）
│   ├── lib/                     # DOM非依存・ユニットテスト可能なロジック
│   │   ├── patterns.ts          # ClickFix 検出＋機密情報マスク
│   │   ├── tenantDetector.ts    # SaaS テナント／ワークスペース抽出
│   │   ├── tenantRules.ts       # プラガブルなテナントプロバイダ登録
│   │   ├── policyFilter.ts      # OTA ポリシーパターンフィルタリング
│   │   ├── policySchema.ts      # ポリシースキーマバリデーション
│   │   ├── ssoFiller.ts         # 資格情報マッチング＋ネイティブフォーム入力
│   │   ├── dryRun.ts            # 機能単位 DRY_RUN ヘルパー
│   │   ├── bypass.ts            # ワンタイムバイパストークンロジック
│   │   └── storage.ts           # 型安全な chrome.storage.local ラッパー
│   ├── background/              # サービスワーカー
│   │   ├── index.ts             # 初期設定・通知・各機能の初期化
│   │   ├── auditor.ts           # chrome.management による拡張機能監査
│   │   ├── downloadGater.ts     # ダウンロード傍受＋承認フロー
│   │   ├── domainRules.ts       # 動的 DNR ルール管理
│   │   ├── bypassManager.ts     # ワンタイムバイパストークン管理
│   │   ├── credentialBroker.ts  # SSO 資格情報ストレージブローカー
│   │   ├── syncManager.ts       # プル型ポリシー同期の雛形（フェーズ2）
│   │   └── authHandler.ts       # TTL／オフライン・スタンドアローン制御（フェーズ2）
│   ├── content/                 # 分離ワールドのプラグイン群（index.ts が統括）
│   │   ├── index.ts             # オーケストレータ（トグルに応じて各機能を起動／停止）
│   │   ├── tenant.ts            # 制限コンテキストの判定
│   │   ├── pasteGuard.ts        # ClickFix対策＋マスク
│   │   ├── fileGater.ts         # ファイルアップロード制御＋ワンタイムバイパス
│   │   ├── screenShareHook.ts   # スクリーンシェア監査（分離ワールド側）
│   │   ├── ssoFiller.ts         # 擬似SSOオートフィル
│   │   ├── overlay.tsx          # オーバーレイ／モーダル／トーストのDOM注入
│   │   ├── overlayStyles.ts     # オーバーレイスタイル定数
│   │   └── mainWorld/
│   │       └── getDisplayMediaPatch.ts  # getDisplayMedia パッチ（メインワールド）
│   └── popup/                   # React ダッシュボード
│       ├── Popup.tsx            # プラグイン型タブルーター
│       └── tabs/                # 各タブパネル
│           ├── Dashboard.tsx    # 機能トグル＋クイックアクション
│           ├── AuditLog.tsx     # 時系列監査イベントリスト
│           ├── AuditChart.tsx   # 監査イベントビジュアル表示
│           ├── AntiClickFixTab.tsx # ClickFix パターンチューニング
│           ├── FilterTab.tsx    # ユーザーブロック/許可ドメインリスト
│           ├── SsoList.tsx      # SSO 資格情報リスト
│           └── Settings.tsx     # グローバルモード・機能単位モード・クラウド同期
├── rules/static_rules.json      # DNR 広告・フィッシングブロックルール
└── public/icons/                # 拡張機能アイコン（プレースホルダー）
```

## はじめかた

```bash
npm install
npm run dev      # CRXJS HMR つきの Vite 開発サーバー起動
npm run build    # 型チェック + 本番ビルド → dist/
npm test         # Vitest ユニットテストの実行
```

### 拡張機能の読み込み

1. `npm run build` を実行
2. `chrome://extensions`（または `edge://extensions`、`brave://extensions`）を開く
3. **デベロッパーモード** を有効にする
4. **パッケージ化されていない拡張機能を読み込む** をクリックし、`dist/` ディレクトリを選択

> 開発中は `npm run dev` 実行後に `dist/` を読み込むことでライブHMRが使えます。

## 手動動作確認

- **ClickFix対策:** 任意のページで `powershell -c iex(...)` のようなコマンドをコピーして入力欄にペーストすると、ペーストがブロックされ警告オーバーレイが表示されます。
- **ファイル制御:** ホワイトリスト外ドメインで `<input type="file">` からファイルを選択すると、リセットされ**ワンタイムバイパス**モーダルが表示されます。
- **Download Gater:** 制限ドメインでファイルダウンロードを開始すると、承認待ちで保留され確認トーストが表示されます。
- **スクリーンシェア監査:** 任意のページで画面共有（`getDisplayMedia`）を開始すると、イベントが捕捉されて監査エントリが作成されます。
- **クイックアクション:** 任意のページでポップアップを開き、クイックアクションカードで現在のサイトを即時許可またはブロックできます。
- **ポップアップ（プラグイン型UI）:** 各トグル操作・バイパス許可を行い、監査ログとチャートがリアルタイムで更新されることを確認できます。
- **DRY_RUN:** 設定タブでグローバルまたは機能単位の `DRY_RUN` モードを設定すると、ブロックは行われず `[DRY_RUN]` タグ付きのエントリが監査ログに記録されます。

## MVPシミュレーションについての補足

- ファイルアップロードブロックはコンテンツスクリプトの**分離ワールド**で動作します。入力をリセットしてワークフローを制御しますが、元のファイル選択を再現することはできないため、バイパス後にユーザーが再度ファイルを選択する必要があります。これはMVPとして意図した仕様です。
- `clipboardRead` / `clipboardWrite` 権限は要求しません — `preventDefault()` によるペーストのブロックにクリップボードアクセスは不要です。
- スクリーンシェアのパッチは**メインワールド**にスクリプトを注入し、ページが呼び出す前に `navigator.mediaDevices.getDisplayMedia` を横断します。

## API仕様

kiba.crx が通信するエンドポイントを透明性のために公開しています：

- [Kiba Policy Delivery API](https://zenprax.github.io/kiba.crx/) — OpenAPI仕様（GitHub Pages）

## ライセンス

Apache 2.0 — [LICENSE](./LICENSE) を参照してください。
