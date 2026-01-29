# AI-MIE プロジェクト開発状況

## 概要

AI-MIEは、長期記憶（Memory）とナレッジベース（Knowledge）を活用したRAG対応AIチャットアプリケーション。ビジネス文脈での利用を想定した3ペインUIを持つ。

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | React 18 + TypeScript + Vite |
| スタイリング | Tailwind CSS + shadcn/ui |
| 状態管理 | React Query (@tanstack/react-query) |
| ルーティング | React Router v6 |
| バックエンド | Supabase (Auth, Database, Storage, Edge Functions) |
| AI | OpenAI API (gpt-4o-mini, text-embedding-3-small) |
| ベクトル検索 | pgvector (Supabase拡張) |

## データベーススキーマ

### 主要テーブル

```
conversations          # 会話セッション
├── id (uuid, PK)
├── user_id (uuid)
├── project_id (uuid, nullable)
├── title (text)
├── archived_at (timestamptz, nullable)  # 論理削除用 ✅
└── created_at (timestamptz)

conversation_messages  # 個別メッセージ
├── id (uuid, PK)
├── conversation_id (uuid, FK)
├── user_id (uuid)
├── role (text: 'user' | 'assistant')
├── content (text)
├── meta (jsonb)
└── created_at (timestamptz)

memories               # 長期記憶
├── id (uuid, PK)
├── user_id (uuid)
├── project_id (uuid, nullable)
├── type (enum: fact/preference/procedure/goal/context)
├── title (text)
├── content (text)
├── embedding (vector(1536), nullable) ← 自動生成 ✅
├── confidence (float, default 0.7)
├── pinned (boolean, default false)
├── is_active (boolean, default true)
└── created_at, updated_at (timestamptz)

knowledge_sources      # ナレッジソース（親）
├── id (uuid, PK)
├── user_id (uuid)
├── project_id (uuid, nullable)
├── name (text)
├── type (enum: gdocs/pdf/notion)
├── status (enum: pending/processing/ready/error)
├── external_id_or_path (text, nullable) ← Storage path or external ID
├── meta (jsonb) ← error, chunks_count, access_token等
└── created_at, updated_at, last_synced_at

knowledge_chunks       # ナレッジチャンク（子）
├── id (uuid, PK)
├── source_id (uuid, FK)
├── chunk_index (int)
├── content (text)
├── embedding (vector(1536), nullable) ← 自動生成 ✅
└── meta (jsonb)

memory_refs            # メモリ参照ログ
├── id (uuid, PK)
├── conversation_id (uuid, FK)
├── memory_id (uuid, FK)
├── assistant_message_id (uuid, nullable)
├── score (float, nullable)
└── UNIQUE INDEX (conversation_id, assistant_message_id, memory_id) ✅

knowledge_refs         # ナレッジ参照ログ
├── id (uuid, PK)
├── conversation_id (uuid, FK)
├── chunk_id (uuid, FK)
├── assistant_message_id (uuid, nullable)
├── score (float, nullable)
└── UNIQUE INDEX (conversation_id, assistant_message_id, chunk_id) ✅

feedback               # ユーザーフィードバック
├── id (uuid, PK)
├── conversation_id (uuid, FK)
├── message_id (uuid, FK)
├── user_id (uuid)
├── rating (int)
└── comment (text, nullable)

profiles               # ユーザープロファイル
├── id (uuid, PK)
├── user_id (uuid)
├── display_name (text, nullable)
└── avatar_url (text, nullable)

projects               # プロジェクト（スコープ分離用）
├── id (uuid, PK)
├── user_id (uuid)
├── name (text)
└── description (text, nullable)
```

### Storage Buckets

| バケット名 | 用途 | 公開設定 |
|-----------|------|---------|
| `knowledge-files` | PDFアップロード用 | private (RLS) |

### RLSポリシー
全テーブルにRLSが有効化済み。基本的に `user_id = auth.uid()` でアクセス制御。

### DB関数
- `match_memories(query_embedding, match_count, ...)` - ベクトル類似検索
- `match_knowledge(query_embedding, match_count, ...)` - ナレッジベクトル検索

## 機能一覧

### 実装済み ✅

| 機能 | 説明 |
|------|------|
| **チャット** | SSEストリーミング対応のAIチャット |
| **RAG** | Memory/Knowledgeをコンテキストとして注入、LIKEフォールバック対応 |
| **メモリ管理** | CRUD、タイプ別分類、ピン留め、信頼度設定、Embedding自動生成 |
| **ナレッジ管理** | PDFアップロード、ソース登録、ステータス表示、再同期 |
| **会話アーカイブ** | 論理削除（archived_at）、通常/アーカイブ切替、復元 |
| **Embedding自動生成** | Memory/Knowledge作成時に自動生成、欠損一括補完 |
| **PDF同期** | Storage→テキスト抽出→チャンク化→Embedding→upsert |
| **Google Docs同期** | API経由でテキスト取得→チャンク化（連携済み前提） |
| **Notion同期** | API経由でテキスト取得→チャンク化（連携済み前提） |
| **フィードバック** | 👍/👎評価 + コメント |
| **参照表示** | 右ペインに使用Memory/Chunk表示 |
| **参照ログ** | 重複防止INDEX、エラー時フォールバック |
| **運用ツール** | Embedding補完、失敗ソースリトライ、進捗表示 |
| **匿名認証** | 開発用に匿名サインイン対応 |
| **日本語UI** | 全画面日本語化（体言止めトーン） |

