# kickflow-discord-bot 設計書

Markdown テンプレートに記入した「行事許可願」の内容を Discord bot 経由で送信し、
kickflow の REST API でチケットを自動作成するシステムの設計書です。
本書をもとに実装を進めます。

---

## 0. 前提とブロッカー（最初に必ず確認）

### ⚠ ブロッカー: アクセストークン未確認

現状、kickflow のアクセストークン発行可否が「未確認」です。
**これが解決しないと kickflow へのチケット作成は一切できません。**
実装は進められますが、結合テスト・本番投入の前に必ず以下のいずれかを確保してください。

| 方法 | 必要権限 | 用途 |
| --- | --- | --- |
| アクセストークン | 管理者がトークンを発行 | 個人や1つの bot で運用する最小構成 |
| サービスアカウント | 管理者がサービスアカウント作成 | bot が複数ユーザーになりすまして申請する場合 |

トークンは kickflow 管理画面の「外部連携 → REST API」から発行します。
発行できる権限がない場合は、kickflow 管理者へ依頼する必要があります。

> この設計書はトークン取得済みを前提に書いていますが、未取得でも
> パーサーや変換テーブルなど API に依存しない部分から実装を開始できます。

### 確定した方針

- 実装言語: **Node.js + TypeScript**（kickflow 公式例が JS、discord.js が成熟）
- md 受信方式: **.md ファイル添付**
- kickflow API ベース URL: `https://api.kickflow.com/v1`

---

## 1. システム全体像

```
┌──────────────┐   1. .md添付で投稿    ┌─────────────────────────┐
│   ユーザー    │ ───────────────────▶ │      Discord            │
└──────────────┘                       └───────────┬─────────────┘
                                                    │ 2. messageCreate イベント
                                                    ▼
                                        ┌─────────────────────────┐
                                        │   Discord Bot (本体)     │
                                        │  ┌───────────────────┐  │
                                        │  │ md ダウンロード     │  │
                                        │  │ md パーサー         │  │
                                        │  │ バリデーション      │  │
                                        │  │ 名前→ID 変換        │  │
                                        │  │ ペイロード生成      │  │
                                        │  └─────────┬─────────┘  │
                                        └────────────┼────────────┘
                                                     │ 3. POST /tickets
                                                     ▼
                                        ┌─────────────────────────┐
                                        │   kickflow REST API      │
                                        │  チケット作成            │
                                        └────────────┬────────────┘
                                                     │ 4. 作成結果（番号/URL）
                                                     ▼
                                        ┌─────────────────────────┐
                                        │   Discord に返信         │
                                        └─────────────────────────┘
```

送信の向きは bot → kickflow（REST API）です。Webhook（kickflow → 外部）は本機能では使いません。

---

## 2. 処理フロー（詳細）

1. ユーザーが対象チャンネルに `.md` ファイルを添付して投稿する。
2. bot が `messageCreate` を受信し、添付が `.md` か判定する。`.md` 以外は無視。
3. 添付ファイルの URL からテキストをダウンロードする。
4. md パーサーが「キー: 値」を抽出し、中間オブジェクトに変換する。
5. バリデーション: 必須項目の欠落・未知のキー・空値をチェック。
   - 不備があればこの時点で Discord に**エラー内容を返信して終了**（API は呼ばない）。
6. 名前 → ID 変換: マスタ参照/プルダウン項目を `field-map.json` で ID に変換。
   - 変換表にない選択肢ならエラー返信して終了。
7. kickflow チケット作成ペイロードを生成する。
8. `POST /v1/tickets` を実行する。
9. 成功: チケット番号・URL を整形して Discord に返信。
   失敗: ステータスコードとエラーメッセージを Discord に返信。

---

## 3. ディレクトリ構成

```
kickflow-discord-bot/
├── src/
│   ├── index.ts                # エントリポイント。Discord クライアント起動
│   ├── config.ts               # 環境変数の読み込みと検証
│   ├── discord/
│   │   ├── client.ts           # discord.js クライアント生成
│   │   └── handlers.ts         # messageCreate ハンドラ
│   ├── parser/
│   │   ├── mdParser.ts         # md → 中間オブジェクト
│   │   └── types.ts            # パース結果の型
│   ├── kickflow/
│   │   ├── apiClient.ts        # kickflow REST クライアント（fetch ラッパ）
│   │   ├── ticketBuilder.ts    # 中間オブジェクト → API ペイロード
│   │   └── types.ts            # kickflow API の型定義
│   ├── mapping/
│   │   ├── fieldMap.ts         # field-map.json の読み込みと変換ロジック
│   │   └── validator.ts        # 必須・型・選択肢バリデーション
│   └── utils/
│       └── logger.ts
├── config/
│   ├── field-map.json          # 名前 → kickflow ID の変換テーブル
│   └── form-schema.json        # フォーム項目定義（必須・型・code）
├── templates/
│   └── event-request.md        # 記入用テンプレート
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## 4. md テンプレート仕様

### テンプレート（`templates/event-request.md`）

```md
# 行事許可願

