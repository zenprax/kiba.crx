# kiba.crx

**Zenprax エッジブラウザセキュリティ** — ブラウザ（エッジ）でリスクを遮断し、暗号化されたネットワークトラフィックになる前に脅威をブロックする Manifest V3 Chrome 拡張機能です。

これは完全スタンドアローンの **OSS版（フェーズ1）** であり、その背後にフェーズ2のエンタープライズ基盤（プル型同期・TTL認証）を雛形として備えています。

> English README is available here: [README.md](./README.md)

## 機能一覧

| # | 機能 | 実装 |
|---|------|------|
| 1 | **広告・悪意あるドメインのブロック** | `declarativeNetRequest` 静的ルールセット（[`rules/static_rules.json`](./rules/static_rules.json)） |
| 2 | **テナント制限** | SaaSのテナント／ワークスペース（Slack / Google / GitHub）を判別し、ホワイトリスト外（他社）テナントを制限コンテキストとして扱う（[`src/lib/tenantDetector.ts`](./src/lib/tenantDetector.ts), [`src/content/tenant.ts`](./src/content/tenant.ts)） |
| 3 | **ClickFix対策ペーストサニタイザー** | キャプチャフェーズで `paste` を横断し、危険なOSコマンドの検出＋制限コンテキストでの機密情報マスクを実施（[`src/lib/patterns.ts`](./src/lib/patterns.ts), [`src/content/pasteGuard.ts`](./src/content/pasteGuard.ts)） |
| 4 | **ファイルアップロード制御** | 制限コンテキストへのアップロード／ドロップを擬似**ワンタイムバイパス**トークンで管理（[`src/content/fileGater.ts`](./src/content/fileGater.ts)） |
| 5 | **擬似SSOオートフィル** | 共有アカウントの資格情報をログインフォームへ注入。DevTools起動を検知して平文持ち出しを抑止（[`src/content/ssoFiller.ts`](./src/content/ssoFiller.ts)） |
| 6 | **拡張機能監査（シャドーIT）** | バックグラウンドで `chrome.management` をスキャンし、リスクのある拡張機能（生成AI系など）をローカル監査ログに記録（[`src/background/auditor.ts`](./src/background/auditor.ts)） |
| 7 | **DRY_RUN モード** | `mode: DRY_RUN` のとき、ブロック動作は実行せず `[DRY_RUN]` タグ付き監査ログのみ生成。情シスの導入テスト用の安全弁（[`src/lib/dryRun.ts`](./src/lib/dryRun.ts)） |
| 8 | **エッジUI（ポップアップ）** | React + Tailwind のプラグイン型ダッシュボード。機能タブはトグルに連動して出現／消滅する（[`src/popup/Popup.tsx`](./src/popup/Popup.tsx)） |

## 技術スタック

- **TypeScript**（厳格モード、型安全）
- **Vite + CRXJS**（`@crxjs/vite-plugin`）— MV3 バンドルと HMR
- **React + Tailwind CSS** — ポップアップUI；インジェクション用オーバーレイにはスコープ付きプレーンCSS
- **Vitest** — ユニットテスト

## プロジェクト構成

```
kiba.crx/
├── src/
│   ├── manifest.ts          # MV3 マニフェスト（CRXJS defineManifest）
│   ├── types/index.ts       # 共有型定義とデフォルト値（KibaSettings, AuditLogEntry）
│   ├── lib/                 # DOM非依存・ユニットテスト可能なロジック
│   │   ├── patterns.ts      # ClickFix 検出＋機密情報マスク
│   │   ├── tenantDetector.ts# SaaS テナント／ワークスペース抽出
│   │   ├── ssoFiller.ts     # 資格情報マッチング＋ネイティブフォーム入力
│   │   ├── dryRun.ts        # DRY_RUN ヘルパー
│   │   └── storage.ts       # 型安全な chrome.storage.local ラッパー
│   ├── background/          # サービスワーカー
│   │   ├── index.ts         # 初期設定・通知・各機能の初期化
│   │   ├── auditor.ts       # chrome.management による拡張機能監査
│   │   ├── syncManager.ts   # プル型ポリシー同期の雛形（フェーズ2）
│   │   └── authHandler.ts   # TTL／オフライン・スタンドアローン制御（フェーズ2）
│   ├── content/             # 分離ワールドのプラグイン群（index.ts が統括）
│   │   ├── index.ts         # オーケストレータ（トグルに応じて各機能を起動／停止）
│   │   ├── tenant.ts        # 制限コンテキストの判定
│   │   ├── pasteGuard.ts    # ClickFix対策＋マスク
│   │   ├── fileGater.ts     # ファイルアップロード制御＋ワンタイムバイパス
│   │   ├── ssoFiller.ts     # 擬似SSOオートフィル
│   │   ├── overlay.ts       # オーバーレイ／モーダルのDOM注入
│   │   └── style.css        # オーバーレイ／モーダルのスタイル
│   └── popup/               # React ダッシュボード
│       ├── Popup.tsx        # プラグイン型タブルーター
│       └── tabs/            # Dashboard / SsoList / AuditLog パネル
├── rules/static_rules.json  # DNR 広告・フィッシングブロックルール
└── public/icons/            # 拡張機能アイコン（プレースホルダー）
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

- **ClickFix対策:** 任意のページで `powershell -c iex(...)` のようなコマンドをコピーして入力欄にペーストすると、ペーストがブロックされ警告オーバーレイが表示されます。通常のURLは正常にペーストできます。
- **ファイル制御:** ホワイトリスト外ドメイン（`zenprax.com` / `github.com` 以外）で `<input type="file">` からファイルを選択すると、リセットされ**ワンタイムバイパス**モーダルが表示されます。バイパスを許可すると単一使用トークンが発行され、次のアップロードのみ許可されてトークンは消費されます。
- **ポップアップ（プラグイン型UI）:** ClickFix対策のトグル切り替え、バイパス許可操作を行い、監査ログがリアルタイムで更新されることを確認できます。**擬似SSO**をオフにするとそのタブがポップアップから消え、オンにすると再び現れます。
- **DRY_RUN:** 設定で `mode: "DRY_RUN"` を指定して上記のペースト／ファイルテストを再実行すると、ブロックは行われず `[DRY_RUN]` タグ付きのエントリが監査ログに記録されます。

## MVPシミュレーションについての補足

- ファイルアップロードブロックはコンテンツスクリプトの**分離ワールド**で動作します。入力をリセットしてワークフローを制御しますが、元のファイル選択を再現することはできないため、バイパス後にユーザーが再度ファイルを選択する必要があります。これはMVPとして意図した仕様です。
- `clipboardRead` / `clipboardWrite` 権限は要求しません — `preventDefault()` によるペーストのブロックにクリップボードアクセスは不要です。

## API仕様

kiba.crx が通信するエンドポイントを透明性のために公開しています：

- [Kiba Policy Delivery API](https://zenprax.github.io/kiba.crx/) — OpenAPI仕様（GitHub Pages）

## ライセンス

Apache 2.0 — [LICENSE](./LICENSE) を参照してください。
