# kiba.crx

**Zenprax エッジブラウザセキュリティ** — ブラウザ（エッジ）でリスクを遮断し、暗号化されたネットワークトラフィックになる前に脅威をブロックする Manifest V3 Chrome 拡張機能です。

これは [`kiba_crx_spec.md`](./kiba_crx_spec.md) に基づいて構築された **MVP（フェーズ1）** の雛形です。

> English README is available here: [README.md](./README.md)

## 機能一覧

| # | 機能 | 実装 |
|---|------|------|
| 1 | **広告・悪意あるドメインのブロック** | `declarativeNetRequest` 静的ルールセット（[`rules/static_rules.json`](./rules/static_rules.json)） |
| 2 | **ClickFix対策ペーストサニタイザー** | コンテンツスクリプトのキャプチャフェーズで `paste` イベントを横断、悪意あるOSコマンドを [`src/lib/patterns.ts`](./src/lib/patterns.ts) で検出 |
| 3 | **ファイルアップロード制御** | ホワイトリスト外ドメインへのアップロード／ドロップを `chrome.storage.local` の擬似**ワンタイムバイパス**トークンで管理 |
| 4 | **エッジUI（ポップアップ）** | React + Tailwind ダッシュボード（[`src/popup/Popup.tsx`](./src/popup/Popup.tsx)）— トグル、統計、監査ログ |

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
│   ├── lib/
│   │   ├── patterns.ts      # ClickFix 検出用正規表現とヘルパー（ユニットテスト済）
│   │   ├── patterns.test.ts
│   │   └── storage.ts       # 型安全な chrome.storage.local ラッパー
│   ├── background/index.ts  # サービスワーカー（インストール時デフォルト設定、通知）
│   ├── content/
│   │   ├── index.ts         # ペースト・ファイル/ドロップ制御、オーバーレイのDOM注入
│   │   └── style.css        # オーバーレイ／モーダルのスタイル
│   └── popup/               # React ダッシュボード
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
- **ポップアップ:** ClickFix対策のトグル切り替え、バイパス許可操作を行い、監査ログがリアルタイムで更新されることを確認できます。

## MVPシミュレーションについての補足

- ファイルアップロードブロックはコンテンツスクリプトの**分離ワールド**で動作します。入力をリセットしてワークフローを制御しますが、元のファイル選択を再現することはできないため、バイパス後にユーザーが再度ファイルを選択する必要があります。これはMVPとして意図した仕様です。
- `clipboardRead` / `clipboardWrite` 権限は要求しません — `preventDefault()` によるペーストのブロックにクリップボードアクセスは不要です。

## ライセンス

Apache 2.0 — [LICENSE](./LICENSE) を参照してください。
