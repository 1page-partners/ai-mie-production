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
| バックエンド | Supabase (Auth, Database, Edge Functions) |
| AI | OpenAI API (gpt-4.1-mini, text-embedding-3-small) |
| ベクトル検索 | pgvector (Supabase拡張) |

## データベーススキーマ

### 主要テーブル

```
conversations          # 会話セッション
├── id (uuid, PK)
├── user_id (uuid)
├── project_id (uuid, nullable)
├── title (text)
├── archived_at (timestamptz, nullable)  # 論理削除用
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
├── embedding (vector, nullable)
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
├── external_id_or_path (text, nullable)
├── meta (jsonb)
└── created_at, updated_at, last_synced_at

knowledge_chunks       # ナレッジチャンク（子）
├── id (uuid, PK)
├── source_id (uuid, FK)
├── chunk_index (int)
├── content (text)
├── embedding (vector, nullable)
└── meta (jsonb)

memory_refs            # メモリ参照ログ
├── id (uuid, PK)
├── conversation_id (uuid, FK)
├── memory_id (uuid, FK)
├── assistant_message_id (uuid, nullable)
└── score (float, nullable)

knowledge_refs         # ナレッジ参照ログ
├── id (uuid, PK)
├── conversation_id (uuid, FK)
├── chunk_id (uuid, FK)
├── assistant_message_id (uuid, nullable)
└── score (float, nullable)

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
| **RAG** | Memory/Knowledgeをコンテキストとして注入 |
| **メモリ管理** | CRUD、タイプ別分類、ピン留め、信頼度設定 |
| **ナレッジ管理** | ソース登録、ステータス表示 |
| **フィードバック** | 👍/👎評価 + コメント |
| **参照表示** | 右ペインに使用Memory/Chunk表示 |
| **匿名認証** | 開発用に匿名サインイン対応 |
| **日本語UI** | 全画面日本語化（体言止めトーン） |

### 未実装/検討中 🔲

- Google OAuth認証（コード有、現在バイパス中）
- 会話アーカイブ（archived_atカラム有、UI未実装）
- ナレッジ同期（status管理のみ、実際の同期処理なし）
- Embedding自動生成（手動またはEdge Function経由）

## ディレクトリ構成

```
src/
├── components/
│   ├── auth/           # 認証関連
│   ├── chat/           # チャットUI
│   │   ├── ChatArea.tsx
│   │   ├── ConversationList.tsx
│   │   └── ContextPanel.tsx
│   ├── layout/         # レイアウト
│   │   ├── AppLayout.tsx
│   │   └── AppSidebar.tsx
│   ├── memory/         # メモリ管理UI
│   └── ui/             # shadcn/ui
├── hooks/
├── lib/
│   └── services/       # ビジネスロジック
│       ├── auth.ts
│       ├── context.ts      # Memory/Knowledge検索
│       ├── contextText.ts  # プロンプト構築
│       ├── conversations.ts
│       ├── feedback.ts
│       └── refs.ts         # 参照ログ保存
├── pages/
│   ├── ChatPage.tsx
│   ├── MemoryPage.tsx
│   ├── KnowledgePage.tsx
│   └── SettingsPage.tsx
└── integrations/
    └── supabase/
        ├── client.ts
        └── types.ts        # 自動生成（編集不可）

supabase/
└── functions/
    ├── openai-chat/    # チャットAPI（SSE）
    └── openai-embed/   # Embedding生成
```

## Edge Functions

### openai-chat
- SSEストリーミングでAI応答を返却
- Memory/Knowledge検索 → コンテキスト構築 → OpenAI呼び出し
- 応答末尾のJSON(`{memory_ids:[], knowledge_chunk_ids:[]}`)をパースして参照ログ保存

### openai-embed
- text-embedding-3-small (1536次元) でEmbedding生成

## 設定済みSecrets

| Secret名 | 用途 |
|----------|------|
| OPENAI_API_KEY | OpenAI API認証 |
| OPENAI_MODEL_CHAT | チャットモデル名 |
| OPENAI_MODEL_EMBED | Embeddingモデル名 |
| EMBED_DIM | Embedding次元数 |
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
| /chat | チャット | 会話リスト + チャット + 文脈パネル |
| /memory | メモリ | 一覧 + 詳細/編集 |
| /knowledge | ナレッジ | ソース一覧 |
| /settings | 設定 | 接続状態 |
| /login | ログイン | Google OAuth |

## チャットフロー

```
1. ユーザー発話をDBに保存
2. match_memories / match_knowledge でRAG検索
3. [CONTEXT]プロンプト構築
4. openai-chat Edge Function呼び出し（SSE）
5. ストリーミング表示
6. 応答末尾のJSON抽出 → memory_refs / knowledge_refs 保存
7. 右ペインに参照表示
```

## 認証状態

現在、開発用に認証をバイパス中：
- `src/App.tsx`: ProtectedRouteをコメントアウト
- `ChatPage.tsx`: 匿名サインイン(signInAnonymously)で自動ログイン

本番前に要修正。

## 既知の課題

1. **Embedding未生成**: 新規Memory/Knowledgeのembeddingが空の場合、ベクトル検索にヒットしない
2. **ナレッジ同期**: 実際のファイル取り込み処理は未実装
3. **認証バイパス**: 本番前にProtectedRoute復元必要

---

最終更新: 2026-01-29
