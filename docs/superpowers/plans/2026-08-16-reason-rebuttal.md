# 理由への反論機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** お題ページで、他人の投稿の理由1・2・3それぞれに「反対の主張＋理由3つ」の反論を1ニックネーム1回まで付けられるようにする。

**Architecture:** `posts` はそのままにし、専用テーブル `rebuttals` を追加する。お題ページで posts 取得後に post id 群で rebuttals を一括取得し、各理由の下に表示・投稿する。認証は入れず、ニックネーム＋localStorage と UNIQUE 制約で二重反論を防ぐ。

**Tech Stack:** Next.js 16 (App Router) / React 19 / Supabase JS / TypeScript / Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-08-16-reason-rebuttal-design.md`

## Global Constraints

- 反論は理由単位のみ（投稿全体への返信なし）
- ネストは1段まで（反論への反論なし）
- 形式は claim＋reason1/2/3 すべて必須
- UNIQUE (`post_id`, `reason_index`, `nickname`) で二重反論禁止
- 元投稿と同じ nickname では反論不可
- いいね・ログイン・自由コメントは追加しない
- 既存の意見投稿フローは壊さない
- 文言: ボタン「この理由に反論」/ 送信「反論する」/ 二重「すでにこの理由に反論済みです」/ 失敗「反論の投稿に失敗しました」

---

## File Structure

| ファイル | 役割 |
|---|---|
| `supabase/rebuttals.sql` | Supabase に貼る DDL（テーブル・制約・RLS方針メモ） |
| `src/lib/rebuttals.ts` | 型・バリデーション・エラー判定の純関数 |
| `src/lib/rebuttals.test.ts` | 上記の Node 組み込みテスト |
| `src/app/topics/[id]/page.tsx` | 表示・フォーム・取得・送信（既存ページを拡張） |
| `docs/ideas.md` | 優先1を「採用・実装中/済み」に更新 |

触らない: `src/lib/supabase.ts`, `src/app/page.tsx`, `src/app/admin/page.tsx`（参照のみ）

---

### Task 1: `rebuttals` テーブル DDL を用意する

**Files:**
- Create: `supabase/rebuttals.sql`
- Modify: （なし）

**Interfaces:**
- Produces: Supabase 上の `public.rebuttals` テーブル（下記カラム・制約どおり）

- [ ] **Step 1: DDL ファイルを作成する**

`supabase/rebuttals.sql` に以下を書く:

```sql
-- Run in Supabase SQL Editor
create table if not exists public.rebuttals (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reason_index smallint not null check (reason_index in (1, 2, 3)),
  nickname text not null,
  claim text not null,
  reason1 text not null,
  reason2 text not null,
  reason3 text not null,
  created_at timestamptz not null default now(),
  unique (post_id, reason_index, nickname)
);

create index if not exists rebuttals_post_id_idx on public.rebuttals (post_id);

-- MVP: posts/topics と同様、anon から insert/select 可能にする
-- （既存テーブルの RLS 方針に合わせて調整すること）
alter table public.rebuttals enable row level security;

create policy "Allow anon select rebuttals"
  on public.rebuttals for select
  to anon, authenticated
  using (true);

create policy "Allow anon insert rebuttals"
  on public.rebuttals for insert
  to anon, authenticated
  with check (true);
```

既存の `posts` / `topics` に RLS が無い、または別ポリシーなら、ダッシュボードで揃えてからポリシーを調整する。方針: **クライアントから select/insert できること**。

- [ ] **Step 2: Supabase SQL Editor で実行する**

1. Supabase ダッシュボード → SQL Editor
2. `supabase/rebuttals.sql` の内容を実行
3. Table Editor で `rebuttals` が見えることを確認

- [ ] **Step 3: Commit**

```bash
git add supabase/rebuttals.sql
git commit -m "$(cat <<'EOF'
chore: add rebuttals table DDL for reason rebuttals