クラブ名: サッカー部
行事の種類: 試合
行事名: 〇〇大会
行事内容: 〇〇高校との練習試合。会場は△△グラウンド。
```

### パース規則

- 1 行目の `# ` 見出しはタイトル種別の確認に使う（任意）。
- 本文は `キー: 値`（全角コロン `：` も許容）の形式。
- キーの前後の空白は除去する。
- 値が複数行にわたる場合は、次のキー行が現れるまでを 1 つの値として連結する。
- `#` で始まるコメント行、空行は無視する。
- 想定外のキーは「未知のキー」としてバリデーションで警告する。

### パース結果の中間オブジェクト

```ts
interface ParsedForm {
  titleType?: string;            // 見出し（"行事許可願" など）
  fields: Record<string, string>; // 例: { "クラブ名": "サッカー部", ... }
}
```

---

## 5. フォーム項目定義（`config/form-schema.json`）

画像のフォームに基づく定義。`code` は **kickflow 管理画面で実際の値を確認して埋める**（下記は仮）。

| 表示名 | code（要確認） | 型 | 必須 | 入力方法 |
| --- | --- | --- | --- | --- |
| クラブ名 | `club_name` | マスタ参照 | ✓ | 名前→ID 変換が必要 |
| 行事の種類 | `event_type` | プルダウン | ✓ | 名前→ID 変換が必要 |
| 行事名 | `event_name` | text | ✓ | テキスト（短文） |
| 行事内容 | `event_detail` | text_long | ✓ | テキスト（長文） |

```json
{
  "fields": [
    { "label": "クラブ名",   "code": "club_name",    "type": "master",   "required": true },
    { "label": "行事の種類", "code": "event_type",   "type": "select",   "required": true },
    { "label": "行事名",     "code": "event_name",   "type": "text",     "required": true },
    { "label": "行事内容",   "code": "event_detail", "type": "text_long","required": true }
  ]
}
```

> kickflow ではワークフロー編集のたびにフォームの `id` が変わるが、`code` は不変。
> そのため本システムは一貫して `code`（`formFieldCode`）でフィールドを指定する。

---

## 6. 名前 → ID 変換テーブル（`config/field-map.json`）

マスタ参照・プルダウン項目は表示名のまま API に渡せず、選択肢の ID が必要。

```json
{
  "club_name": {
    "サッカー部": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "野球部":     "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
  },
  "event_type": {
    "試合": "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz",
    "練習": "wwwwwwww-wwww-wwww-wwww-wwwwwwwwwwww"
  }
}
```

ID の取得元: kickflow のワークフロー管理画面、または REST API のフォームフィールド/マスタ取得。
変換表に存在しない選択肢が来た場合はエラーとして処理を止める（誤った ID で作成させない）。

---

## 7. kickflow API 連携

### 7.1 チケット作成リクエスト

`POST https://api.kickflow.com/v1/tickets`

ヘッダ:
```
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

リクエストボディ:
```json
{
  "status": "in_progress",
  "workflowId": "<WORKFLOW_ID>",
  "authorTeamId": "<AUTHOR_TEAM_ID>",
  "title": "情報学部自治会に関する行事許可願",
  "inputs": [
    { "formFieldCode": "club_name",    "value": "<マスタID>" },
    { "formFieldCode": "event_type",   "value": "<選択肢ID>" },
    { "formFieldCode": "event_name",   "value": "〇〇大会" },
    { "formFieldCode": "event_detail", "value": "〇〇高校との練習試合。会場は△△グラウンド。" }
  ]
}
```

- `status`: `draft`（下書き）または `in_progress`（申請開始）。初期は `draft` 推奨（誤申請防止）。
- `inputs` は各フィールドを `formFieldCode` で指定。
- **自動計算フィールドがある場合は全フィールドを inputs に含める必要がある**（値は `null` 可）。
- ファイル添付フィールドを使う場合は `value` ではなく `files: [signedId]`
  （※添付ファイルアップロード API はエンタープライズプランのみ。現状は使わない設計）。

### 7.2 レスポンス処理

成功時のレスポンスからチケット番号（`ticketNumber`）と URL を取り出して返信に使う。
`ticketNumber` は nullable（採番タイミング設定による）なので、null の場合は ID で代替する。

### 7.3 API クライアント設計（`apiClient.ts`）

```ts
class KickflowClient {
  constructor(private baseUrl: string, private token: string) {}

