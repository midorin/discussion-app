'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  type Rebuttal,
  type ReasonIndex,
  validateRebuttalInput,
  canRebut,
  isUniqueViolation,
} from '@/lib/rebuttals'
import Link from 'next/link'

type Topic = {
  id: string
  title: string
  description: string | null
  deadline: string
}

type Post = {
  id: string
  nickname: string
  opinion: string
  reason1: string
  reason2: string
  reason3: string
  created_at: string
}

export default function TopicPage() {
  const params = useParams()
  const topicId = params.id as string

  const [topic, setTopic] = useState<Topic | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [rebuttals, setRebuttals] = useState<Rebuttal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // フォーム用
  const [nickname, setNickname] = useState('')
  const [opinion, setOpinion] = useState('')
  const [reason1, setReason1] = useState('')
  const [reason2, setReason2] = useState('')
  const [reason3, setReason3] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [rebuttalTarget, setRebuttalTarget] = useState<{
    postId: string
    reasonIndex: ReasonIndex
  } | null>(null)
  const [rebuttalClaim, setRebuttalClaim] = useState('')
  const [rebuttalReason1, setRebuttalReason1] = useState('')
  const [rebuttalReason2, setRebuttalReason2] = useState('')
  const [rebuttalReason3, setRebuttalReason3] = useState('')
  const [rebuttalSubmitting, setRebuttalSubmitting] = useState(false)

  useEffect(() => {
    // ニックネームをlocalStorageから取得
    const saved = localStorage.getItem('nickname')
    if (saved) setNickname(saved)

    const fetchData = async () => {
      const { data: topicData } = await supabase
        .from('topics')
        .select('*')
        .eq('id', topicId)
        .single()

      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: false })

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

      setTopic(topicData)
      setPosts(postsData || [])
      setRebuttals(rebuttalsData)
      setLoading(false)
    }

    fetchData()
  }, [topicId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!opinion || !reason1 || !reason2 || !reason3 || !nickname) {
      alert('すべての項目を入力してください')
      return
    }

    setSubmitting(true)

    // ニックネームを保存
    localStorage.setItem('nickname', nickname)

    const { error } = await supabase.from('posts').insert({
      topic_id: topicId,
      nickname,
      opinion,
      reason1,
      reason2,
      reason3,
    })

    if (error) {
      alert('投稿に失敗しました')
      console.error(error)
    } else {
      // フォームをリセット
      setOpinion('')
      setReason1('')
      setReason2('')
      setReason3('')
      setShowForm(false)

      // 投稿一覧を再取得
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: false })
      setPosts(data || [])
    }

    setSubmitting(false)
  }

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

  function rebuttalsFor(postId: string, reasonIndex: ReasonIndex) {
    return rebuttals.filter(
      (r) => r.post_id === postId && r.reason_index === reasonIndex,
    )
  }

  if (loading) return <div className="p-8">読み込み中...</div>
  if (!topic) return <div className="p-8">お題が見つかりません</div>

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 pb-24">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          ← 戻る
        </Link>

        <div className="bg-white p-5 rounded-lg shadow mb-6">
          <h1 className="text-xl font-bold">{topic.title}</h1>
          {topic.description && (
            <p className="text-gray-600 mt-2">{topic.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-3">
            期限: {new Date(topic.deadline).toLocaleDateString('ja-JP')}
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <h2 className="font-semibold text-gray-700">投稿一覧</h2>

          {posts.length === 0 ? (
            <p className="text-gray-500 text-sm">まだ投稿がありません</p>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>{post.nickname}</span>
                  <span>{new Date(post.created_at).toLocaleString('ja-JP')}</span>
                </div>
                <p className="font-medium mb-3">{post.opinion}</p>
                <div className="text-sm text-gray-700">
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
                        {canRebut({
                          viewerNickname: nickname,
                          postNickname: post.nickname,
                          existingRebuttals: rebuttals.filter((r) => r.post_id === post.id),
                          reasonIndex: idx,
                        }) ? (
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
                        ) : (
                          nickname.trim() !== '' &&
                          nickname.trim() !== post.nickname.trim() &&
                          rebuttals.some(
                            (r) =>
                              r.post_id === post.id &&
                              r.reason_index === idx &&
                              r.nickname.trim() === nickname.trim(),
                          ) && (
                            <span className="text-xs text-gray-400 mt-1">反論済み</span>
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 反論フォーム */}
        {rebuttalTarget && (
          <div className="bg-white p-5 rounded-lg shadow fixed bottom-0 left-0 right-0 md:static max-w-2xl mx-auto">
            <h3 className="font-bold mb-4">
              理由{rebuttalTarget.reasonIndex}への反論
            </h3>
            <form onSubmit={handleRebuttalSubmit} className="space-y-3">
              <div>
                <label className="text-sm font-medium">ニックネーム</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">反対の主張</label>
                <textarea
                  value={rebuttalClaim}
                  onChange={(e) => setRebuttalClaim(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  rows={2}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">理由1（必須）</label>
                <textarea
                  value={rebuttalReason1}
                  onChange={(e) => setRebuttalReason1(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  rows={2}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">理由2（必須）</label>
                <textarea
                  value={rebuttalReason2}
                  onChange={(e) => setRebuttalReason2(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  rows={2}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">理由3（必須）</label>
                <textarea
                  value={rebuttalReason3}
                  onChange={(e) => setRebuttalReason3(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  rows={2}
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRebuttalTarget(null)}
                  className="flex-1 border rounded py-2"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={rebuttalSubmitting}
                  className="flex-1 bg-blue-600 text-white rounded py-2 disabled:opacity-50"
                >
                  {rebuttalSubmitting ? '投稿中...' : '反論する'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 投稿フォーム */}
        {!rebuttalTarget && showForm ? (
          <div className="bg-white p-5 rounded-lg shadow fixed bottom-0 left-0 right-0 md:static md:bottom-auto max-w-2xl mx-auto">
            <h3 className="font-bold mb-4">意見を書く</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm font-medium">ニックネーム</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">あなたの意見</label>
                <textarea
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  rows={2}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">理由1（必須）</label>
                <textarea
                  value={reason1}
                  onChange={(e) => setReason1(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  rows={2}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">理由2（必須）</label>
                <textarea
                  value={reason2}
                  onChange={(e) => setReason2(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  rows={2}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">理由3（必須）</label>
                <textarea
                  value={reason3}
                  onChange={(e) => setReason3(e.target.value)}
                  className="w-full border rounded p-2 mt-1"
                  rows={2}
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border rounded py-2"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white rounded py-2 disabled:opacity-50"
                >
                  {submitting ? '投稿中...' : '投稿する'}
                </button>
              </div>
            </form>
          </div>
        ) : !rebuttalTarget ? (
          <button
            onClick={() => {
              setRebuttalTarget(null)
              setShowForm(true)
            }}
            className="fixed bottom-6 right-6 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700"
          >
            意見を書く
          </button>
        ) : null}
      </div>
    </main>
  )
}