EOF
)"
```

---

### Task 2: 型とバリデーション純関数＋テスト

**Files:**
- Create: `src/lib/rebuttals.ts`
- Create: `src/lib/rebuttals.test.ts`
- Modify: `package.json`（`test` スクリプト追加）

**Interfaces:**
- Produces:
  - `export type Rebuttal = { id: string; post_id: string; reason_index: 1 | 2 | 3; nickname: string; claim: string; reason1: string; reason2: string; reason3: string; created_at: string }`
  - `export type ReasonIndex = 1 | 2 | 3`
  - `export function isReasonIndex(value: number): value is ReasonIndex`
  - `export function validateRebuttalInput(input: { nickname: string; claim: string; reason1: string; reason2: string; reason3: string; reason_index: number }): string | null` — 問題なければ `null`、あれば日本語エラーメッセージ
  - `export function canRebut(args: { viewerNickname: string; postNickname: string; existingRebuttals: Pick<Rebuttal, 'nickname' | 'reason_index'>[]; reasonIndex: ReasonIndex }): boolean`
  - `export function isUniqueViolation(error: { code?: string } | null): boolean` — Postgres `23505`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/rebuttals.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canRebut,
  isReasonIndex,
  isUniqueViolation,
  validateRebuttalInput,
} from './rebuttals'

test('isReasonIndex accepts 1-3 only', () => {
  assert.equal(isReasonIndex(1), true)
  assert.equal(isReasonIndex(3), true)
  assert.equal(isReasonIndex(0), false)
  assert.equal(isReasonIndex(4), false)
})

test('validateRebuttalInput requires all fields', () => {
  const ok = validateRebuttalInput({
    nickname: 'A',
    claim: '反対',
    reason1: 'r1',
    reason2: 'r2',
    reason3: 'r3',
    reason_index: 2,
  })
  assert.equal(ok, null)

  const bad = validateRebuttalInput({
    nickname: '',
    claim: '反対',
    reason1: 'r1',
    reason2: 'r2',
    reason3: 'r3',
    reason_index: 2,
  })
  assert.notEqual(bad, null)
})

test('canRebut blocks self and duplicate nickname on same reason', () => {
  assert.equal(
    canRebut({
      viewerNickname: 'Alice',
      postNickname: 'Alice',
      existingRebuttals: [],
      reasonIndex: 1,
    }),
    false,
  )

  assert.equal(
    canRebut({
      viewerNickname: 'Bob',
      postNickname: 'Alice',
      existingRebuttals: [{ nickname: 'Bob', reason_index: 1 }],
      reasonIndex: 1,
    }),
    false,
  )

  assert.equal(
    canRebut({
      viewerNickname: 'Bob',
      postNickname: 'Alice',
      existingRebuttals: [{ nickname: 'Bob', reason_index: 1 }],
      reasonIndex: 2,
    }),
    true,
  )
})

test('isUniqueViolation detects 23505', () => {
  assert.equal(isUniqueViolation({ code: '23505' }), true)
  assert.equal(isUniqueViolation({ code: '42501' }), false)
  assert.equal(isUniqueViolation(null), false)
})
```

- [ ] **Step 2: テスト実行して失敗を確認**

`package.json` の scripts に追加:

```json
"test": "node --import tsx --test src/lib/rebuttals.test.ts"
```

もし `tsx` が無ければ:

```bash
npm install -D tsx
```

Run: `npm test`  
Expected: FAIL（`./rebuttals` が未作成、または export 不足）

代替（依存追加を避けたい場合）:

```json
"test": "npx tsc --noEmit && node --experimental-strip-types --test src/lib/rebuttals.test.ts"
```

Node のバージョンで `--experimental-strip-types` が使えるなら `tsx` 不要。使えなければ `tsx` を入れる。

- [ ] **Step 3: 実装する**

`src/lib/rebuttals.ts`:

```ts
export type ReasonIndex = 1 | 2 | 3

export type Rebuttal = {
  id: string
  post_id: string
  reason_index: ReasonIndex
  nickname: string
  claim: string
  reason1: string
  reason2: string
  reason3: string
  created_at: string
}

export function isReasonIndex(value: number): value is ReasonIndex {
  return value === 1 || value === 2 || value === 3
}

export function validateRebuttalInput(input: {
  nickname: string
  claim: string
  reason1: string
  reason2: string
  reason3: string
  reason_index: number
}): string | null {
  if (!input.nickname.trim() || !input.claim.trim() || !input.reason1.trim() || !input.reason2.trim() || !input.reason3.trim()) {
    return 'すべての項目を入力してください'
  }
  if (!isReasonIndex(input.reason_index)) {
    return '反論する理由を選んでください'
  }
  return null
}

export function canRebut(args: {
  viewerNickname: string
  postNickname: string
  existingRebuttals: Pick<Rebuttal, 'nickname' | 'reason_index'>[]
  reasonIndex: ReasonIndex
}): boolean {
  const viewer = args.viewerNickname.trim()
  if (!viewer) return true // 未入力時はボタン表示可（送信時に必須チェック）
  if (viewer === args.postNickname.trim()) return false
  return !args.existingRebuttals.some(
    (r) => r.reason_index === args.reasonIndex && r.nickname.trim() === viewer,
  )
}

export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505'
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `npm test`  
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/rebuttals.ts src/lib/rebuttals.test.ts
git commit -m "$(cat <<'EOF'
feat: add rebuttal validation helpers and tests

EOF
)"
```

---

### Task 3: お題ページで反論を取得・表示する

**Files:**
- Modify: `src/app/topics/[id]/page.tsx`