  async createTicket(payload: CreateTicketPayload): Promise<TicketResponse> {
    const res = await fetch(`${this.baseUrl}/tickets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new KickflowApiError(res.status, err.message ?? res.statusText);
    }
    return res.json();
  }
}
```

---

## 8. バリデーション仕様

順に実行し、最初に失敗した時点でエラー返信して終了する。

1. **添付チェック**: `.md` が添付されているか。
2. **パースチェック**: 「キー: 値」形式として解釈できる行があるか。
3. **必須チェック**: `form-schema.json` の `required: true` がすべて埋まっているか。
4. **未知キーチェック**: schema に存在しないキーがないか（あれば警告し、無視 or 中断）。
5. **選択肢チェック**: マスタ/プルダウン項目の値が `field-map.json` に存在するか。

エラーメッセージ例（Discord 返信）:
```
❌ 申請を作成できませんでした。
- 「行事名」が未入力です（必須）
- 「クラブ名」の "テニス部" は登録されていません
修正して再度 .md を添付してください。
```

---

## 9. 環境変数（`.env.example`）

```env
DISCORD_BOT_TOKEN=
KICKFLOW_ACCESS_TOKEN=
KICKFLOW_API_BASE_URL=https://api.kickflow.com/v1
KICKFLOW_WORKFLOW_ID=
KICKFLOW_AUTHOR_TEAM_ID=
ALLOWED_CHANNEL_ID=          # bot が反応するチャンネルを限定（任意）
TICKET_DEFAULT_STATUS=draft  # draft | in_progress
```

`config.ts` で起動時に必須変数の存在を検証し、欠落していれば即終了する。

---

## 10. エラーハンドリングと運用

| 区分 | 例 | 対応 |
| --- | --- | --- |
| 入力エラー | 必須欠落・未知選択肢 | Discord に具体的な内容を返信。API は呼ばない |
| 認証エラー | 401/403 | トークン失効・権限不足。管理者に確認を促すメッセージ |
| API エラー | 400/422 | ペイロード不備。ログにボディを残し、再現できるよう保存 |
| ネットワーク | タイムアウト | リトライ（最大2回、指数バックオフ）後に失敗返信 |

- ログには**トークンや個人情報を出力しない**。
- 誤申請防止のため、初期は `status: draft` で作成し、ユーザーが kickflow 上で内容確認後に申請開始する運用を推奨。

---

## 11. セキュリティ

- `.env`・`field-map.json`（ID を含む）は `.gitignore` 対象。`*.example` のみコミット。
- bot が反応するチャンネルを `ALLOWED_CHANNEL_ID` で限定し、無関係な投稿に反応しない。
- アクセストークンは環境変数のみで管理し、ソース・ログに残さない。

---

## 12. 実装ステップ（推奨順）

トークン未取得でも 1〜4 は進められます。

1. プロジェクト初期化（TypeScript / discord.js / 環境変数読み込み）
2. md パーサー実装 + 単体テスト
3. `form-schema.json` / バリデーション実装 + 単体テスト
4. `field-map.json` / 名前→ID 変換実装 + 単体テスト
5. **（要トークン）** kickflow API クライアント実装
6. **（要トークン）** ticketBuilder でペイロード生成 → 結合
7. Discord ハンドラ結合（添付受信 → 返信まで）
8. `draft` で実チケット作成のテスト → 確認後 `in_progress` 運用へ

---

## 13. 確認が必要な未確定項目

実装前または途中で kickflow 管理画面から取得・確定する必要があるもの。

- [ ] アクセストークン（または サービスアカウント）の発行【最優先・ブロッカー】
- [ ] `KICKFLOW_WORKFLOW_ID`（行事許可願ワークフローの ID）
- [ ] `KICKFLOW_AUTHOR_TEAM_ID`（申請者チームの ID）
- [ ] 各フォーム項目の正確な `code`
- [ ] クラブ名・行事の種類の選択肢 ID 一覧（変換表の中身）
- [ ] フォームに自動計算フィールドが含まれるか（含む場合は inputs に全項目必要）
- [ ] タイトルの自動生成ルール（"情報学部自治会//に関する行事許可願" の `//` 部分の扱い）

---

## 参考

- kickflow Developer: https://developer.kickflow.com/
- チケット作成・ファイル添付ガイド: https://developer.kickflow.com/guide/attchment/
- フォーム入力の取得（code 軸）: https://developer.kickflow.com/guide/ticketInput/
