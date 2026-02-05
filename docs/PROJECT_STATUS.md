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
├── pinned (boolean, default false) ← CONSTITUTION用
├── is_active (boolean, default true)
├── status (text: 'candidate'|'approved'|'rejected') ← 2段階管理 ✅
├── reviewed_at (timestamptz, nullable) ← 精査日時
├── rejected_reason (text, nullable) ← 却下理由
├── source_message_id (uuid, nullable) ← 自動抽出元
└── created_at, updated_at (timestamptz)

knowledge_sources      # ナレッジソース（親）
├── id (uuid, PK)
├── user_id (uuid)
├── project_id (uuid, nullable)
├── name (text)
├── type (enum: gdocs/pdf/notion/gdrive)
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

user_roles             # ユーザーロール
├── id (uuid, PK)
├── user_id (uuid)
├── role (enum: admin/user/origin)
└── created_at (timestamptz)

usage_logs             # 使用ログ
├── id (uuid, PK)
├── user_id (uuid)
├── action_type (text)
├── metadata (jsonb, nullable)
└── created_at (timestamptz)

origin_decisions       # Origin判断記録
├── id (uuid, PK)
├── user_id (uuid)
├── incident_key (text)
├── decision (text)
├── reasoning (text)
├── context_conditions (text, nullable)
├── non_negotiables (text, nullable)
├── confidence (float)
└── created_at, updated_at (timestamptz)

origin_decision_profiles  # Origin判断プロファイル
├── id (uuid, PK)
├── decision_id (uuid, FK)
├── raw_answer (jsonb)
├── extracted_logic (jsonb, nullable)
├── abstracted_context (text, nullable)
├── embedding (vector(1536), nullable)
└── created_at (timestamptz)

origin_principles      # Origin原則
├── id (uuid, PK)
├── user_id (uuid)
├── principle_key (text)
├── principle_label (text)
├── description (text)
├── polarity (text, nullable)
├── confidence (float)
├── embedding (vector(1536), nullable)
├── source_incident_ids (text[], nullable)
└── created_at, updated_at (timestamptz)

setup_sessions         # セットアップセッション
├── id (uuid, PK)
├── user_id (uuid)
├── status (text)
├── submitted_at (timestamptz, nullable)
├── reviewed_at (timestamptz, nullable)
├── reviewed_by (uuid, nullable)
├── rejection_reason (text, nullable)
└── created_at (timestamptz)