## ディレクトリ構成

```
src/
├── components/
│   ├── auth/           # 認証関連
│   ├── chat/           # チャットUI
│   │   ├── ChatArea.tsx
│   │   ├── ConversationList.tsx  # アーカイブ対応
│   │   └── ContextPanel.tsx
│   ├── layout/         # レイアウト
│   │   ├── AppLayout.tsx
│   │   └── AppSidebar.tsx
│   ├── memory/         # メモリ管理UI
│   │   ├── MemoryList.tsx
│   │   ├── MemoryDetail.tsx      # Embedding再生成ボタン
│   │   └── MemoryCreateForm.tsx
│   └── ui/             # shadcn/ui
├── hooks/
├── lib/
│   └── services/       # ビジネスロジック
│       ├── auth.ts
│       ├── context.ts      # Memory/Knowledge検索（フォールバック対応）
│       ├── contextText.ts  # プロンプト構築
│       ├── conversations.ts # archive/unarchive追加
│       ├── memory.ts       # 新規: Embedding自動生成・補完
│       ├── knowledge.ts    # 新規: PDF upload, sync, 補完
│       ├── feedback.ts
│       └── refs.ts         # 参照ログ保存
├── pages/
│   ├── ChatPage.tsx        # アーカイブ対応
│   ├── MemoryPage.tsx      # Embedding再生成対応
│   ├── KnowledgePage.tsx   # PDFアップロード、再同期対応
│   └── SettingsPage.tsx    # 運用ツール追加
└── integrations/
    └── supabase/
        ├── client.ts
        └── types.ts        # 自動生成（編集不可）

supabase/
├── config.toml
└── functions/
    ├── openai-chat/    # チャットAPI（SSE）、RAG堅牢化済み
    ├── openai-embed/   # Embedding生成
    ├── pdf-ingest/     # 新規: PDFテキスト抽出→チャンク→Embedding
    ├── gdocs-sync/     # 新規: Google Docs同期
    └── notion-sync/    # 新規: Notion同期
```

## Edge Functions

| 関数名 | 用途 |
|--------|------|
| `openai-chat` | SSEチャット応答、RAG検索（Vector+LIKE fallback）、参照ログ保存 |
| `openai-embed` | Embedding生成 (text-embedding-3-small, 1536次元) |
| `pdf-ingest` | PDFテキスト抽出→チャンク化→Embedding→upsert |
| `gdocs-sync` | Google Docsからテキスト取得→チャンク化→Embedding |
| `notion-sync` | Notionページからテキスト取得→チャンク化→Embedding |

## 設定済みSecrets

| Secret名 | 用途 |
|----------|------|
| OPENAI_API_KEY | OpenAI API認証 |
| OPENAI_MODEL_CHAT | チャットモデル名 |
| OPENAI_MODEL_EMBED | Embeddingモデル名 |
| EMBED_DIM | Embedding次元数 (1536) |
| SUPABASE_URL | Supabase URL |
| SUPABASE_ANON_KEY | 匿名キー |
| SUPABASE_SERVICE_ROLE_KEY | サービスロールキー |

## UI設計

- **デザインシステム**: Teal/Slate配色、shadcn/ui
- **レイアウト**: 3ペイン（サイドバー + メイン + コンテキストパネル）
- **言語**: 日本語固定（切替なし）
- **トーン**: 体言止め（簡潔）

### 画面構成

| パス | 画面名 | 説明 |
|------|--------|------|
| /chat | チャット | 会話リスト（アーカイブ対応）+ チャット + 文脈パネル |
| /memory | メモリ | 一覧 + 詳細/編集 + Embedding再生成 |
| /knowledge | ナレッジ | ソース一覧 + PDFアップロード + 再同期 |
| /settings | 設定 | 接続状態 + 運用ツール（Embedding補完、失敗リトライ） |
| /login | ログイン | Google OAuth |

## チャットフロー

```
1. ユーザー発話をDBに保存
2. OpenAI Embedding APIでクエリベクトル生成
3. match_memories / match_knowledge でRAG検索
   - 失敗時はLIKEフォールバック（title + content検索）
4. [CONTEXT]プロンプト構築（Memory 8件、Knowledge 6件上限）
5. openai-chat Edge Function呼び出し（SSE）
6. ストリーミング表示
7. 応答末尾のJSON抽出（失敗時は注入IDを使用）
8. memory_refs / knowledge_refs 保存（重複無視）
9. 右ペインに参照表示
```

## 認証状態

現在、開発用に認証をバイパス中：
- `src/App.tsx`: ProtectedRouteをコメントアウト
- `ChatPage.tsx`: 匿名サインイン(signInAnonymously)で自動ログイン

本番前に要修正。

## 既知の課題・注意点

1. **PDF抽出**: 簡易実装（画像PDF・暗号化PDFは非対応）
2. **Google Docs/Notion連携**: OAuthフロー未実装（トークン手動設定前提、`meta.access_token`に格納）
3. **認証バイパス**: 本番前にProtectedRoute復元必要
4. **Leaked Password Protection**: Supabase Dashboardで有効化推奨

---

最終更新: 2026-01-29
