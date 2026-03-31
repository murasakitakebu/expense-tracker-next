# 経費精算システム / Expense Tracker

レシート写真をAIで自動解析し、Excel/CSV出力できる経費精算Webアプリです。

## フォルダ構成

```
expense-tracker/
├── netlify.toml                  # Netlify設定
├── public/
│   └── index.html                # フロントエンド
└── netlify/
    └── functions/
        └── analyze.js            # サーバーレス関数（APIキーを安全に保持）
```

## デプロイ手順（GitHub Pages → Netlify に変更）

> ⚠️ このアプリはサーバーレス関数（Netlify Functions）を使うため、
> **GitHub Pages では動きません。Netlify を使ってください。**

### 1. GitHubにリポジトリを作成してアップロード

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/expense-tracker.git
git push -u origin main
```

### 2. Netlifyでデプロイ

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**
2. GitHubを連携 → 作成したリポジトリを選択
3. Build settings はそのまま（netlify.tomlが自動で読まれます）
4. **Deploy site** をクリック

### 3. APIキーを環境変数に設定（重要）

1. Netlify管理画面 → **Site configuration → Environment variables**
2. **Add a variable** をクリック
3. Key: `ANTHROPIC_API_KEY`
4. Value: `sk-ant-xxxxxxxxxxxx`（AnthropicのAPIキー）
5. **Save**
6. **Deploys → Trigger deploy → Deploy site** で再デプロイ

### 4. 完成 🎉

`https://あなたのサイト名.netlify.app` でアクセス可能になります。

## Anthropic APIキーの取得

1. [console.anthropic.com](https://console.anthropic.com) にアクセス
2. **API Keys → Create Key**
3. 生成されたキーをコピーして環境変数に設定

## 機能

- 📷 カメラで直接撮影
- 🖼️ 画像ファイルのアップロード
- 🤖 AIによる自動解析（日付・店舗・カテゴリ・金額・備考）
- 🇯🇵🇬🇧 日本語/英語切り替え
- 💴 通貨選択（JPY / USD / EUR / GBP / CNY）
- ✏️ テーブルのインライン編集
- 📥 CSV・Excelダウンロード