**Interfaces:**
- Consumes: `Rebuttal`, `ReasonIndex` from `@/lib/rebuttals`
- Produces: 各投稿の理由下に反論一覧が表示されること（投稿 UI はまだ不要）

- [ ] **Step 1: 型と state を追加する**

`Post` 型の下に `Rebuttal` を import。state:

```ts
const [rebuttals, setRebuttals] = useState<Rebuttal[]>([])
```

- [ ] **Step 2: posts 取得後に rebuttals を一括取得する**

`fetchData` 内、posts 取得後:

```ts
const postIds = (postsData || []).map((p) => p.id)
let rebuttalsData: Rebuttal[] = []
if (postIds.length > 0) {
  const { data } = await supabase
    .from('rebuttals')
    .select('*')
    .in('post_id', postIds)
    .order('created_at', { ascending: true })
  rebuttalsData = (data || []) as Rebuttal[]
}
setRebuttals(rebuttalsData)
```

ヘルパー:

```ts
function rebuttalsFor(postId: string, reasonIndex: ReasonIndex) {
  return rebuttals.filter(
    (r) => r.post_id === postId && r.reason_index === reasonIndex,
  )
}
```

- [ ] **Step 3: 理由表示をブロック化し、下に反論を出す**

投稿カード内の理由表示を、概ね次の構造に置き換える（スタイルは既存の gray / white カードに合わせる）:

```tsx
{([1, 2, 3] as const).map((idx) => {
  const text = idx === 1 ? post.reason1 : idx === 2 ? post.reason2 : post.reason3
  const items = rebuttalsFor(post.id, idx)
  return (
    <div key={idx} className="mt-2">
      <p className="text-sm text-gray-700">
        <span className="font-semibold">理由{idx}:</span> {text}
      </p>
      {items.length > 0 && (
        <div className="ml-3 mt-2 space-y-2 border-l-2 border-gray-200 pl-3">
          {items.map((r) => (
            <div key={r.id} className="text-sm">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{r.nickname}</span>
                <span>{new Date(r.created_at).toLocaleString('ja-JP')}</span>
              </div>
              <p className="font-medium">{r.claim}</p>
              <p>理由1: {r.reason1}</p>
              <p>理由2: {r.reason2}</p>
              <p>理由3: {r.reason3}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})}
```

この Task ではボタン／フォームはまだ付けない。

- [ ] **Step 4: 手動確認**

1. Supabase Table Editor でテスト用 rebuttal を1件手挿入（既存 post_id、reason_index=1）
2. `npm run dev` でお題ページを開き、該当理由の下に表示されること
3. リロードしても残ること

- [ ] **Step 5: Commit**

```bash
git add src/app/topics/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat: load and display rebuttals under each reason

EOF
)"
```

---

### Task 4: 反論フォームと送信

**Files:**
- Modify: `src/app/topics/[id]/page.tsx`

**Interfaces:**
- Consumes: `validateRebuttalInput`, `canRebut`, `isUniqueViolation`, `isReasonIndex` from `@/lib/rebuttals`

- [ ] **Step 1: 反論フォーム用 state を追加する**

```ts
const [rebuttalTarget, setRebuttalTarget] = useState<{
  postId: string
  reasonIndex: ReasonIndex
} | null>(null)
const [rebuttalClaim, setRebuttalClaim] = useState('')
const [rebuttalReason1, setRebuttalReason1] = useState('')
const [rebuttalReason2, setRebuttalReason2] = useState('')
const [rebuttalReason3, setRebuttalReason3] = useState('')
const [rebuttalSubmitting, setRebuttalSubmitting] = useState(false)
```

意見フォーム（`showForm`）と同時に開かない: 反論を開くとき `setShowForm(false)`、意見を開くとき `setRebuttalTarget(null)`。

- [ ] **Step 2: 各理由に「この理由に反論」ボタンを付ける**

`canRebut` が true のときだけ表示:

```tsx
{canRebut({
  viewerNickname: nickname,
  postNickname: post.nickname,
  existingRebuttals: rebuttals.filter((r) => r.post_id === post.id),
  reasonIndex: idx,
}) && (
  <button
    type="button"
    className="text-xs text-blue-600 mt-1"
    onClick={() => {
      setShowForm(false)
      setRebuttalTarget({ postId: post.id, reasonIndex: idx })
    }}
  >
    この理由に反論
  </button>
)}
```

`canRebut` が false かつ viewer が既にその理由に反論済みなら、任意で `<span className="text-xs text-gray-400 mt-1">反論済み</span>` を出す。

- [ ] **Step 3: 反論送信ハンドラを実装する**

