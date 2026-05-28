# kickflow-discord-bot

Markdown テンプレートに記入した行事許可願の内容を Discord bot 経由で送信し、
kickflow の REST API を使ってチケットを自動作成するツールです。

## 仕組み

```
md テンプレに記入
      │
      ▼
Discord bot がメッセージ / 添付 md を受信
      │
      ├─ md をパース（キー: 値 を抽出）
      ├─ プルダウン等の「名前」を kickflow のマスタ ID に変換
      │
      ▼
kickflow REST API（チケット作成）を呼び出し
      │
      ▼
kickflow 上にチケットが作成される
```

ポイントは送信の向きです。bot が kickflow に「チケットを作って」と命令を出すので、
使うのは **REST API**（外部 → kickflow）であって、Webhook（kickflow → 外部）ではありません。
Webhook は承認結果などを後から Discord に通知したくなった場合に追加する想定です。

## 必要なもの

### kickflow 側
- 管理者によるアクセストークンの発行
- 対象ワークフロー「行事許可願」の `workflowId`
- 申請者チームの `authorTeamId`
- 各フォームフィールドの `code`
  （クラブ名・行事の種類・行事名・行事内容 など）
- プルダウン / マスタ参照項目の選択肢 ID
  （「クラブ名」「行事の種類」は自由テキストではなくマスタ参照のため、
  名前 → ID の変換テーブルが必要）

### 実行環境
- Node.js 18 以上（または Python 3.10 以上）
- Discord bot トークン
- kickflow アクセストークン

## セットアップ

```bash
git clone https://github.com/<your-account>/kickflow-discord-bot.git
cd kickflow-discord-bot
cp .env.example .env   # トークン類を記入
npm install            # または: pip install -r requirements.txt
```

### .env の設定

```env
DISCORD_BOT_TOKEN=xxxxxxxxxxxxxxxx
KICKFLOW_ACCESS_TOKEN=xxxxxxxxxxxxxxxx
KICKFLOW_API_BASE_URL=https://api.kickflow.com/v1
KICKFLOW_WORKFLOW_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
KICKFLOW_AUTHOR_TEAM_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> アクセストークンや bot トークンは秘密情報です。`.env` は必ず `.gitignore` に含め、
> GitHub にコミットしないでください。

## md テンプレート

`templates/event-request.md` をコピーして記入します。
パースしやすいよう「キー: 値」の形式を固定しています。

```md
# 行事許可願

クラブ名: サッカー部
行事の種類: 試合
行事名: 〇〇大会
行事内容: 〇〇との練習試合。会場は△△グラウンド。
```

| キー | kickflow フィールド | 形式 | 備考 |
| --- | --- | --- | --- |
| クラブ名 | （要 `code` 確認） | マスタ参照 | 名前 → ID 変換が必要・必須 |
| 行事の種類 | （要 `code` 確認） | プルダウン | 名前 → ID 変換が必要・必須 |
| 行事名 | （要 `code` 確認） | テキスト（短文） | 必須・試合の場合は正式大会名 |
| 行事内容 | （要 `code` 確認） | テキスト（長文） | 必須 |

## 使い方

Discord で対象チャンネルに以下を投稿します（実装方式は選択）。

- スラッシュコマンド方式: `/行事許可 add` で md の貼り付けを促す
- 添付ファイル方式: 記入済みの `.md` を添付して投稿する

bot が内容をパースして kickflow にチケットを作成し、結果（チケット番号や URL）を返信します。

## 名前 → ID 変換テーブル

マスタ参照・プルダウン項目は、表示名のままでは API に渡せません。
`config/field-map.json` に対応表を用意します。

```json
{
  "クラブ名": {
    "サッカー部": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "野球部": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
  },
  "行事の種類": {
    "試合": "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz",
    "練習": "wwwwwwww-wwww-wwww-wwww-wwwwwwwwwwww"
  }
}
```

ID は kickflow のワークフロー管理画面、または REST API のフォームフィールド取得で確認できます。

## API リクエストの例

チケット作成 API に送るリクエストボディの概形です。
`inputs` には自動計算フィールドを含む全フィールドを指定する必要がある点に注意してください
（値がないものは `null` を指定）。

```json
{
  "workflowId": "...",
  "authorTeamId": "...",
  "inputs": [
    { "formFieldCode": "club_name",   "value": "<マスタID>" },
    { "formFieldCode": "event_type",  "value": "<選択肢ID>" },
    { "formFieldCode": "event_name",  "value": "〇〇大会" },
    { "formFieldCode": "event_detail","value": "..." }
  ]
}
```

> 実際のフィールド名（`formFieldCode` か `formFieldId` か）やボディ構造は
> kickflow Developer ドキュメントの最新仕様に合わせてください。

## ロードマップ

- [ ] md パーサーの実装
- [ ] 名前 → ID 変換テーブルの整備
- [ ] kickflow チケット作成 API 連携
- [ ] Discord への結果返信
- [ ] （任意）Webhook 受信で承認結果を Discord 通知

## 参考

- kickflow Developer ドキュメント: https://developer.kickflow.com/
- REST API の使い方（ヘルプ）: https://support.kickflow.com/

## 注意事項

- アクセストークン・bot トークンは絶対にリポジトリにコミットしない。
- API トークンの発行や対象ワークフローへのアクセスには kickflow の権限設定が必要。
- フォーム項目の `code` や選択肢 ID は環境ごとに異なるため、導入時に必ず確認する。