setup_answers          # セットアップ回答
├── id (uuid, PK)
├── session_id (uuid, FK)
├── question_key (text)
├── question_text (text)
├── answer_rule (text)
├── answer_rationale (text, nullable)
├── answer_exceptions (text, nullable)
├── proposed_type (enum: memory type)
├── proposed_confidence (float)
└── created_at, updated_at (timestamptz)
```

### Storage Buckets

| バケット名 | 用途 | 公開設定 |
|-----------|------|---------|
| `knowledge-files` | PDFアップロード用 | private (RLS) |

### RLSポリシー
全テーブルにRLSが有効化済み。基本的に `user_id = auth.uid()` でアクセス制御。

### DB関数
- `match_memories(query_embedding, match_count, ...)` - メモリベクトル類似検索
- `match_knowledge(query_embedding, match_count, ...)` - ナレッジベクトル検索
- `match_origin_decisions(query_embedding, match_count, ...)` - Origin判断検索
- `match_origin_principles(query_embedding, match_count, ...)` - Origin原則検索
- `has_role(_user_id, _role)` - ロールチェック
- `get_usage_stats(p_start_date, p_end_date)` - 使用統計取得
- `get_daily_usage(p_days)` - 日次使用量取得

## 機能一覧

### 実装済み ✅

| 機能 | 説明 |
|------|------|
| **チャット** | SSEストリーミング対応のAIチャット |
| **OpenAI Responses API** | Prompt Storage連携（OPENAI_PROMPT_IDで外部管理プロンプト使用）✅ |
| **RAG** | Memory/Knowledge/Origin Principles/Origin Decisionsをコンテキストとして注入 |
| **CONSTITUTION** | pinned=trueのメモリは常時システムプロンプトに含まれる ✅ |
| **メモリ管理** | CRUD、タイプ別分類、ピン留め、信頼度設定、Embedding自動生成 |
| **メモリ自動抽出** | チャット毎に最大3件の候補を自動抽出、重複判定付き ✅ |
| **2段階メモリ管理** | 候補→承認/却下のワークフロー、RAGはapprovedのみ対象 ✅ |
| **候補精査UI** | 承認/編集して承認/却下/一括却下（低信頼度）✅ |
| **ナレッジ管理** | PDFアップロード、ソース登録、ステータス表示、再同期 |
| **会話アーカイブ** | 論理削除（archived_at）、通常/アーカイブ切替、復元 |
| **Embedding自動生成** | Memory/Knowledge作成時に自動生成、欠損一括補完 |
| **PDF同期** | Storage→テキスト抽出→チャンク化→Embedding→upsert |
| **Google Docs同期** | API経由でテキスト取得→チャンク化（連携済み前提） |
| **Google Drive同期** | フォルダ内ファイル一括同期 ✅ |
| **Notion同期** | API経由でテキスト取得→チャンク化（連携済み前提） |
| **Origin機能** | 判断軸（Principles）と判断例（Decisions）のRAG連携 ✅ |
| **フィードバック** | 👍/👎評価 + コメント |
| **参照表示** | 右ペインに使用Memory/Chunk表示 |
| **参照ログ** | 重複防止INDEX、エラー時フォールバック |
| **運用ツール** | Embedding補完、失敗ソースリトライ、進捗表示 |
| **管理者機能** | ユーザー管理、ロール付与/剥奪、使用統計ダッシュボード ✅ |
| **匿名認証** | 開発用に匿名サインイン対応 |
| **日本語UI** | 全画面日本語化（体言止めトーン） |

## ディレクトリ構成

```
src/
├── components/
│   ├── auth/           # 認証関連
│   │   └── ProtectedRoute.tsx
│   ├── chat/           # チャットUI
│   │   ├── ChatArea.tsx
│   │   ├── ConversationList.tsx  # アーカイブ対応
│   │   └── ContextPanel.tsx
│   ├── layout/         # レイアウト
│   │   ├── AppLayout.tsx
│   │   └── AppSidebar.tsx
│   ├── memory/         # メモリ管理UI
│   │   ├── MemoryList.tsx           # ステータスタブ対応
│   │   ├── MemoryDetail.tsx         # Embedding再生成ボタン
│   │   ├── MemoryCandidateActions.tsx  # 候補精査UI ✅
│   │   └── MemoryCreateForm.tsx
│   ├── knowledge/      # ナレッジ管理UI
│   │   ├── AddGDriveDialog.tsx
│   │   └── AddNotionDialog.tsx
│   ├── admin/          # 管理者UI
│   │   ├── UsageDashboard.tsx
│   │   └── UserManagement.tsx
│   └── ui/             # shadcn/ui
├── hooks/
│   ├── useAuth.ts      # 認証フック
│   ├── useAdmin.ts     # 管理者フック
│   ├── useOrigin.ts    # Origin機能フック
│   └── use-mobile.tsx
├── lib/
│   └── services/       # ビジネスロジック
│       ├── auth.ts
│       ├── admin.ts        # 管理者サービス
│       ├── context.ts      # Memory/Knowledge検索（フォールバック対応）
│       ├── contextText.ts  # プロンプト構築
│       ├── conversations.ts # archive/unarchive追加
│       ├── memory.ts       # Embedding自動生成・補完
│       ├── knowledge.ts    # PDF upload, sync, 補完
│       ├── feedback.ts
│       ├── origin.ts       # Origin機能サービス
│       ├── profiles.ts     # プロファイル管理
│       ├── refs.ts         # 参照ログ保存
│       └── dify.ts         # Dify連携（レガシー）
├── pages/
│   ├── Index.tsx           # ランディング/リダイレクト
│   ├── LoginPage.tsx       # ログイン
│   ├── ChatPage.tsx        # アーカイブ対応
│   ├── MemoryPage.tsx      # Embedding再生成対応
│   ├── KnowledgePage.tsx   # PDFアップロード、再同期対応
│   ├── SettingsPage.tsx    # 運用ツール追加
│   ├── AdminPage.tsx       # 管理者画面 ✅
│   ├── SetupOriginPage.tsx # Originセットアップ
│   ├── SetupReviewPage.tsx # セットアップレビュー
│   ├── OriginIncidentsPage.tsx # Origin判断記録
│   ├── OriginFeedbackPage.tsx  # Originフィードバック
│   └── NotFound.tsx
└── integrations/
    └── supabase/
        ├── client.ts
        └── types.ts        # 自動生成（編集不可）

supabase/
├── config.toml
└── functions/
    ├── openai-chat/    # チャットAPI（SSE）、RAG堅牢化済み、Responses API対応 ✅
    ├── openai-embed/   # Embedding生成
    ├── pdf-ingest/     # PDFテキスト抽出→チャンク→Embedding
    ├── gdocs-sync/     # Google Docs同期
    ├── gdrive-sync/    # Google Drive同期 ✅
    ├── notion-sync/    # Notion同期
    ├── dify-chat/      # Dify連携（レガシー）
    └── decision-profiler/  # Origin判断プロファイル抽出 ✅