```ts
const handleRebuttalSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!rebuttalTarget) return

  const post = posts.find((p) => p.id === rebuttalTarget.postId)
  if (!post) return

  const validationError = validateRebuttalInput({
    nickname,
    claim: rebuttalClaim,
    reason1: rebuttalReason1,
    reason2: rebuttalReason2,
    reason3: rebuttalReason3,
    reason_index: rebuttalTarget.reasonIndex,
  })
  if (validationError) {
    alert(validationError)
    return
  }

  if (nickname.trim() === post.nickname.trim()) {
    alert('自分の投稿には反論できません')
    return
  }

  setRebuttalSubmitting(true)
  localStorage.setItem('nickname', nickname)

  const { error } = await supabase.from('rebuttals').insert({
    post_id: rebuttalTarget.postId,
    reason_index: rebuttalTarget.reasonIndex,
    nickname,
    claim: rebuttalClaim,
    reason1: rebuttalReason1,
    reason2: rebuttalReason2,
    reason3: rebuttalReason3,
  })

  if (error) {
    if (isUniqueViolation(error)) {
      alert('すでにこの理由に反論済みです')
    } else {
      alert('反論の投稿に失敗しました')
      console.error(error)
    }
  } else {
    setRebuttalClaim('')
    setRebuttalReason1('')
    setRebuttalReason2('')
    setRebuttalReason3('')
    setRebuttalTarget(null)

    const postIds = posts.map((p) => p.id)
    const { data } = await supabase
      .from('rebuttals')
      .select('*')
      .in('post_id', postIds)
      .order('created_at', { ascending: true })
    setRebuttals((data || []) as Rebuttal[])
  }

  setRebuttalSubmitting(false)
}
```

- [ ] **Step 4: 反論フォーム UI を追加する**

既存の意見フォームと同様、`rebuttalTarget` があるとき下部／カード内に表示:

```tsx
{rebuttalTarget && (
  <div className="bg-white p-5 rounded-lg shadow fixed bottom-0 left-0 right-0 md:static max-w-2xl mx-auto">
    <h3 className="font-bold mb-4">
      理由{rebuttalTarget.reasonIndex}への反論
    </h3>
    <form onSubmit={handleRebuttalSubmit} className="space-y-3">
      {/* nickname / claim / reason1 / reason2 / reason3 — 意見フォームと同パターン */}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={() => setRebuttalTarget(null)} className="flex-1 border rounded py-2">
          キャンセル
        </button>
        <button type="submit" disabled={rebuttalSubmitting} className="flex-1 bg-blue-600 text-white rounded py-2 disabled:opacity-50">
          {rebuttalSubmitting ? '投稿中...' : '反論する'}
        </button>
      </div>
    </form>
  </div>
)}
```

フィールド label: 「ニックネーム」「反対の主張」「理由1（必須）」「理由2（必須）」「理由3（必須）」

- [ ] **Step 5: 手動確認（スペックのチェックリスト）**

1. 他人の投稿の理由に反論できる（claim＋理由3つ必須）
2. 同じ nickname で同じ理由に2回目 → 「すでにこの理由に反論済みです」
3. 自分の投稿にボタンが出ない
4. 反論の下に反論ボタンが出ない
5. 別 nickname なら同じ理由に複数付けられる
6. リロード後も残る
7. 既存の「意見を書く」が壊れていない

Run: `npm test`（回帰）  
Run: `npm run lint`（重大エラーがないこと）

- [ ] **Step 6: Commit**

```bash
git add src/app/topics/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat: allow one rebuttal per reason with three reasons

EOF
)"
```

---

### Task 5: ideas メモを更新する

**Files:**
- Modify: `docs/ideas.md`

- [ ] **Step 1: 優先1に実装状況を追記する**

「### 1. 理由への反論だけを許す」見出し付近に、例えば:

```markdown
**状態: 実装済み（スペック: docs/superpowers/specs/2026-08-16-reason-rebuttal-design.md）**
```

本文のルールがスペックと食い違う場合は、スペック側を正として1行で揃える。

- [ ] **Step 2: Commit**

```bash
git add docs/ideas.md
git commit -m "$(cat <<'EOF'
docs: mark reason rebuttal idea as implemented

EOF
)"
```

---

## Self-Review

1. **Spec coverage:** 理由単位 / 1段 / claim+3理由 / UNIQUE / 自己反論不可 / 表示・フォーム・エラー文言 / 手動確認 → Task 1–4 で対応。ideas 更新は Task 5。
2. **Placeholders:** なし（DDL・関数・UI 断片を具体化済み）。
3. **Type consistency:** `ReasonIndex` / `Rebuttal` / `canRebut` / `validateRebuttalInput` / `isUniqueViolation` を Task 2 で定義し、Task 3–4 で同じ名前を使用。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-16-reason-rebuttal.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — タスクごとに新しいサブエージェントを立て、間でレビュー
2. **Inline Execution** — このセッションで executing-plans に沿って順に実装

どちらで進めますか？