```

## Edge Functions

| 関数名 | 用途 |
|--------|------|
| `openai-chat` | SSEチャット応答、RAG検索、メモリ自動抽出(最大3件/ターン)、Responses API対応 |
| `openai-embed` | Embedding生成 (text-embedding-3-small, 1536次元) |
| `pdf-ingest` | PDFテキスト抽出→チャンク化→Embedding→upsert |
| `gdocs-sync` | Google Docsからテキスト取得→チャンク化→Embedding |
| `gdrive-sync` | Google Driveフォルダ内ファイル一括同期 |
| `notion-sync` | Notionページからテキスト取得→チャンク化→Embedding |
| `decision-profiler` | Origin判断から抽象的原則を抽出 |
| `dify-chat` | Dify API連携（レガシー） |

## 設定済みSecrets

| Secret名 | 用途 |
|----------|------|
| OPENAI_API_KEY | OpenAI API認証 |
| OPENAI_MODEL_CHAT | チャットモデル名（例: gpt-4.1-mini） |
| OPENAI_MODEL_EMBED | Embeddingモデル名（例: text-embedding-3-small） |
| EMBED_DIM | Embedding次元数 (1536) |
| OPENAI_PROMPT_ID | OpenAI Responses API用プロンプトID ✅ |
| SUPABASE_URL | Supabase URL |
| SUPABASE_ANON_KEY | 匿名キー |
| SUPABASE_SERVICE_ROLE_KEY | サービスロールキー |

## OpenAI Responses API統合

`OPENAI_PROMPT_ID`が設定されている場合、チャット機能はOpenAI Responses APIを使用して外部管理のシステムプロンプトを参照します。

### 動作フロー
1. `OPENAI_PROMPT_ID`が設定されている場合 → Responses API (`/v1/responses`) を使用
2. 設定されていない場合 → 従来のChat Completions API (`/v1/chat/completions`) にフォールバック

### リクエスト形式
```typescript
// Responses API使用時
{
  model: "gpt-4.1-mini",
  stream: true,
  input: [
    {
      role: "user",
      content: "[CONTEXT情報]\n\n会話履歴:\n...\n\nユーザーの質問: ..."
    }
  ],
  prompt: {
    id: "pmpt_XXXXX"  // OpenAI Prompt Storage ID
  }
}
```

## UI設計

- **デザインシステム**: Teal/Slate配色、shadcn/ui
- **レイアウト**: 3ペイン（サイドバー + メイン + コンテキストパネル）
- **言語**: 日本語固定（切替なし）
- **トーン**: 体言止め（簡潔）

### 画面構成

| パス | 画面名 | 説明 |
|------|--------|------|
| / | インデックス | ランディング/リダイレクト |
| /login | ログイン | Google OAuth |
| /chat | チャット | 会話リスト（アーカイブ対応）+ チャット + 文脈パネル |
| /memory | メモリ | 一覧 + 詳細/編集 + Embedding再生成 |
| /knowledge | ナレッジ | ソース一覧 + PDFアップロード + 再同期 |
| /settings | 設定 | 接続状態 + 運用ツール（Embedding補完、失敗リトライ） |
| /admin | 管理者 | ユーザー管理 + 使用統計 |
| /setup-origin | Originセットアップ | 判断軸設定 |
| /setup-review | セットアップレビュー | 回答確認 |
| /origin-incidents | Origin判断記録 | 過去の判断閲覧 |
| /origin-feedback | Originフィードバック | フィードバック一覧 |

## チャットフロー

```
1. ユーザー発話をDBに保存
2. OpenAI Embedding APIでクエリベクトル生成
3. RAG検索実行
   - match_memories: approvedメモリのみ対象
   - match_knowledge: readyソースのチャンクのみ
   - match_origin_principles: 判断軸検索
   - match_origin_decisions: 判断例検索
   - 失敗時はLIKEフォールバック（title + content検索）
4. pinned=trueのメモリ（CONSTITUTION）を追加取得
5. [CONTEXT]プロンプト構築
   - CONSTITUTION: 常時遵守する基本方針
   - ORIGIN_PRINCIPLES: 判断軸
   - ORIGIN_DECISION_EXAMPLES: 参考判断例
   - MEMORY: 長期記憶（8件上限）
   - KNOWLEDGE: 資料/マニュアル（6件上限）
6. OpenAI API呼び出し
   - OPENAI_PROMPT_ID設定時: Responses API使用
   - 未設定時: Chat Completions API使用
7. SSEストリーミング表示
8. 応答末尾のJSON抽出（失敗時は注入IDを使用）
9. memory_refs / knowledge_refs 保存（重複無視）
10. 右ペインに参照表示
11. メモリ候補自動抽出（非同期、最大3件）→ status='candidate' で保存
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

最終更新: 2026-02-05
